from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ============= Request Models =============

class UserInteraction(BaseModel):
    """Single user interaction event"""
    type: str = Field(..., description="Type of interaction (click, scroll, navigation, etc.)")
    timestamp: int = Field(..., description="Unix timestamp in milliseconds")
    url: str = Field(..., description="Page URL where interaction occurred")
    tabId: Optional[int] = Field(None, description="Browser tab ID")
    windowId: Optional[int] = Field(None, description="Browser window ID")
    elementType: Optional[str] = Field(None, description="HTML element type (button, input, etc.)")
    elementId: Optional[str] = Field(None, description="Element ID attribute")
    elementClass: Optional[str] = Field(None, description="Element class attribute")
    elementText: Optional[str] = Field(None, description="Text content of element")
    elementHTML: Optional[str] = Field(None, description="Full HTML of element")
    inputValue: Optional[str] = Field(None, description="Input field value")
    inputName: Optional[str] = Field(None, description="Input field name")
    scrollDepth: Optional[int] = Field(None, description="Scroll depth percentage")
    timeSpent: Optional[int] = Field(None, description="Time spent on page in milliseconds")
    tabTitle: Optional[str] = Field(None, description="Tab title")


class AnalyzeRequest(BaseModel):
    """Request to analyze user behavior"""
    interactions: List[UserInteraction] = Field(..., description="List of user interactions")
    current_url: str = Field(..., description="Current page URL")
    page_content: Optional[str] = Field(None, description="Visible text content of current page")
    tab_id: Optional[int] = Field(None, description="Current tab ID")
    timestamp: int = Field(default_factory=lambda: int(datetime.now().timestamp() * 1000))

    class Config:
        json_schema_extra = {
            "example": {
                "interactions": [
                    {
                        "type": "click",
                        "timestamp": 1699901234567,
                        "url": "https://example.com",
                        "elementType": "button",
                        "elementId": "submit-btn"
                    }
                ],
                "current_url": "https://example.com",
                "page_content": "Welcome to our site. Find the best deals on hotels...",
                "tab_id": 123,
                "timestamp": 1699901234567
            }
        }


class ActionRequest(BaseModel):
    """Request to log an action execution"""
    action_type: str = Field(..., description="Type of action executed")
    success: bool = Field(..., description="Whether action was successful")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional details")


# ============= Response Models =============

class AnalysisResult(BaseModel):
    """Result from analyzer agent"""
    frequent_actions: List[str] = Field(default_factory=list)
    time_pattern: str = Field(default="unknown")
    navigation_pattern: str = Field(default="unknown")
    user_intent: str = Field(default="browsing")


class PredictionResult(BaseModel):
    """Result from predictor agent"""
    next_likely_actions: List[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    predicted_pages: List[str] = Field(default_factory=list)


class SuggestionResult(BaseModel):
    """Result from suggestion agent"""
    suggestions: List[str] = Field(default_factory=list)
    priority: str = Field(default="medium")


class ActionResult(BaseModel):
    """Result from action agent"""
    type: str = Field(..., description="Action type: click, navigate, fill_form, etc.")
    target: Optional[str] = Field(None, description="Target selector or URL")
    value: Optional[str] = Field(None, description="Value for fill_form actions")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class SupervisorDecision(BaseModel):
    """Final decision from supervisor agent"""
    should_act: bool = Field(..., description="Whether to suggest actions")
    reasoning: str = Field(..., description="Explanation of decision")
    priority: str = Field(default="medium")


class AnalyzeResponse(BaseModel):
    """Response from analyze endpoint"""
    success: bool = Field(..., description="Whether analysis was successful")
    suggestions: List[str] = Field(default_factory=list, description="AI-generated suggestions")
    actions: List[ActionResult] = Field(default_factory=list, description="Suggested actions")
    analysis: Optional[AnalysisResult] = Field(None, description="Detailed analysis")
    predictions: Optional[PredictionResult] = Field(None, description="Behavior predictions")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Overall confidence score")
    reasoning: Optional[str] = Field(None, description="AI reasoning")
    timestamp: int = Field(default_factory=lambda: int(datetime.now().timestamp() * 1000))

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "suggestions": [
                    "You frequently visit this site in the evening. Consider bookmarking it.",
                    "Based on your scrolling pattern, you might be interested in the content below."
                ],
                "actions": [
                    {
                        "type": "navigate",
                        "target": "https://example.com/related-page",
                        "confidence": 0.85
                    }
                ],
                "confidence": 0.85,
                "timestamp": 1699901234567
            }
        }


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Server status")
    timestamp: str = Field(..., description="Current timestamp")
    version: str = Field(default="1.0.0", description="API version")


class ErrorResponse(BaseModel):
    """Error response"""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    timestamp: int = Field(default_factory=lambda: int(datetime.now().timestamp() * 1000))
