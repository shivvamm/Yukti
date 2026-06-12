"""Request/response schemas for the Yukti server.

Only the endpoints used by the extension are defined here:
  /health    → HealthResponse
  /api/index → IndexRequest, IndexResponse
  /api/chat  → ChatRequest, ChatResponse
"""

from typing import Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str


# ── /api/index ──────────────────────────────────────────────────────────


class IndexRequest(BaseModel):
    user_id: str = Field(..., description="Per-install UUID. Scopes the Pinecone namespace.")
    interactions: list[dict[str, Any]] = Field(
        ..., description="Recent interactions to upsert into the RAG vector store."
    )
    current_url: str | None = None
    tab_id: int | None = None


class IndexResponse(BaseModel):
    success: bool
    indexed: int
    skipped: int = 0
    error: str | None = None


# ── /api/chat ───────────────────────────────────────────────────────────


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    user_id: str = Field(..., description="Per-install UUID. Scopes the Pinecone namespace.")
    question: str
    current_url: str = ""
    current_page_text: str = ""
    chat_history: list[ChatTurn] = []


class ChatSource(BaseModel):
    url: str
    timestamp: int
    snippet: str


class ChatResponse(BaseModel):
    success: bool
    answer: str | None = None
    sources: list[ChatSource] = []
    error: str | None = None
    retry_after: int | None = None


# ── /api/forget ─────────────────────────────────────────────────────────


class ForgetRequest(BaseModel):
    user_id: str = Field(..., description="Per-install UUID whose vectors to delete.")


class ForgetResponse(BaseModel):
    success: bool
    error: str | None = None


class ForgetItemRequest(BaseModel):
    user_id: str = Field(..., description="Per-install UUID that owns the vector.")
    interaction: dict[str, Any] = Field(..., description="Raw interaction to delete.")
