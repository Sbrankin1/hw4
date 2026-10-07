"""Campus Customs API — run from the backend/ folder with:

    uvicorn main:app --reload --port 8000

Serves products and images (read-only), handles accounts, and exposes the
chat route that the website's chat widget talks to. The chat brain is the
Pydantic AI agent in agent.py.
"""

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

import agent as chat_agent
import tools
from models import (
    AuthResponse,
    ChatHistoryResponse,
    ChatRequest,
    ChatResponse,
    ChatTurn,
    PageContext,
    ProductMatches,
    LoginRequest,
    Product,
    PublicUser,
    RegisterRequest,
    Taxonomy,
)

app = FastAPI(title="Campus Customs API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/media/{image_path:path}")
def media(image_path: str) -> Response:
    """Product photos: DB image_file_path "products/<id>.jpg" is served at /media/products/<id>.jpg."""
    data = tools.cleaned_image(image_path)
    if data is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "database": str(tools.DB_PATH), "exists": tools.DB_PATH.exists()}


@app.get("/api/products", response_model=list[Product])
def products(
    category: str | None = None,
    subcategory: str | None = None,
    theme: str | None = None,
    q: str | None = None,
) -> list[Product]:
    return tools.list_products(category=category, subcategory=subcategory, theme=theme, q=q)


@app.get("/api/products/{product_id}", response_model=Product)
def product(product_id: str) -> Product:
    found = tools.get_product(product_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return found


@app.get("/api/categories", response_model=Taxonomy)
def categories() -> Taxonomy:
    return tools.get_taxonomy()


# ── Accounts ──────────────────────────────────────────────────────

def current_user(authorization: str | None = Header(default=None)) -> PublicUser:
    """FastAPI dependency: resolve the logged-in user from a Bearer token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")
    user_id = tools.read_token(authorization.split(" ", 1)[1])
    if user_id is None:
        raise HTTPException(status_code=401, detail="Session expired — please log in again")
    user = tools.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Account not found")
    return user


@app.post("/api/register", response_model=AuthResponse, status_code=201)
def register(body: RegisterRequest) -> AuthResponse:
    try:
        user = tools.create_user(body.first_name, body.last_name, body.email, body.password)
    except tools.EmailTakenError:
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    return AuthResponse(user=user, token=tools.make_token(user.id))


@app.post("/api/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    user = tools.authenticate(body.email, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return AuthResponse(user=user, token=tools.make_token(user.id))


@app.get("/api/me", response_model=PublicUser)
def me(user: PublicUser = Depends(current_user)) -> PublicUser:
    return user


# ── Chat ──────────────────────────────────────────────────────────

def optional_user(authorization: str | None = Header(default=None)) -> PublicUser | None:
    """Like current_user, but returns None instead of erroring when signed out."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    user_id = tools.read_token(authorization.split(" ", 1)[1])
    return tools.get_user_by_id(user_id) if user_id is not None else None


@app.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, user: PublicUser | None = Depends(optional_user)) -> ChatResponse:
    """A message from the website → a reply from the agent, plus structured product matches.

    Contract: the agent returns AgentReply {reply, product_ids, show_on_page,
    results_title}. We turn the ids into live Product records from the database
    (so cards always show current price and stock) and return
    ChatResponse {reply, matches: ProductMatches | null}. The website renders
    matches.products as product cards, on the page when show_on_page is true.
    """
    # Who is chatting and what page they're on → agent dependencies.
    page = body.page or PageContext()
    deps = chat_agent.ChatDeps(
        customer=tools.get_customer_profile(user.id) if user else None,
        page=page,
        viewed=tools.viewed_product(page.product_id),
    )

    # Memory: signed-in shoppers' history comes from the database (trusted);
    # guests' comes from the browser and is never stored.
    if user:
        history = [
            ChatTurn(role=m.role, content=m.content)
            for m in tools.load_chat_history(user.id, limit=tools.HISTORY_FOR_AGENT)
        ]
    else:
        history = body.history

    try:
        reply = await chat_agent.answer(
            message=body.message, history=history, deps=deps,
            user_label=f"user:{user.id}" if user else "guest",
        )
    except Exception as exc:  # keep the widget usable if the model/gateway fails
        raise HTTPException(status_code=502, detail=f"The assistant is unavailable right now ({exc.__class__.__name__}).")

    products: list[Product] = []
    seen: set[str] = set()
    for pid in reply.product_ids:
        if pid in seen:
            continue
        found = tools.get_product(pid)  # unknown ids are dropped, never invented
        if found is not None:
            products.append(found)
            seen.add(pid)

    matches = None
    if products:
        matches = ProductMatches(
            title=reply.results_title or ("Handsome Dan's pick" if len(products) == 1 else "Handsome Dan's picks"),
            query=body.message,
            show_on_page=reply.show_on_page,
            count=len(products),
            products=products,
        )

    if user:  # persist both sides of the exchange
        tools.save_chat_message(user.id, "user", body.message)
        tools.save_chat_message(user.id, "assistant", reply.reply, matches)

    return ChatResponse(reply=reply.reply, matches=matches)


@app.get("/api/chat/history", response_model=ChatHistoryResponse)
def chat_history(user: PublicUser = Depends(current_user)) -> ChatHistoryResponse:
    """A returning shopper's saved conversation (logged-in only)."""
    return ChatHistoryResponse(messages=tools.load_chat_history(user.id))


@app.delete("/api/chat/history")
def delete_chat_history(user: PublicUser = Depends(current_user)) -> dict:
    """Let a shopper wipe their saved conversation."""
    return {"deleted": tools.clear_chat_history(user.id)}
