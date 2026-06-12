"""HTTP routes for Yukti.

  GET  /health      → liveness
  POST /api/index   → upsert interactions into Pinecone
  POST /api/chat    → answer a question using RAG over Pinecone + live page DOM
"""

from datetime import datetime, timezone
import json
import math
import re
import threading
import time

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from config.settings import settings
from models.schemas import (
    HealthResponse,
    IndexRequest, IndexResponse,
    ChatRequest, ChatResponse, ChatSource,
    ForgetRequest, ForgetResponse, ForgetItemRequest,
)
from rag import chat as chat_module
from rag import pinecone_client
from rag.formatter import format as format_interaction
from utils.helpers import RequestLogger, log_info

_DEFAULT_RETRY_SECONDS = 60


def _sse(obj: dict) -> str:
    """Encode a dict as a Server-Sent Events `data:` line."""
    return f"data: {json.dumps(obj)}\n\n"


# ── Global daily budget ─────────────────────────────────────────────
# Resets at midnight UTC. In-memory — resets on server restart too.

class _DailyBudget:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._chat_count = 0
        self._index_count = 0
        self._date = datetime.now(timezone.utc).date()

    def _maybe_reset(self) -> None:
        today = datetime.now(timezone.utc).date()
        if today != self._date:
            self._chat_count = 0
            self._index_count = 0
            self._date = today

    def try_chat(self) -> bool:
        with self._lock:
            self._maybe_reset()
            if self._chat_count >= settings.daily_chat_limit:
                return False
            self._chat_count += 1
            return True

    def try_index(self) -> bool:
        with self._lock:
            self._maybe_reset()
            if self._index_count >= settings.daily_index_limit:
                return False
            self._index_count += 1
            return True

    @property
    def chat_remaining(self) -> int:
        with self._lock:
            self._maybe_reset()
            return max(0, settings.daily_chat_limit - self._chat_count)

    @property
    def index_remaining(self) -> int:
        with self._lock:
            self._maybe_reset()
            return max(0, settings.daily_index_limit - self._index_count)


_budget = _DailyBudget()


def _seconds_until_midnight_utc() -> int:
    now = datetime.now(timezone.utc)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    midnight += __import__("datetime").timedelta(days=1)
    return int((midnight - now).total_seconds())


def _coarse_time_range(question: str) -> tuple[int, int] | None:
    """Map obvious timeframe words to a [start, now] ms range. Conservative —
    returns None when the question has no clear timeframe."""
    q = question.lower()
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    day = 86_400_000
    if "today" in q:
        return (now_ms - day, now_ms)
    if "yesterday" in q:
        return (now_ms - 2 * day, now_ms)
    if "last week" in q or "past week" in q or "this week" in q:
        return (now_ms - 7 * day, now_ms)
    if "last month" in q or "past month" in q:
        return (now_ms - 30 * day, now_ms)
    return None


def _extract_retry_seconds(exc: Exception) -> int | None:
    """Try to pull the retry-after value from the actual exception object.

    Each LLM provider surfaces rate-limit info differently:
      - OpenAI:  openai.RateLimitError  →  response.headers["retry-after-ms"] (ms)
                                           or "retry-after" (seconds)
      - Groq:    groq.RateLimitError    →  response.headers["retry-after"] (seconds)
      - Mistral: httpx.HTTPStatusError  →  response.headers["Retry-After"] (seconds)
      - Gemini:  ClientError / ChatGoogleGenerativeAIError
                 → no header, "retryDelay": "53s" embedded in JSON body string
    """
    # OpenAI / Groq — both have e.response.headers
    resp = getattr(exc, "response", None)
    if resp is not None:
        headers = getattr(resp, "headers", {})
        # OpenAI non-standard header (milliseconds)
        ms = headers.get("retry-after-ms")
        if ms:
            return max(1, math.ceil(int(ms) / 1000))
        # Standard header (seconds) — Groq & Mistral
        secs = headers.get("retry-after") or headers.get("Retry-After")
        if secs:
            return int(secs)

    # Gemini — retryDelay embedded in error string like "retryDelay": "53s"
    msg = str(exc)
    m = re.search(r'"retryDelay"\s*:\s*"(\d+)s?"', msg)
    if m:
        return int(m.group(1))
    # OpenAI message fallback: "Please try again in 3s."
    m = re.search(r"try again in (\d+)\s*s", msg, re.IGNORECASE)
    if m:
        return int(m.group(1))

    return None


def _is_rate_limit_error(exc: Exception) -> bool:
    """Detect rate-limit errors across all supported LLM providers."""
    # OpenAI: openai.RateLimitError
    cls_name = type(exc).__name__
    if cls_name == "RateLimitError":
        return True

    # Mistral: httpx.HTTPStatusError with status 429
    status = getattr(getattr(exc, "response", None), "status_code", None)
    if status == 429:
        return True

    # Gemini: ClientError / ChatGoogleGenerativeAIError with "429" or "RESOURCE_EXHAUSTED"
    msg = str(exc).lower()
    if "resource_exhausted" in msg:
        return True
    if "429" in msg and ("rate" in msg or "quota" in msg or "exhausted" in msg):
        return True

    return False


limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="2.0.0",
    )


@router.get("/health/budget")
async def budget_status():
    """Check remaining daily budget. Useful for monitoring."""
    return {
        "chat_remaining": _budget.chat_remaining,
        "chat_limit": settings.daily_chat_limit,
        "index_remaining": _budget.index_remaining,
        "index_limit": settings.daily_index_limit,
        "resets_in_seconds": _seconds_until_midnight_utc(),
    }


@router.post("/api/index", response_model=IndexResponse)
@limiter.limit("30/minute")
async def index_interactions(request: Request, body: IndexRequest) -> IndexResponse:
    """Vectorize and upsert interactions into Pinecone."""
    if not _budget.try_index():
        return IndexResponse(
            success=False, indexed=0, skipped=0,
            error=f"Daily index limit reached ({settings.daily_index_limit}). Resets at midnight UTC.",
        )

    start = time.time()
    try:
        RequestLogger.log_request("/api/index", "POST",
                                  {"interactions": len(body.interactions),
                                   "user_id": body.user_id[:8]})

        records = []
        skipped = 0
        for raw in body.interactions:
            record = format_interaction(raw)
            if record is None:
                skipped += 1
                continue
            records.append(record)

        result = pinecone_client.upsert_texts(records, user_id=body.user_id)
        elapsed_ms = (time.time() - start) * 1000
        RequestLogger.log_response("/api/index", 200, elapsed_ms)
        log_info(f"   Indexed: {result['indexed']}, skipped: {skipped}")

        return IndexResponse(success=True, indexed=result["indexed"], skipped=skipped)

    except Exception as e:
        elapsed_ms = (time.time() - start) * 1000
        RequestLogger.log_error("/api/index", e)
        RequestLogger.log_response("/api/index", 502, elapsed_ms)
        return IndexResponse(success=False, indexed=0, skipped=0, error=str(e))


@router.post("/api/chat", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    """Answer a question grounded in current page DOM + RAG retrieval."""
    if not _budget.try_chat():
        secs = _seconds_until_midnight_utc()
        return ChatResponse(
            success=False, answer=None, sources=[],
            retry_after=secs,
        )

    start = time.time()
    try:
        RequestLogger.log_request("/api/chat", "POST",
                                  {"question_len": len(body.question),
                                   "page_text_len": len(body.current_page_text),
                                   "user_id": body.user_id[:8]})

        # 1) Retrieve from Pinecone. Tolerate failures — still answer with page context.
        try:
            tr = _coarse_time_range(body.question)
            retrieved = pinecone_client.query(
                text=body.question, user_id=body.user_id, top_k=8, time_range=tr,
            )
        except Exception as e:
            log_info(f"   ⚠️  Pinecone query failed: {e}")
            retrieved = []

        # 2) Ask the LLM
        result = chat_module.answer(
            question=body.question,
            current_url=body.current_url,
            current_page_text=body.current_page_text,
            chat_history=[t.model_dump() for t in body.chat_history],
            retrieved=retrieved,
        )

        elapsed_ms = (time.time() - start) * 1000
        RequestLogger.log_response("/api/chat", 200, elapsed_ms)

        sources = [
            ChatSource(url=s.url, timestamp=s.timestamp, snippet=s.snippet)
            for s in result.sources
        ]
        return ChatResponse(success=True, answer=result.answer, sources=sources)

    except Exception as e:
        elapsed_ms = (time.time() - start) * 1000
        RequestLogger.log_error("/api/chat", e)

        if _is_rate_limit_error(e):
            retry = _extract_retry_seconds(e) or _DEFAULT_RETRY_SECONDS
            RequestLogger.log_response("/api/chat", 429, elapsed_ms)
            return ChatResponse(
                success=False,
                answer=None,
                sources=[],
                retry_after=retry,
            )

        RequestLogger.log_response("/api/chat", 502, elapsed_ms)
        return ChatResponse(success=False, answer=None, sources=[], error=str(e))


@router.post("/api/chat/stream")
@limiter.limit("10/minute")
async def chat_stream(request: Request, body: ChatRequest):
    """Stream a chat answer token-by-token as Server-Sent Events.

    Emits `data: <json>` lines:
      {"delta": "..."}        incremental text
      {"sources": [...]}      retrieved sources (sent once, up front)
      {"done": true}          end of stream
      {"error": "..."}        terminal error / rate-limit (with retry_after)
    """
    if not _budget.try_chat():
        secs = _seconds_until_midnight_utc()

        async def limited():
            yield _sse({"error": "rate_limit", "retry_after": secs})

        return StreamingResponse(limited(), media_type="text/event-stream")

    try:
        retrieved = pinecone_client.query(
            text=body.question, user_id=body.user_id, top_k=8,
            time_range=_coarse_time_range(body.question),
        )
    except Exception as e:
        log_info(f"   ⚠️  Pinecone query failed: {e}")
        retrieved = []

    sources = [
        {"url": h.metadata.get("url", "") or "",
         "timestamp": int(h.metadata.get("timestamp", 0) or 0),
         "snippet": (h.values_text[:80] + ("..." if len(h.values_text) > 80 else ""))}
        for h in retrieved
    ]

    def event_stream():
        yield _sse({"sources": sources})
        try:
            for delta in chat_module.answer_stream(
                question=body.question,
                current_url=body.current_url,
                current_page_text=body.current_page_text,
                chat_history=[t.model_dump() for t in body.chat_history],
                retrieved=retrieved,
            ):
                yield _sse({"delta": delta})
            yield _sse({"done": True})
        except Exception as e:  # noqa: BLE001
            RequestLogger.log_error("/api/chat/stream", e)
            if _is_rate_limit_error(e):
                retry = _extract_retry_seconds(e) or _DEFAULT_RETRY_SECONDS
                yield _sse({"error": "rate_limit", "retry_after": retry})
            else:
                yield _sse({"error": str(e)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/api/forget-item", response_model=ForgetResponse)
@limiter.limit("60/minute")
async def forget_item(request: Request, body: ForgetItemRequest) -> ForgetResponse:
    """Delete a single interaction's vector by reconstructing its deterministic id."""
    try:
        record = format_interaction(body.interaction)
        if record is None:
            # Never indexed (e.g. a scroll) — nothing to delete.
            return ForgetResponse(success=True)
        pinecone_client.delete_ids([record.id])
        return ForgetResponse(success=True)
    except Exception as e:  # noqa: BLE001
        RequestLogger.log_error("/api/forget-item", e)
        return ForgetResponse(success=False, error=str(e))


@router.post("/api/forget", response_model=ForgetResponse)
@limiter.limit("5/minute")
async def forget(request: Request, body: ForgetRequest) -> ForgetResponse:
    """Delete all of a user's vectors from Pinecone (right-to-be-forgotten)."""
    try:
        RequestLogger.log_request("/api/forget", "POST", {"user_id": body.user_id[:8]})
        pinecone_client.forget(body.user_id)
        return ForgetResponse(success=True)
    except Exception as e:  # noqa: BLE001
        RequestLogger.log_error("/api/forget", e)
        return ForgetResponse(success=False, error=str(e))


@router.get("/")
async def root():
    return {
        "name": "Yukti RAG Chat Server",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "index": "/api/index",
            "chat": "/api/chat",
            "docs": "/docs",
        },
        "status": "running",
    }
