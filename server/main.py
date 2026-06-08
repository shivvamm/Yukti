from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from api.routes import router
from config.settings import settings
from utils.helpers import log_info, log_error
import uvicorn

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


# Create FastAPI app
app = FastAPI(
    title="Yukti RAG Chat Server",
    description="On-demand chat assistant grounded in browsing history (Pinecone RAG) + live page DOM",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins_list(),  # From settings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


# Include API routes
app.include_router(router)


# Startup event
@app.on_event("startup")
async def startup_event():
    """Run on server startup"""
    # Config validation already ran at config.settings import time; getting
    # here means it succeeded. Just log the startup banner.
    log_info("\n" + "=" * 60)
    log_info("🚀 Yukti RAG Chat Server Starting...")
    log_info("=" * 60)
    log_info(f"📡 Server: http://{settings.host}:{settings.port}")
    log_info(f"📚 API Docs: http://{settings.host}:{settings.port}/docs")
    log_info(f"🤖 LLM Provider: {settings.llm_provider}")
    log_info(f"   - Chat model: {settings.chat_model}")
    log_info(f"📦 Pinecone: {settings.pinecone_index_name} ({settings.pinecone_embed_model})")
    log_info(f"🔧 Debug Mode: {settings.debug}")
    log_info("=" * 60 + "\n")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Run on server shutdown"""
    log_info("\n" + "=" * 60)
    log_info("👋 Yukti RAG Chat Server Shutting Down...")
    log_info("=" * 60 + "\n")


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle all uncaught exceptions"""
    log_error(f"❌ Unhandled exception: {str(exc)}")

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.debug else "An error occurred",
            "timestamp": int(__import__("time").time() * 1000)
        }
    )


# Run server
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )
