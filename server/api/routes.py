from fastapi import APIRouter, HTTPException, status
from models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    HealthResponse,
    ErrorResponse,
    ActionRequest
)
from graph.workflow import run_analysis_workflow
from utils.helpers import RequestLogger, calculate_interaction_summary, log_info
from datetime import datetime
import time

# Create API router
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint

    Returns:
        Health status
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    )


@router.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_behavior(request: AnalyzeRequest):
    """
    Analyze user behavior and provide suggestions

    Args:
        request: Analysis request with user interactions

    Returns:
        Analysis response with suggestions and actions
    """
    start_time = time.time()

    try:
        RequestLogger.log_request("/api/analyze", "POST", {
            "interactions": len(request.interactions),
            "url": request.current_url
        })

        # Log interaction summary
        summary = calculate_interaction_summary([i.model_dump() for i in request.interactions])
        log_info(f"   Summary: {summary['total']} interactions, {summary['unique_urls']} URLs, {summary['most_common_action']} most common")

        # Convert Pydantic models to dicts for workflow
        interactions_list = [i.model_dump() for i in request.interactions]

        # Run multi-agent workflow
        result = await run_analysis_workflow(
            interactions=interactions_list,
            current_url=request.current_url,
            tab_id=request.tab_id
        )

        # Build response
        response = AnalyzeResponse(
            success=result.get("success", True),
            suggestions=result.get("suggestions", []),
            actions=result.get("actions", []),
            analysis=result.get("analysis"),
            predictions=result.get("predictions"),
            confidence=result.get("confidence", 0.0),
            reasoning=result.get("reasoning"),
            timestamp=int(datetime.now().timestamp() * 1000)
        )

        # Log response
        response_time = (time.time() - start_time) * 1000
        RequestLogger.log_response("/api/analyze", 200, response_time)

        return response

    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        RequestLogger.log_error("/api/analyze", e)
        RequestLogger.log_response("/api/analyze", 500, response_time)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/api/action")
async def log_action(request: ActionRequest):
    """
    Log action execution from extension

    Args:
        request: Action execution details

    Returns:
        Success response
    """
    try:
        RequestLogger.log_request("/api/action", "POST", {
            "action_type": request.action_type,
            "success": request.success
        })

        log_info(f"   Action logged: {request.action_type} ({'success' if request.success else 'failed'})")

        return {
            "success": True,
            "message": "Action logged successfully",
            "timestamp": int(datetime.now().timestamp() * 1000)
        }

    except Exception as e:
        RequestLogger.log_error("/api/action", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "Yukti Multi-Agent Server",
        "version": "1.0.0",
        "description": "AI-powered browser behavior analysis with LangGraph multi-agent system",
        "endpoints": {
            "health": "/health",
            "analyze": "/api/analyze",
            "log_action": "/api/action",
            "docs": "/docs"
        },
        "status": "running"
    }
