from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from api.routes import router
from config.settings import settings
from utils.helpers import log_info, log_error, validate_google_api_key
import uvicorn


# Validate configuration on startup
def validate_configuration():
    """Validate server configuration"""
    if not validate_google_api_key(settings.google_api_key):
        raise ValueError(
            "Invalid or missing GOOGLE_API_KEY. Please set it in your .env file.\n"
            "Get your API key from: https://ai.google.dev/gemini-api/docs/api-key"
        )

    log_info("✅ Configuration validated successfully")


# Create FastAPI app
app = FastAPI(
    title="Yukti Multi-Agent Server",
    description="AI-powered browser behavior analysis with LangGraph multi-agent system powered by Google Gemini",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)


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
    try:
        validate_configuration()

        log_info("\n" + "=" * 60)
        log_info("🚀 Yukti Multi-Agent Server Starting...")
        log_info("=" * 60)
        log_info(f"📡 Server: http://{settings.host}:{settings.port}")
        log_info(f"📚 API Docs: http://{settings.host}:{settings.port}/docs")
        log_info(f"🤖 Using Google Gemini Models (1M token context):")
        log_info(f"   - Analyzer: {settings.analyzer_model}")
        log_info(f"   - Predictor: {settings.predictor_model}")
        log_info(f"   - Suggestion: {settings.suggestion_model}")
        log_info(f"   - Action: {settings.action_model}")
        log_info(f"   - Supervisor: {settings.supervisor_model}")
        log_info(f"🔧 Debug Mode: {settings.debug}")
        log_info("=" * 60 + "\n")

    except Exception as e:
        log_error(f"❌ Startup Error: {str(e)}")
        raise


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Run on server shutdown"""
    log_info("\n" + "=" * 60)
    log_info("👋 Yukti Multi-Agent Server Shutting Down...")
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
