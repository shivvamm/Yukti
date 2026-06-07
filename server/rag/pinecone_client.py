"""Thin wrapper around the Pinecone SDK using integrated embeddings.

We use Pinecone's hosted inference: upsert raw text + metadata, query by
text. Pinecone embeds server-side via the model configured at
index-creation time. No embedding round-trip lives in our code.
"""

from dataclasses import dataclass
from typing import Any, Iterable

from pinecone import Pinecone

from config.settings import settings
from rag.formatter import FormattedRecord

_pinecone: Pinecone | None = None
_index = None


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
    _index_handle().upsert_records(
        namespace=settings.pinecone_namespace,
        records=payload,
    )
    return {"indexed": len(records_list)}


@dataclass(frozen=True)
class QueryHit:
    id: str
    score: float
    values_text: str
    metadata: dict[str, Any]


def query(text: str, user_id: str, top_k: int = 8) -> list[QueryHit]:
    """Query Pinecone by text, scoped to the given user_id via metadata filter.

    The user_id filter is mandatory — without it, the result set would
    include other users' vectors that share the same namespace.
    """
    response = _index_handle().search(
        namespace=settings.pinecone_namespace,
        inputs={"text": text},
        top_k=top_k,
        filter={"user_id": {"$eq": user_id}},
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
