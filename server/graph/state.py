from typing import TypedDict, List, Dict, Any, Optional
from models.schemas import (
    UserInteraction,
    AnalysisResult,
    PredictionResult,
    SuggestionResult,
    ActionResult,
    SupervisorDecision
)


class AgentState(TypedDict):
    """
    State that flows through the NEW intent-focused workflow.
    Each agent reads from and writes to this state.
    """

    # Input data
    interactions: List[Dict[str, Any]]  # User interaction history
    current_url: str  # Current page URL
    page_content: str  # Visible text content of current page
    tab_id: Optional[int]  # Current tab ID
    timestamp: int  # Request timestamp

    # Context Builder outputs
    session_context: Optional[Dict[str, Any]]  # Rich session context
    context_complete: bool  # Context builder finished flag

    # Intent Analyzer outputs (redesigned analyzer)
    intent_analysis: Optional[Dict[str, Any]]  # Deep intent analysis
    analyzer_complete: bool  # Intent analyzer finished flag

    # Suggestion outputs
    suggestions: List[str]  # Generated suggestions (single item)
    suggestion_reasoning: str  # Why this suggestion
    suggestion_priority: str  # Priority level (high/medium/low)
    suggestion_complete: bool  # Suggestion finished flag

    # Overall state
    confidence: float  # Overall confidence score
    errors: List[str]  # Any errors encountered
    processing_complete: bool  # All processing complete


def create_initial_state(
    interactions: List[Dict[str, Any]],
    current_url: str,
    page_content: str = "",
    tab_id: Optional[int] = None,
    timestamp: Optional[int] = None
) -> AgentState:
    """
    Create initial state for the NEW workflow

    Args:
        interactions: List of user interactions
        current_url: Current page URL
        page_content: Visible text content of current page
        tab_id: Optional tab ID
        timestamp: Optional timestamp

    Returns:
        Initial AgentState
    """
    import time

    return AgentState(
        # Input data
        interactions=interactions,
        current_url=current_url,
        page_content=page_content,
        tab_id=tab_id,
        timestamp=timestamp or int(time.time() * 1000),

        # Context Builder
        session_context=None,
        context_complete=False,

        # Intent Analyzer
        intent_analysis=None,
        analyzer_complete=False,

        # Suggestion
        suggestions=[],
        suggestion_reasoning="",
        suggestion_priority="medium",
        suggestion_complete=False,

        # Overall
        confidence=0.0,
        errors=[],
        processing_complete=False
    )


def extract_response(state: AgentState) -> Dict[str, Any]:
    """
    Extract final response from state (NEW format)

    Args:
        state: Final agent state

    Returns:
        Response dictionary optimized for frontend
    """
    intent_analysis = state.get("intent_analysis", {})
    session_context = state.get("session_context", {})

    return {
        "success": len(state.get("errors", [])) == 0,
        "suggestions": state.get("suggestions", []),
        "confidence": state.get("confidence", 0.0) or intent_analysis.get("confidence", 0.0),
        "intent": intent_analysis.get("primary_intent", "Unknown"),
        "user_stage": intent_analysis.get("user_stage", "exploring"),
        "reasoning": state.get("suggestion_reasoning", ""),
        "priority": state.get("suggestion_priority", "medium"),
        "timestamp": state.get("timestamp"),
        # Optional detailed info for debugging
        "debug": {
            "session_goal": session_context.get("current_goal", ""),
            "is_stuck": intent_analysis.get("is_user_stuck", False),
            "emotional_state": intent_analysis.get("emotional_state", "neutral")
        }
    }
