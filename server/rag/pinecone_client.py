"""Thin wrapper around the Pinecone SDK using integrated embeddings.

We use Pinecone's hosted inference: upsert raw text + metadata, query by
text. Pinecone embeds server-side via the model configured at
index-creation time. No embedding round-trip lives in our code.

Rate-limit handling: upserts retry with exponential backoff (tenacity).
If all retries exhaust, the records are buffered in memory and drained
on the next successful upsert call. Nothing surfaces to the user.
"""

import logging
import threading
from collections import deque
from dataclasses import dataclass
from typing import Any, Iterable

from pinecone import Pinecone, RateLimitError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

from config.settings import settings
from rag.formatter import FormattedRecord

logger = logging.getLogger(__name__)

_pinecone: Pinecone | None = None
_index = None

_pending_buffer: deque[list[dict]] = deque()
_buffer_lock = threading.Lock()


def _reset_for_tests() -> None:
    """Hook for tests: drop the module-level Pinecone client + index handle."""
    global _pinecone, _index
    _pinecone = None
    _index = None


def _client() -> Pinecone:
    global _pinecone
    if _pinecone is None:
        _pinecone = Pinecone(api_key=settings.pinecone_api_key)
    return _pinecone


def _index_handle():
    global _index
    if _index is None:
        _index = _client().Index(settings.pinecone_index_name)
    return _index


def ensure_index() -> None:
    """Create the configured index if it doesn't exist. Idempotent."""
    client = _client()
    if client.has_index(settings.pinecone_index_name):
        return
    client.create_index_for_model(
        name=settings.pinecone_index_name,
        cloud=settings.pinecone_cloud,
        region=settings.pinecone_region,
        embed={
            "model": settings.pinecone_embed_model,
            "field_map": {"text": "values_text"},
        },
    )


@retry(
    retry=retry_if_exception_type(RateLimitError),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def _upsert_batch(payload: list[dict]) -> None:
    _index_handle().upsert_records(
        namespace=settings.pinecone_namespace,
        records=payload,
    )


def _drain_buffer() -> int:
    """Try to flush any previously buffered records. Returns count flushed."""
    flushed = 0
    with _buffer_lock:
        while _pending_buffer:
            batch = _pending_buffer[0]
            try:
                _upsert_batch(batch)
                _pending_buffer.popleft()
                flushed += len(batch)
            except RateLimitError:
                break
    return flushed


def upsert_texts(records: Iterable[FormattedRecord], user_id: str) -> dict[str, int]:
    """Upsert FormattedRecords to Pinecone, stamping each with user_id.

    Records all live in the same namespace; per-user scoping is enforced
    at query time via a metadata filter on `user_id`.
    """
    records_list = list(records)
    if not records_list:
        return {"indexed": 0}

    payload = [
        {"_id": r.id, "values_text": r.values_text, "user_id": user_id, **r.metadata}
        for r in records_list
    ]

    drained = _drain_buffer()
    if drained:
        logger.info(f"Pinecone: flushed {drained} buffered records")

    try:
        _upsert_batch(payload)
    except RateLimitError:
        with _buffer_lock:
            _pending_buffer.append(payload)
        logger.warning(f"Pinecone: rate-limited, buffered {len(payload)} records ({len(_pending_buffer)} batches pending)")

    return {"indexed": len(records_list)}


def forget(user_id: str) -> dict[str, Any]:
    """Delete every vector belonging to a user (right-to-be-forgotten).

    Deletes by metadata filter on `user_id` within the shared namespace.

    NOTE: metadata-filtered delete is supported on pod-based indexes. On
    serverless indexes Pinecone does not support filtered delete; if this
    index is serverless, the proper fix is a per-user namespace scheme
    (namespace=user_id) so a whole-namespace delete can be used instead.
    We surface any such error to the caller rather than failing silently.
    """
    _index_handle().delete(
        filter={"user_id": {"$eq": user_id}},
        namespace=settings.pinecone_namespace,
    )
    return {"deleted": True}


def delete_ids(ids: list[str]) -> dict[str, Any]:
    """Delete specific vectors by id. Delete-by-id is serverless-safe."""
    if not ids:
        return {"deleted": 0}
    _index_handle().delete(ids=ids, namespace=settings.pinecone_namespace)
    return {"deleted": len(ids)}


@dataclass(frozen=True)
class QueryHit:
    id: str
    score: float
    values_text: str
    metadata: dict[str, Any]


def query(
    text: str,
    user_id: str,
    top_k: int = 8,
    time_range: tuple[int, int] | None = None,
) -> list[QueryHit]:
    """Query Pinecone by text, scoped to user_id, optionally within a time range.

    The user_id filter is mandatory — without it, the result set would
    include other users' vectors that share the same namespace.
    """
    metadata_filter: dict[str, Any] = {"user_id": {"$eq": user_id}}
    if time_range is not None:
        lo, hi = time_range
        metadata_filter["timestamp"] = {"$gte": lo, "$lte": hi}
    response = _index_handle().search(
        namespace=settings.pinecone_namespace,
        inputs={"text": text},
        top_k=top_k,
        filter=metadata_filter,
        fields=["values_text", "user_id", "url", "tab_title", "timestamp", "type",
                "element_text", "element_type", "input_name", "input_value"],
    )
    # Pinecone v9 returns a typed response object; coerce to dict for uniform parsing
    response_dict = response if isinstance(response, dict) else response.to_dict()
    hits_raw = response_dict.get("result", {}).get("hits", [])
    return [
        QueryHit(
            # Pinecone SDK has used both `_id`/`_score` (older) and `id_`/`score_`
            # (v9+). Read whichever is present.
            id=h.get("_id") or h.get("id_") or "",
            score=float(h.get("_score") or h.get("score_") or 0.0),
            values_text=h["fields"].get("values_text", ""),
            metadata={k: v for k, v in h["fields"].items() if k != "values_text"},
        )
        for h in hits_raw
    ]
