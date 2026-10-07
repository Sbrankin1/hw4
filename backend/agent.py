"""Campus Customs shop chatbot — Pydantic AI agent entry point.

- Model: Portkey-served chat model (tools.get_model()).
- System prompt: prompts/prompt.md, plus dynamic instructions built from ChatDeps.
- Catalogue tools: tools.search_products, tools.get_product_details, tools.check_stock.
- Context tools: get_my_account, get_viewed_product (read from ChatDeps).
- Output: models.AgentReply (a message + product ids + whether to show them on the page).

main.py calls `answer()` from its /api/chat route. Every run is written to
output/audit_trail.json (append-only): run_start, one tool_call per tool the
agent used (args, short result, status, duration), and run_end (stop reason,
usage). Runs are capped by AGENT_LIMITS so the loop can't run away.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from pydantic_ai import Agent, RunContext, capture_run_messages
from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.usage import UsageLimits

from models import AgentReply, AuditEntry, ChatTurn, CustomerProfile, PageContext, ProductDetails, ViewedProduct
from tools import append_audit, audit_short, check_stock, get_model, get_product_details, search_products

PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "prompt.md"
TOOLS = [search_products, get_product_details, check_stock]

# Loop caps: a normal answer takes 2-4 model requests and 1-3 tool calls.
AGENT_LIMITS = UsageLimits(request_limit=8, tool_calls_limit=10)


@dataclass
class ChatDeps:
    """Per-request context: who is chatting and what page they're on.

    Built by main.py from the verified login token and the page context the
    website sends. Never contains a password or password hash.
    """
    customer: CustomerProfile | None = None
    page: PageContext = field(default_factory=PageContext)
    viewed: ViewedProduct | None = None  # page.product_id re-read from the database


def _page_summary(deps: ChatDeps) -> str:
    page = deps.page
    if deps.viewed:
        v = deps.viewed
        return (
            f"The shopper is on the product page for **{v.name}** (product_id `{v.product_id}`, "
            f"${v.price_usd:.2f}, colors: {', '.join(v.colors) or 'not listed'}). "
            'When they say "this", "it" or "this one", they mean this product. '
            "Use get_product_details / check_stock with this product_id for stock questions."
        )
    if page.page_type == "chat_results" and page.results_title:
        return f'The shopper is looking at your search results on the page, titled "{page.results_title}".'
    if page.page_type == "products":
        bits = [f"{k} = {v!r}" for k, v in (
            ("category", page.category), ("subcategory", page.subcategory),
            ("theme", page.theme), ("search", page.search),
        ) if v]
        return "The shopper is browsing the products page" + (f" filtered by {', '.join(bits)}." if bits else " (all products).")
    if page.page_type == "home":
        return "The shopper is on the home page."
    return f"The shopper is on the page {page.path!r}."


@lru_cache(maxsize=1)
def build_agent() -> Agent[ChatDeps, AgentReply]:
    agent = Agent(
        get_model(),
        deps_type=ChatDeps,
        output_type=AgentReply,
        instructions=PROMPT_PATH.read_text(encoding="utf-8"),
        tools=TOOLS,
        retries=2,
    )

    @agent.instructions
    def customer_context(ctx: RunContext[ChatDeps]) -> str:
        c = ctx.deps.customer
        if c:
            return (
                f"## Who you're talking to\nA signed-in customer: {c.first_name} {c.last_name} "
                f"(email {c.email}, member since {c.member_since}). Greet them by first name when it feels natural. "
                "Your earlier conversation with them is in the message history; refer back to it when helpful."
            )
        return (
            "## Who you're talking to\nA guest (not signed in). You don't know their name or email. "
            "You may mention that creating an account saves their chat, but don't nag."
        )

    @agent.instructions
    def page_context(ctx: RunContext[ChatDeps]) -> str:
        return "## Where they are on the site\n" + _page_summary(ctx.deps)

    @agent.tool
    def get_my_account(ctx: RunContext[ChatDeps]) -> CustomerProfile | str:
        """Return the signed-in shopper's account details (name, email, member since).

        Use when they ask things like "what email is my account under?" or "who am I logged in as?".
        """
        return ctx.deps.customer or "The shopper is not signed in, so there is no account to look up."

    @agent.tool
    def get_viewed_product(ctx: RunContext[ChatDeps]) -> ProductDetails | str:
        """Return full details and per-size stock for the product on the page the shopper is viewing.

        Use when they say "this", "it" or "this one" while on a product page.
        """
        if ctx.deps.viewed is None:
            return "The shopper is not on a single-product page. Ask which item they mean, or search for it."
        return get_product_details(ctx.deps.viewed.product_id)

    return agent


def _to_history(turns: list[ChatTurn]) -> list[ModelMessage]:
    """Convert prior chat turns into Pydantic AI message history."""
    history: list[ModelMessage] = []
    for turn in turns:
        if turn.role == "user":
            history.append(ModelRequest(parts=[UserPromptPart(content=turn.content)]))
        else:
            history.append(ModelResponse(parts=[TextPart(content=turn.content)]))
    return history


def _iso(dt: datetime | None = None) -> str:
    return (dt or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat(timespec="milliseconds")


def _page_label(deps: ChatDeps) -> str:
    page = deps.page.page_type
    return f"{page}:{deps.page.product_id}" if deps.page.product_id else page


def _tool_entries(run_id: str, messages: list[ModelMessage]) -> list[AuditEntry]:
    """One tool_call entry per tool the model called, paired with its return or retry."""
    returns: dict[str, ToolReturnPart | RetryPromptPart] = {}
    for msg in messages:
        if isinstance(msg, ModelRequest):
            for part in msg.parts:
                if isinstance(part, (ToolReturnPart, RetryPromptPart)) and part.tool_call_id:
                    returns[part.tool_call_id] = part
    entries: list[AuditEntry] = []
    for msg in messages:
        if not isinstance(msg, ModelResponse):
            continue
        for part in msg.parts:
            if not isinstance(part, ToolCallPart):
                continue
            ret = returns.get(part.tool_call_id)
            status, result, duration = "ok", None, None
            if isinstance(ret, RetryPromptPart):
                status, result = "retry", audit_short(ret.content)
            elif isinstance(ret, ToolReturnPart):
                result = audit_short(ret.content)
            if ret is not None and ret.timestamp and msg.timestamp:
                duration = max(0, int((ret.timestamp - msg.timestamp).total_seconds() * 1000))
            entries.append(AuditEntry(
                run_id=run_id,
                event="tool_call",
                time=_iso(msg.timestamp),
                tool=part.tool_name,
                tool_kind=getattr(part, "tool_kind", None) or ("output" if part.tool_name == "final_result" else "function"),
                args=audit_short(part.args_as_dict() if hasattr(part, "args_as_dict") else part.args),
                result=result,
                status=status,
                duration_ms=duration,
            ))
    return entries


async def answer(message: str, history: list[ChatTurn], deps: ChatDeps, user_label: str = "guest") -> AgentReply:
    """Run the agent for one shopper message, audit every step, return its structured reply."""
    run_id = uuid.uuid4().hex[:12]
    started = time.perf_counter()
    prior = _to_history(history)
    append_audit([AuditEntry(
        run_id=run_id, event="run_start", time=_iso(),
        user=user_label, page=_page_label(deps), message=audit_short(message, 80),
    )])

    end = AuditEntry(run_id=run_id, event="run_end", time="")
    with capture_run_messages() as captured:
        try:
            result = await build_agent().run(message, deps=deps, message_history=prior, usage_limits=AGENT_LIMITS)
            reply = result.output
            usage = result.usage() if callable(result.usage) else result.usage
            end.stop_reason = "final_output"
            end.requests, end.tool_calls = usage.requests, usage.tool_calls
            end.input_tokens, end.output_tokens = usage.input_tokens, usage.output_tokens
            end.products_shown, end.show_on_page = len(reply.product_ids), reply.show_on_page
            return reply
        except UsageLimitExceeded as exc:
            end.stop_reason = f"usage_limit: {audit_short(exc, 120)}"
            raise
        except Exception as exc:
            end.stop_reason = f"error: {exc.__class__.__name__}: {audit_short(exc, 100)}"
            raise
        finally:
            new_messages = list(captured)[len(prior):]
            responses = [m for m in new_messages if isinstance(m, ModelResponse)]
            if responses and responses[-1].finish_reason:
                end.finish_reason = str(responses[-1].finish_reason)
            end.time = _iso()
            end.duration_ms = int((time.perf_counter() - started) * 1000)
            append_audit(_tool_entries(run_id, new_messages) + [end])
