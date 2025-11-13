from langgraph.graph import StateGraph, END
from graph.state import AgentState, create_initial_state, extract_response
from agents.analyzer import run_analyzer
from agents.predictor import run_predictor
from agents.suggestion import run_suggestion
from agents.action import run_action
from agents.supervisor import run_supervisor
from typing import Dict, Any, List


def create_workflow() -> StateGraph:
    """
    Create the LangGraph workflow connecting all agents

    Workflow flow:
    START → Analyzer → Predictor → Suggestion → Action → Supervisor → END

    Returns:
        Compiled StateGraph workflow
    """

    # Create the state graph
    workflow = StateGraph(AgentState)

    # Add all agent nodes
    workflow.add_node("analyzer", run_analyzer)
    workflow.add_node("predictor", run_predictor)
    workflow.add_node("suggestion", run_suggestion)
    workflow.add_node("action", run_action)
    workflow.add_node("supervisor", run_supervisor)

    # Define the flow: linear pipeline with supervisor at the end
    workflow.set_entry_point("analyzer")
    workflow.add_edge("analyzer", "predictor")
    workflow.add_edge("predictor", "suggestion")
    workflow.add_edge("suggestion", "action")
    workflow.add_edge("action", "supervisor")
    workflow.add_edge("supervisor", END)

    # Compile the workflow
    app = workflow.compile()

    print("✅ LangGraph workflow created successfully")
    print("   Flow: Analyzer → Predictor → Suggestion → Action → Supervisor")

    return app


# Global workflow instance
workflow_app = create_workflow()


async def run_analysis_workflow(
    interactions: List[Dict[str, Any]],
    current_url: str,
    tab_id: int = None
) -> Dict[str, Any]:
    """
    Run the complete multi-agent analysis workflow

    Args:
        interactions: List of user interactions
        current_url: Current page URL
        tab_id: Optional tab ID

    Returns:
        Analysis response dictionary
    """
    try:
        print(f"\n{'='*60}")
        print(f"🚀 Starting Multi-Agent Analysis Workflow")
        print(f"   URL: {current_url}")
        print(f"   Interactions: {len(interactions)}")
        print(f"{'='*60}\n")

        # Create initial state
        initial_state = create_initial_state(
            interactions=interactions,
            current_url=current_url,
            tab_id=tab_id
        )

        # Run the workflow
        final_state = await workflow_app.ainvoke(initial_state)

        # Extract response
        response = extract_response(final_state)

        print(f"\n{'='*60}")
        print(f"✅ Workflow Complete")
        print(f"   Suggestions: {len(response.get('suggestions', []))}")
        print(f"   Actions: {len(response.get('actions', []))}")
        print(f"   Confidence: {response.get('confidence', 0.0):.2f}")
        print(f"{'='*60}\n")

        return response

    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ Workflow Error: {str(e)}")
        print(f"{'='*60}\n")

        # Return error response
        return {
            "success": False,
            "suggestions": [],
            "actions": [],
            "confidence": 0.0,
            "error": str(e)
        }


def get_workflow_graph_visualization() -> str:
    """
    Get a text visualization of the workflow graph

    Returns:
        ASCII visualization of the workflow
    """
    visualization = """
    Multi-Agent Analysis Workflow
    =============================

    ┌─────────┐
    │  START  │
    └────┬────┘
         │
         ▼
    ┌─────────────┐
    │  ANALYZER   │ ← Analyzes behavior patterns
    │  (Llama 8B) │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  PREDICTOR  │ ← Predicts next actions
    │  (Llama 8B) │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ SUGGESTION  │ ← Generates suggestions
    │ (Llama 70B) │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │   ACTION    │ ← Determines actions
    │ (Llama 70B) │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ SUPERVISOR  │ ← Makes final decision
    │ (Llama 70B) │
    └──────┬──────┘
           │
           ▼
    ┌─────────┐
    │   END   │
    └─────────┘
    """
    return visualization
