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
    State that flows through the LangGraph workflow.
    Each agent reads from and writes to this state.
    """

    # Input data
    interactions: List[Dict[str, Any]]  # User interaction history
    current_url: str  # Current page URL
    tab_id: Optional[int]  # Current tab ID
    timestamp: int  # Request timestamp

    # Analyzer outputs
    analysis: Optional[Dict[str, Any]]  # Analysis results
    analyzer_complete: bool  # Analyzer finished flag

    # Predictor outputs
    predictions: Optional[Dict[str, Any]]  # Prediction results
    predictor_complete: bool  # Predictor finished flag

    # Suggestion outputs
    suggestions: List[str]  # Generated suggestions
    suggestion_priority: str  # Priority level
    suggestion_complete: bool  # Suggestion finished flag

    # Action outputs
    actions: List[Dict[str, Any]]  # Suggested actions
    action_complete: bool  # Action finished flag

    # Supervisor outputs
    supervisor_decision: Optional[Dict[str, Any]]  # Final decision
    should_continue: bool  # Whether to continue processing
    final_reasoning: str  # Supervisor's reasoning

    # Overall state
    confidence: float  # Overall confidence score
    errors: List[str]  # Any errors encountered
    processing_complete: bool  # All processing complete


def create_initial_state(
    interactions: List[Dict[str, Any]],
    current_url: str,
    tab_id: Optional[int] = None,
    timestamp: Optional[int] = None
) -> AgentState:
    """
    Create initial state for the workflow

    Args:
        interactions: List of user interactions
        current_url: Current page URL
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
        tab_id=tab_id,
        timestamp=timestamp or int(time.time() * 1000),

        # Analyzer
        analysis=None,
        analyzer_complete=False,

        # Predictor
        predictions=None,
        predictor_complete=False,

        # Suggestion
        suggestions=[],
        suggestion_priority="medium",
        suggestion_complete=False,

        # Action
        actions=[],
        action_complete=False,

        # Supervisor
        supervisor_decision=None,
        should_continue=True,
        final_reasoning="",

        # Overall
        confidence=0.0,
        errors=[],
        processing_complete=False
    )


def extract_response(state: AgentState) -> Dict[str, Any]:
    """
    Extract final response from state

    Args:
        state: Final agent state

    Returns:
        Response dictionary
    """
    return {
        "success": len(state.get("errors", [])) == 0,
        "suggestions": state.get("suggestions", []),
        "actions": state.get("actions", []),
        "analysis": state.get("analysis"),
        "predictions": state.get("predictions"),
        "confidence": state.get("confidence", 0.0),
        "reasoning": state.get("final_reasoning", ""),
        "timestamp": state.get("timestamp")
    }
