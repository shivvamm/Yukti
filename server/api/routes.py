"""HTTP routes for Yukti.

  GET  /health      → liveness
  POST /api/index   → upsert interactions into Pinecone
  POST /api/chat    → answer a question using RAG over Pinecone + live page DOM
"""

from datetime import datetime
import time

from fastapi import APIRouter

from models.schemas import (
    HealthResponse,
    IndexRequest, IndexResponse,
    ChatRequest, ChatResponse, ChatSource,
)
from rag import chat as chat_module
from rag import pinecone_client
from rag.formatter import format as format_interaction
from utils.helpers import RequestLogger, log_info

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="2.0.0",
    )


@router.post("/api/index", response_model=IndexResponse)
async def index_interactions(request: IndexRequest) -> IndexResponse:
    """Vectorize and upsert interactions into Pinecone."""
    start = time.time()
    try:
        RequestLogger.log_request("/api/index", "POST",
                                  {"interactions": len(request.interactions)})

        records = []
        skipped = 0
        for raw in request.interactions:
            record = format_interaction(raw)
            if record is None:
                skipped += 1
                continue
            records.append(record)

        result = pinecone_client.upsert_texts(records)
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
async def chat(request: ChatRequest) -> ChatResponse:
    """Answer a question grounded in current page DOM + RAG retrieval."""
    start = time.time()
    try:
        RequestLogger.log_request("/api/chat", "POST",
                                  {"question_len": len(request.question),
                                   "page_text_len": len(request.current_page_text)})

        # 1) Retrieve from Pinecone. Tolerate failures — still answer with page context.
        try:
            retrieved = pinecone_client.query(text=request.question, top_k=8)
        except Exception as e:
            log_info(f"   ⚠️  Pinecone query failed: {e}")
            retrieved = []

        # 2) Ask the LLM
        result = chat_module.answer(
            question=request.question,
            current_url=request.current_url,
            current_page_text=request.current_page_text,
            chat_history=[t.model_dump() for t in request.chat_history],
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
        RequestLogger.log_response("/api/chat", 502, elapsed_ms)
        return ChatResponse(success=False, answer=None, sources=[], error=str(e))


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
