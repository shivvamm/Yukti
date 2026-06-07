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

NAMESPACE = "default"

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


def upsert_texts(records: Iterable[FormattedRecord]) -> dict[str, int]:
    """Upsert FormattedRecords to Pinecone. Returns {indexed: N}."""
    records_list = list(records)
    if not records_list:
        return {"indexed": 0}

    payload = [
        {"_id": r.id, "values_text": r.values_text, **r.metadata}
        for r in records_list
    ]
    _index_handle().upsert_records(NAMESPACE, payload)
    return {"indexed": len(records_list)}


@dataclass(frozen=True)
class QueryHit:
    id: str
    score: float
    values_text: str
    metadata: dict[str, Any]


def query(text: str, top_k: int = 8) -> list[QueryHit]:
    """Query Pinecone by text. Returns top_k QueryHits."""
    response = _index_handle().search(
        NAMESPACE,
        {"inputs": {"text": text}, "top_k": top_k},
        fields=["values_text", "url", "tab_title", "timestamp", "type",
                "element_text", "element_type", "input_name", "input_value"],
    )
    hits_raw = response.get("result", {}).get("hits", [])
    return [
        QueryHit(
            id=h["_id"],
            score=h["_score"],
            values_text=h["fields"].get("values_text", ""),
            metadata={k: v for k, v in h["fields"].items() if k != "values_text"},
        )
        for h in hits_raw
    ]
