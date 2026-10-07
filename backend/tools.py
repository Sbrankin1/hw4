"""Database access for campus_customs.db, plus derived category/theme fields.

Catalogue / inventory reads are strictly read-only: category, subcategory and
theme are computed from the raw rows every time a product is read (rules in
output/harness.md). The ONLY writes this module makes are inserting new rows
into the `users` table for the account flow (see the "Accounts" section).
"""

import base64
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import sys
import threading
import sqlite3
import time
from collections import Counter
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image, ImageDraw
from pydantic_ai import ModelRetry

from models import (
    AuditEntry,
    CategoryNode,
    ChatHistoryItem,
    CustomerProfile,
    Product,
    ProductMatches,
    ProductDetails,
    ProductSummary,
    PublicUser,
    SizeAvailability,
    SizeStock,
    StockCheck,
    StockStatus,
    Taxonomy,
    ViewedProduct,
)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Default: AI Foundations/Data 3/campus_customs.db, three levels above backend/.
_DEFAULT_DB = Path(__file__).resolve().parents[3] / "Data 3" / "campus_customs.db"
DB_PATH = Path(os.getenv("CAMPUS_DB_PATH", _DEFAULT_DB)).expanduser()
if not DB_PATH.is_absolute():  # relative paths in .env are relative to backend/
    DB_PATH = (Path(__file__).resolve().parent / DB_PATH).resolve()
# image_file_path values are relative to the folder holding the database.
MEDIA_ROOT = DB_PATH.parent

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]

# Ordered category tree, used for display order in the UI.
CATEGORY_TREE: dict[str, list[str]] = {
    "T-Shirts & Tops": ["Short-Sleeve Tees", "Long-Sleeve Performance"],
    "Sweatshirts": ["Crewnecks", "Mocknecks", "Quarter-Zips"],
    "Hoodies": ["Pullover Hoodies", "Full-Zip Hoodies"],
    "Outerwear": ["Fleece Jackets", "Bomber Jackets"],
}

# Checked in order; Family/College/School run before Sports because their
# crewnecks share the "sports crewneck" template.
THEME_RULES: list[tuple[str, list[str]]] = [
    ("Family", ["mom", "dad", "grandma", "grandpa", "aunt", "uncle", "brother", "cousin", "sister"]),
    ("Residential Colleges", [
        "saybrook", "pierson", "morse", "branford", "berkeley", "trumbull", "davenport",
        "grace-hopper", "jonathan-edwards", "timothy-dwight", "benjamin-franklin",
        "silliman", "stiles", "ezra",
    ]),
    ("Graduate & Professional Schools", [
        "school-of", "law-school", "divinity", "forest-school", "medicine", "nursing", "management",
    ]),
    ("Sports", [
        "baseball", "hockey", "soccer", "sailing", "fencing", "squash", "golf", "diving",
        "tennis", "volleyball", "lacrosse", "football", "basketball", "track", "swimming",
        "crew-left-chest",  # plain "crew" would also match "crewneck"
    ]),
]
FALLBACK_THEME = "Classic Yale / Spirit"
THEMES = [name for name, _ in THEME_RULES] + [FALLBACK_THEME]

STUB_MARKER = "Vision blocked"


def classify_garment(garment_type: str, product_id: str) -> tuple[str, str]:
    """Map a messy garment_type to (category, subcategory). Most specific first."""
    g = garment_type.lower()
    if "bomber" in g:
        return "Outerwear", "Bomber Jackets"
    if "fleece" in g or "jacket" in g:
        return "Outerwear", "Fleece Jackets"
    if "hood" in g:
        if "full-zip" in g:
            return "Hoodies", "Full-Zip Hoodies"
        return "Hoodies", "Pullover Hoodies"
    if "quarter-zip" in g:
        return "Sweatshirts", "Quarter-Zips"
    if "mockneck" in g:
        return "Sweatshirts", "Mocknecks"
    if "crewneck" in g and "t-shirt" not in g:
        return "Sweatshirts", "Crewnecks"
    if "performance" in g or "long-sleeve" in g:
        return "T-Shirts & Tops", "Long-Sleeve Performance"
    if "t-shirt" in g:
        return "T-Shirts & Tops", "Short-Sleeve Tees"
    return "T-Shirts & Tops", "Short-Sleeve Tees"  # unreachable with current data


def classify_theme(product_id: str) -> str:
    pid = product_id.lower()
    for theme, keywords in THEME_RULES:
        if any(k in pid for k in keywords):
            return theme
    return FALLBACK_THEME


def _connect() -> sqlite3.Connection:
    # Open read-only so product/inventory reads can never change the source data.
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_rw() -> sqlite3.Connection:
    # Read-write connection, used only by the Accounts section to add users.
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _short(text: str, limit: int = 110) -> str:
    first = text.split(". ")[0].rstrip(".") + "."
    if len(first) <= limit:
        return first
    return text[:limit].rsplit(" ", 1)[0] + "…"


def _build_product(row: sqlite3.Row, stock_rows: list[sqlite3.Row]) -> Product:
    category, subcategory = classify_garment(row["garment_type"], row["product_id"])
    colors = json.loads(row["colors"])
    description = row["description"]
    available = STUB_MARKER not in description
    if not available:
        description = f"{row['name']} in {', '.join(colors) or 'Yale colors'}. Full product details coming soon."

    stock = sorted(
        (SizeStock(size=s["size"], quantity=s["quantity"]) for s in stock_rows),
        key=lambda s: SIZE_ORDER.index(s.size) if s.size in SIZE_ORDER else 99,
    )
    total = sum(s.quantity for s in stock)
    return Product(
        product_id=row["product_id"],
        name=row["name"],
        garment_type=row["garment_type"],
        category=category,
        subcategory=subcategory,
        theme=classify_theme(row["product_id"]),
        description=description,
        short_description=_short(description),
        description_available=available,
        colors=colors,
        search_tags=json.loads(row["search_tags"]),
        image_url=f"/media/{row['image_file_path']}",
        price=row["price"],
        inventory=stock,
        total_stock=total,
        in_stock=total > 0,
    )


def load_products() -> list[Product]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
        stock: dict[str, list[sqlite3.Row]] = {}
        for s in conn.execute("SELECT product_id, size, quantity FROM inventory"):
            stock.setdefault(s["product_id"], []).append(s)
    return [_build_product(r, stock.get(r["product_id"], [])) for r in rows]


def list_products(
    category: str | None = None,
    subcategory: str | None = None,
    theme: str | None = None,
    q: str | None = None,
) -> list[Product]:
    products = load_products()
    if category:
        products = [p for p in products if p.category == category]
    if subcategory:
        products = [p for p in products if p.subcategory == subcategory]
    if theme:
        products = [p for p in products if p.theme == theme]
    if q:
        needle = q.lower()
        products = [
            p for p in products
            if needle in " ".join([p.name, p.garment_type, p.description, *p.colors, *p.search_tags]).lower()
        ]
    return products


def get_product(product_id: str) -> Product | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            return None
        stock = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
        ).fetchall()
    return _build_product(row, stock)


def get_taxonomy() -> Taxonomy:
    products = load_products()
    subs = Counter(p.subcategory for p in products)
    cats = Counter(p.category for p in products)
    themes = Counter(p.theme for p in products)
    return Taxonomy(
        categories=[
            CategoryNode(name=c, count=cats[c], subcategories={s: subs[s] for s in tree})
            for c, tree in CATEGORY_TREE.items()
        ],
        themes={t: themes[t] for t in THEMES},
    )


@lru_cache(maxsize=256)
def cleaned_image(relative_path: str) -> bytes | None:
    """Return a product photo as JPEG bytes with its black background turned white.

    73 of the 102 photos were transparent PNGs flattened onto black. We flood-fill
    near-black pixels connected to the image border, so dark navy garments in the
    middle are left alone. The original files are never modified.
    """
    path = (MEDIA_ROOT / relative_path).resolve()
    if MEDIA_ROOT.resolve() not in path.parents or not path.is_file():
        return None
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    step = max(1, min(w, h) // 40)
    seeds = (
        [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)]
        + [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    )
    for seed in seeds:
        if sum(px[seed]) < 45:  # still near-black (not already filled)
            ImageDraw.floodfill(im, seed, (255, 255, 255), thresh=40)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


# ══════════════════════════════════════════════════════════════════
#  Accounts: password hashing, user creation, login, session tokens
# ══════════════════════════════════════════════════════════════════
#
# Password protection (defence in depth so no human OR AI can read them):
#   * We NEVER store the password. We store a PBKDF2-HMAC-SHA256 hash, which
#     is a one-way function — you cannot run it backwards to get the password.
#   * Each user gets their own random 16-byte salt, so identical passwords
#     produce different hashes and precomputed "rainbow table" attacks fail.
#   * We stretch with 600,000 iterations, making brute-force guessing slow.
#   * The stored string is self-describing: pbkdf2_sha256$<iters>$<salt>$<hash>.
#   * Verification uses a constant-time compare to avoid timing side-channels.
#   * The password_hash column is never returned by the API (PublicUser omits
#     it) and is never handed to the agent.

_PBKDF2_ITERATIONS = 600_000
_SALT_BYTES = 16

# Signing key for login tokens. Set SECRET_KEY in .env to keep sessions valid
# across restarts; otherwise we generate an ephemeral one at startup.
SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_hex(32)
TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60  # one week


class EmailTakenError(Exception):
    """Raised when a sign-up uses an email that already has an account."""


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time check of a password against a stored hash.

    Supports our 4-part format (with iterations) and the seed DB's 3-part
    pbkdf2_sha256$salt$hash format (assumed to use the default iterations).
    """
    try:
        parts = stored.split("$")
        if len(parts) == 4:
            _, iters, salt_hex, want = parts
            iterations = int(iters)
        elif len(parts) == 3:
            _, salt_hex, want = parts
            iterations = _PBKDF2_ITERATIONS
        else:
            return False
        got = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), iterations)
        return hmac.compare_digest(got.hex(), want)
    except (ValueError, AttributeError):
        return False


def _public_user(row: sqlite3.Row) -> PublicUser:
    return PublicUser(
        id=row["id"],
        first_name=row["first_name"] or (row["name"] or "").split(" ")[0],
        last_name=row["last_name"] or " ".join((row["name"] or "").split(" ")[1:]),
        email=row["email"],
    )


def create_user(first_name: str, last_name: str, email: str, password: str) -> PublicUser:
    """Insert a new account. Raises EmailTakenError if the email already exists."""
    email = email.strip().lower()
    password_hash = hash_password(password)
    full_name = f"{first_name.strip()} {last_name.strip()}".strip()
    with _connect_rw() as conn:
        exists = conn.execute("SELECT 1 FROM users WHERE lower(email) = ?", (email,)).fetchone()
        if exists:
            raise EmailTakenError(email)
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash, first_name, last_name) "
            "VALUES (?, ?, ?, ?, ?)",
            (full_name, email, password_hash, first_name.strip(), last_name.strip()),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _public_user(row)


def authenticate(email: str, password: str) -> PublicUser | None:
    """Return the user if the email+password match, else None."""
    with _connect_rw() as conn:
        row = conn.execute("SELECT * FROM users WHERE lower(email) = ?", (email.strip().lower(),)).fetchone()
    if row is None:
        # Hash anyway so a missing email takes the same time as a wrong password.
        verify_password(password, "pbkdf2_sha256$1$00$00")
        return None
    if not verify_password(password, row["password_hash"]):
        return None
    return _public_user(row)


def get_user_by_id(user_id: int) -> PublicUser | None:
    with _connect_rw() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _public_user(row) if row else None


# ── Session tokens (signed, stateless) ────────────────────────────
# token = base64(payload).base64(hmac_sha256(payload)). The signature means a
# client cannot forge or tamper with the user id or expiry without the key.

def make_token(user_id: int) -> str:
    payload = json.dumps({"uid": user_id, "exp": int(time.time()) + TOKEN_TTL_SECONDS}).encode()
    body = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    sig = hmac.new(SECRET_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def read_token(token: str) -> int | None:
    """Return the user id from a valid, unexpired token, else None."""
    try:
        body, sig = token.split(".")
        expected = hmac.new(SECRET_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        padded = body + "=" * (-len(body) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded))
        if data.get("exp", 0) < time.time():
            return None
        return int(data["uid"])
    except (ValueError, KeyError, json.JSONDecodeError):
        return None


# ══════════════════════════════════════════════════════════════════
#  Customer memory: who is chatting, saved chat history, page context
# ══════════════════════════════════════════════════════════════════
#
# Chat history for logged-in shoppers lives in the seed table `chat_messages`
# (id, user_id → users.id, role, content, products_json, created_at).
# products_json holds the reply's product matches as
#   {"title", "query", "show_on_page", "product_ids": [...]}
# Only ids are saved; products are re-read from the catalogue when history
# loads, so a returning shopper never sees a stale price or stock count.
# (Older seed rows stored a list of product snapshots; we read their ids too.)

HISTORY_FOR_AGENT = 20     # turns replayed to the agent as memory
HISTORY_FOR_WIDGET = 50    # messages shown when a shopper returns


def get_customer_profile(user_id: int) -> CustomerProfile | None:
    with _connect_rw() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        return None
    public = _public_user(row)
    return CustomerProfile(
        user_id=public.id,
        first_name=public.first_name,
        last_name=public.last_name,
        email=public.email,
        member_since=(row["created_at"] or "")[:10],
    )


def save_chat_message(user_id: int, role: str, content: str, matches: ProductMatches | None = None) -> None:
    products_json = None
    if matches is not None:
        products_json = json.dumps({
            "title": matches.title,
            "query": matches.query,
            "show_on_page": matches.show_on_page,
            "product_ids": [p.product_id for p in matches.products],
        })
    if role == "user":
        content = redact_secrets(content)  # a shopper may type a password; never store it
    with _connect_rw() as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, ?, ?, ?)",
            (user_id, role, content, products_json),
        )
        conn.commit()


def _matches_from_json(raw: str | None, fallback_query: str) -> ProductMatches | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if isinstance(data, list):  # seed format: list of product snapshots
        ids = [d.get("product_id") for d in data if isinstance(d, dict)]
        data = {"product_ids": ids, "show_on_page": len(ids) > 1}
    products = [p for pid in data.get("product_ids", []) if pid and (p := get_product(pid)) is not None]
    if not products:
        return None
    return ProductMatches(
        title=data.get("title") or ("Handsome Dan's pick" if len(products) == 1 else "Handsome Dan's picks"),
        query=data.get("query") or fallback_query,
        show_on_page=bool(data.get("show_on_page")),
        count=len(products),
        products=products,
    )


def load_chat_history(user_id: int, limit: int = HISTORY_FOR_WIDGET) -> list[ChatHistoryItem]:
    """The shopper's most recent messages, oldest first, with live product matches."""
    with _connect_rw() as conn:
        rows = conn.execute(
            "SELECT role, content, products_json, created_at FROM chat_messages "
            "WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    items: list[ChatHistoryItem] = []
    last_user_text = ""
    for row in reversed(rows):
        if row["role"] not in ("user", "assistant"):
            continue
        if row["role"] == "user":
            last_user_text = row["content"]
        items.append(ChatHistoryItem(
            role=row["role"],
            content=row["content"],
            matches=_matches_from_json(row["products_json"], last_user_text) if row["role"] == "assistant" else None,
            created_at=row["created_at"],
        ))
    return items


def clear_chat_history(user_id: int) -> int:
    with _connect_rw() as conn:
        cur = conn.execute("DELETE FROM chat_messages WHERE user_id = ?", (user_id,))
        conn.commit()
    return cur.rowcount


def viewed_product(product_id: str | None) -> ViewedProduct | None:
    """Resolve the page's product_id against the database (never trust the client's text)."""
    if not product_id:
        return None
    p = get_product(product_id)
    if p is None:
        return None
    return ViewedProduct(
        product_id=p.product_id, name=p.name, price_usd=p.price,
        colors=p.colors, category=p.category, subcategory=p.subcategory,
    )


# ══════════════════════════════════════════════════════════════════
#  Chatbot agent: model + the tools the agent is allowed to call
# ══════════════════════════════════════════════════════════════════
#
# The model is served through Portkey (OpenAI-compatible). agent.py imports
# get_model() and the three tool functions below. Each tool reads live rows
# from campus_customs.db and returns a typed model from models.py
# (ProductSummary / ProductDetails / StockCheck), so the agent never has to
# guess a price or a stock count.

MODEL_NAME = os.getenv("MODEL_NAME", "gpt-5.6-luna")
PORTKEY_BASE_URL = os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1")


@lru_cache(maxsize=1)
def get_model():
    """Portkey-served chat model used by the agent."""
    from pydantic_ai.models.openai import OpenAIChatModel
    from pydantic_ai.providers.openai import OpenAIProvider

    api_key = os.getenv("PORTKEY_API_KEY")
    if not api_key:
        raise RuntimeError("PORTKEY_API_KEY is not set. Add it to hw4/.env (see .env.example).")
    return OpenAIChatModel(MODEL_NAME, provider=OpenAIProvider(base_url=PORTKEY_BASE_URL, api_key=api_key))


LOW_STOCK_THRESHOLD = 5  # same threshold the website uses for "Only N left"

# Shoppers say "large", "medium", "extra large"... map to the DB's size codes.
_SIZE_ALIASES = {
    "xs": "XS", "extra small": "XS", "x-small": "XS", "xsmall": "XS",
    "s": "S", "small": "S", "sm": "S",
    "m": "M", "medium": "M", "med": "M",
    "l": "L", "large": "L", "lg": "L",
    "xl": "XL", "extra large": "XL", "x-large": "XL", "xlarge": "XL",
    "xxl": "XXL", "2xl": "XXL", "xx-large": "XXL", "xxlarge": "XXL", "extra extra large": "XXL",
}


def _status(quantity: int) -> StockStatus:
    if quantity <= 0:
        return "sold_out"
    if quantity <= LOW_STOCK_THRESHOLD:
        return "low_stock"
    return "in_stock"


def _summary(p: Product) -> ProductSummary:
    return ProductSummary(
        product_id=p.product_id,
        name=p.name,
        category=p.category,
        subcategory=p.subcategory,
        theme=p.theme,
        price_usd=p.price,
        colors=p.colors,
        sizes_in_stock=[s.size for s in p.inventory if s.quantity > 0],
        sizes_sold_out=[s.size for s in p.inventory if s.quantity == 0],
        total_stock=p.total_stock,
        in_stock=p.in_stock,
    )


def _require_product(product_id: str) -> Product:
    p = get_product(product_id.strip())
    if p is None:
        # ModelRetry sends this back to the model so it can correct itself.
        raise ModelRetry(
            f"No product has product_id '{product_id}'. Call search_products first and use an exact product_id from its results."
        )
    return p


# ── Agent tools ───────────────────────────────────────────────────

def search_products(
    query: str = "",
    category: str | None = None,
    subcategory: str | None = None,
    theme: str | None = None,
    in_stock_only: bool = False,
) -> list[ProductSummary]:
    """Search the Campus Customs catalogue. Returns up to 30 matches with live price and which sizes are in stock / sold out.

    Args:
        query: free text matched against name, style, description, colors and tags.
            Use one or two key words (e.g. "bulldog", "navy", "hockey", "saybrook").
            Each word must match, in any order. Leave empty to browse a category/theme.
        category: one of "T-Shirts & Tops", "Sweatshirts", "Hoodies", "Outerwear".
        subcategory: one of "Short-Sleeve Tees", "Long-Sleeve Performance", "Crewnecks",
            "Mocknecks", "Quarter-Zips", "Pullover Hoodies", "Full-Zip Hoodies",
            "Fleece Jackets", "Bomber Jackets".
        theme: one of "Sports", "Residential Colleges",
            "Graduate & Professional Schools", "Family", "Classic Yale / Spirit".
        in_stock_only: if true, skip products that are sold out in every size.
    """
    results = list_products(category=category, subcategory=subcategory, theme=theme)
    words = [w for w in query.lower().split() if w]
    if words:
        def haystack(p: Product) -> str:
            return " ".join([p.name, p.garment_type, p.subcategory, p.description, *p.colors, *p.search_tags]).lower()
        results = [p for p in results if all(w in haystack(p) for w in words)]
    if in_stock_only:
        results = [p for p in results if p.in_stock]
    return [_summary(p) for p in results[:30]]


def get_product_details(product_id: str) -> ProductDetails:
    """Get one product's full description, current price and exact stock for every size (with sold_out / low_stock / in_stock status).

    Args:
        product_id: exact id from search_products, e.g. "fencing-left-chest-hoodie".
    """
    p = _require_product(product_id)
    return ProductDetails(
        **_summary(p).model_dump(),
        garment_type=p.garment_type,
        description=p.description,
        description_available=p.description_available,
        stock_by_size=[SizeAvailability(size=s.size, quantity=s.quantity, status=_status(s.quantity)) for s in p.inventory],
    )


def check_stock(product_id: str, size: str) -> StockCheck:
    """Check how many of one product are in stock in one size (e.g. "do you have it in a large?").

    Args:
        product_id: exact id from search_products.
        size: XS, S, M, L, XL or XXL. Words like "large" or "extra large" are accepted.
    """
    p = _require_product(product_id)
    code = _SIZE_ALIASES.get(size.strip().lower(), size.strip().upper())
    match = next((s for s in p.inventory if s.size == code), None)
    if match is None:
        raise ModelRetry(f"'{size}' is not a size we carry. Use one of: {', '.join(SIZE_ORDER)}.")
    return StockCheck(
        product_id=p.product_id,
        name=p.name,
        size=code,
        quantity=match.quantity,
        status=_status(match.quantity),
        price_usd=p.price,
        other_sizes_in_stock=[s.size for s in p.inventory if s.quantity > 0 and s.size != code],
    )



# ══════════════════════════════════════════════════════════════════
#  Audit trail: append-only log of every agent run (Problem 12)
# ══════════════════════════════════════════════════════════════════
#
# output/audit_trail.json is a JSON array that only ever grows. To append we
# seek to the closing "]", truncate just that bracket, and write
# ",\n<new entries>\n]". Earlier entries are never rewritten, reordered or
# deleted, and the file is never reset between runs or server restarts. If
# the file is ever unreadable we refuse to write (and say so on stderr)
# rather than risk overwriting the history.

AUDIT_PATH = Path(__file__).resolve().parent.parent / "output" / "audit_trail.json"
_AUDIT_LOCK = threading.Lock()
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# If a message mentions a password, mask anything that looks like one
# (6+ characters mixing letters with digits or symbols, e.g. "Password123").
_PASSWORD_TOPIC_RE = re.compile(r"(?i)pass(?:word|wd|code|phrase)?\b|\bpwd\b|\blog ?in\b|\bsign ?in\b")
_SECRET_TOKEN_RE = re.compile(r"(?<![\w<])(?=[^\s,.;:!?]*[A-Za-z])(?=[^\s,.;:!?]*[\d!@#$%^&*_\-])[^\s,.;:!?]{6,}")
SHORT_LIMIT = 160


def redact_secrets(text: str) -> str:
    """Mask password-looking tokens when the text is about passwords/logging in."""
    if _PASSWORD_TOPIC_RE.search(text):
        text = _SECRET_TOKEN_RE.sub("<redacted>", text)
    return text


def audit_short(value: object, limit: int = SHORT_LIMIT) -> str:
    """Compact, privacy-safe one-line summary for the audit file."""
    if isinstance(value, list) and value and all(hasattr(v, "product_id") for v in value):
        ids = [v.product_id for v in value]
        text = f"{len(ids)} products: " + ", ".join(ids)
    elif hasattr(value, "model_dump"):
        text = json.dumps(value.model_dump(mode="json"), default=str)
    elif isinstance(value, (dict, list)):
        text = json.dumps(value, default=str)
    else:
        text = str(value)
    text = _EMAIL_RE.sub("<email>", " ".join(text.split()))  # never log customer emails
    text = redact_secrets(text)                               # never log passwords
    return text if len(text) <= limit else text[: limit - 1] + "…"


def append_audit(entries: list[AuditEntry]) -> None:
    if not entries:
        return
    body = ",\n".join(json.dumps(e.model_dump(exclude_none=True), ensure_ascii=False) for e in entries)
    with _AUDIT_LOCK:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        if not AUDIT_PATH.exists() or AUDIT_PATH.stat().st_size == 0:
            AUDIT_PATH.write_text("[\n" + body + "\n]\n", encoding="utf-8")
            return
        with open(AUDIT_PATH, "r+b") as f:
            # Walk back from the end to the closing bracket.
            pos = f.seek(0, os.SEEK_END)
            tail = b""
            while pos > 0:
                pos -= 1
                f.seek(pos)
                ch = f.read(1)
                if not ch.isspace():
                    tail = ch
                    break
            if tail != b"]":
                print(f"[audit] {AUDIT_PATH} is not a JSON array; refusing to write so nothing is lost.", file=sys.stderr)
                return
            # Is the array empty ("[ ]")? Then no leading comma.
            prev = pos
            empty = False
            while prev > 0:
                prev -= 1
                f.seek(prev)
                ch = f.read(1)
                if not ch.isspace():
                    empty = ch == b"["
                    break
            f.seek(pos)
            f.truncate()
            f.write((("\n" if empty else ",\n") + body + "\n]\n").encode("utf-8"))
