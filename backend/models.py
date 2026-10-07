"""Pydantic models shared by the API and the chatbot agent."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class SizeStock(BaseModel):
    size: str
    quantity: int


class Product(BaseModel):
    product_id: str
    name: str
    garment_type: str          # raw value from the database
    category: str              # cleaned top-level category, e.g. "Hoodies"
    subcategory: str           # e.g. "Pullover Hoodies"
    theme: str                 # e.g. "Family", "Sports"
    description: str
    short_description: str
    description_available: bool
    colors: list[str]
    search_tags: list[str]
    image_url: str
    price: float
    inventory: list[SizeStock]
    total_stock: int
    in_stock: bool


class CategoryNode(BaseModel):
    name: str
    count: int
    subcategories: dict[str, int]


class Taxonomy(BaseModel):
    categories: list[CategoryNode]
    themes: dict[str, int]


# ── Accounts ──────────────────────────────────────────────────────
# Passwords only ever travel INTO the API (never back out), and the
# password_hash column is never placed on any model that is returned.

class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class PublicUser(BaseModel):
    """What the frontend is allowed to see about an account. No hash, ever."""
    id: int
    first_name: str
    last_name: str
    email: EmailStr


class AuthResponse(BaseModel):
    user: PublicUser
    token: str


# ── Agent tool return types (Problem 6) ──────────────────────────
# Every price and quantity in these comes straight from campus_customs.db at
# call time. The agent reads these; it never has to (or may) guess.

StockStatus = Literal["in_stock", "low_stock", "sold_out"]


class SizeAvailability(BaseModel):
    """Stock for one size, with an explicit status so 'sold out' is unmissable."""
    size: str = Field(description="One of XS, S, M, L, XL, XXL.")
    quantity: int = Field(description="Units on hand right now, from the inventory table.")
    status: StockStatus = Field(description="sold_out if 0, low_stock if 1-5, else in_stock.")


class ProductSummary(BaseModel):
    """Search result: enough to pick and compare items, without long descriptions."""
    product_id: str
    name: str
    category: str
    subcategory: str
    theme: str
    price_usd: float = Field(description="Current price from the catalogue table.")
    colors: list[str]
    sizes_in_stock: list[str]
    sizes_sold_out: list[str]
    total_stock: int
    in_stock: bool


class ProductDetails(ProductSummary):
    """Everything about one product, including exact stock for every size."""
    garment_type: str = Field(description="Raw style label from the database, e.g. 'pullover hoodie'.")
    description: str
    description_available: bool = Field(description="False if the database only has a placeholder description.")
    stock_by_size: list[SizeAvailability]


class StockCheck(BaseModel):
    """Answer to 'do you have <product> in <size>?'"""
    product_id: str
    name: str
    size: str
    quantity: int
    status: StockStatus
    price_usd: float
    other_sizes_in_stock: list[str] = Field(description="Alternatives to suggest if this size is sold out or low.")


# ── Chat ──────────────────────────────────────────────────────────

class ChatTurn(BaseModel):
    """One earlier message, replayed to give the agent conversation memory."""
    role: Literal["user", "assistant"]
    content: str


PageType = Literal["home", "products", "product", "chat_results", "account", "other"]


class PageContext(BaseModel):
    """What the shopper is looking at when they send a message (sent by the website).

    Everything here is treated as untrusted data: lengths are capped, and the
    API re-reads any product_id from the database before the agent sees it.
    """
    path: str = Field(default="/", max_length=200)
    page_type: PageType = "other"
    product_id: str | None = Field(default=None, max_length=120, description="Set on a single-product page.")
    category: str | None = Field(default=None, max_length=60)
    subcategory: str | None = Field(default=None, max_length=60)
    theme: str | None = Field(default=None, max_length=60)
    search: str | None = Field(default=None, max_length=100, description="Search box text on the products page.")
    results_title: str | None = Field(default=None, max_length=60, description="Heading of chat results on the page.")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # Guests send their own recent turns. For logged-in shoppers the server
    # ignores this and loads history from the chat_messages table instead.
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    page: PageContext | None = None


class AgentReply(BaseModel):
    """Structured output the agent must produce (the agent side of the API contract).

    It names products by id only; the API turns those ids into live Product
    cards from the database, so prices and stock shown are always current.
    """
    reply: str = Field(description="The assistant's message to the shopper, in the Campus Customs voice.")
    product_ids: list[str] = Field(
        default_factory=list,
        max_length=30,
        description="product_id of each matching item, most relevant first, copied exactly from tool results. Empty if none.",
    )
    show_on_page: bool = Field(
        default=False,
        description=(
            "True when the shopper is browsing or searching (e.g. 'what hoodies do you have?') and the matches "
            "should replace the product grid on the website. False for questions about one item they already "
            "know (price, a size, details) or when there are no matches."
        ),
    )
    results_title: str | None = Field(
        default=None,
        max_length=60,
        description="Short heading for the product grid when show_on_page is true, e.g. 'Navy hoodies' or 'Gifts for Dad'.",
    )


class ProductMatches(BaseModel):
    """Structured product matches the website renders as product cards."""
    title: str = Field(description="Heading for the results grid.")
    query: str = Field(description="The shopper message that produced these matches.")
    show_on_page: bool = Field(description="If true, the website switches its product grid to these matches.")
    count: int
    products: list[Product] = Field(description="Full product records read fresh from the database, in the agent's order.")


class CustomerProfile(BaseModel):
    """The customer fields the agent may see. No password hash, ever."""
    user_id: int
    first_name: str
    last_name: str
    email: str
    member_since: str = Field(description="Account creation date, YYYY-MM-DD.")


class ViewedProduct(BaseModel):
    """The product on the page the shopper is viewing, re-read from the database."""
    product_id: str
    name: str
    price_usd: float
    colors: list[str]
    category: str
    subcategory: str


class ChatHistoryItem(BaseModel):
    """One saved message, as returned to the website when a shopper comes back."""
    role: Literal["user", "assistant"]
    content: str
    matches: ProductMatches | None = None
    created_at: str


class ChatHistoryResponse(BaseModel):
    messages: list[ChatHistoryItem]


class ChatResponse(BaseModel):
    """What the chat endpoint returns to the website.

    `matches` is null when the reply doesn't involve any products.
    """
    reply: str
    matches: ProductMatches | None = None


# ── Audit trail (Problem 12) ─────────────────────────────────────
# One object per event, appended to output/audit_trail.json. Fields that
# don't apply to an event are left out of the file (exclude_none).

AuditEvent = Literal["run_start", "tool_call", "run_end"]


class AuditEntry(BaseModel):
    run_id: str = Field(description="Groups the events of one chat message's agent run.")
    event: AuditEvent
    time: str = Field(description="UTC ISO-8601 timestamp of the event.")
    # run_start
    user: str | None = Field(default=None, description='"user:<id>" or "guest". Never a name, email or password.')
    page: str | None = Field(default=None, description="Page type (+ product_id) the shopper was on.")
    message: str | None = Field(default=None, description="First 80 characters of the shopper's message.")
    # tool_call
    tool: str | None = None
    tool_kind: str | None = Field(default=None, description='"function" for our tools, "output" for the final structured reply.')
    args: str | None = Field(default=None, description="Short JSON of the arguments.")
    result: str | None = Field(default=None, description="Short summary of what the tool returned.")
    status: Literal["ok", "retry", "error"] | None = Field(default=None, description="retry = tool raised ModelRetry.")
    duration_ms: int | None = None
    # run_end
    stop_reason: str | None = Field(default=None, description="final_output, usage_limit: …, or error: …")
    finish_reason: str | None = Field(default=None, description="The model's own finish reason on its last response.")
    requests: int | None = Field(default=None, description="Model requests used in this run.")
    tool_calls: int | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    products_shown: int | None = None
    show_on_page: bool | None = None
