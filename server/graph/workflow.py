from langgraph.graph import StateGraph, END
from graph.state import AgentState, create_initial_state, extract_response
from agents.context_builder import run_context_builder
from agents.analyzer import run_analyzer
from agents.suggestion import run_suggestion
from typing import Dict, Any, List


def create_workflow() -> StateGraph:
    """
    Create the LangGraph workflow connecting all agents

    NEW SIMPLIFIED WORKFLOW:
    START → Context Builder → Intent Analyzer → Suggestion → END

    Context Builder: Extracts session context from ALL interactions
    Intent Analyzer: Deeply understands user's real intent and goals
    Suggestion: Provides ONE powerful, actionable suggestion

    Returns:
        Compiled StateGraph workflow
    """

    # Create the state graph
    workflow = StateGraph(AgentState)

    # Add agent nodes (new 3-agent architecture)
    workflow.add_node("context_builder", run_context_builder)
    workflow.add_node("intent_analyzer", run_analyzer)  # Redesigned as intent analyzer
    workflow.add_node("suggestion", run_suggestion)

    # Define the flow: Context → Intent → Suggestion
    workflow.set_entry_point("context_builder")
    workflow.add_edge("context_builder", "intent_analyzer")
    workflow.add_edge("intent_analyzer", "suggestion")
    workflow.add_edge("suggestion", END)

    # Compile the workflow
    app = workflow.compile()

    print("✅ LangGraph workflow created successfully")
    print("   Flow: Context Builder → Intent Analyzer → Suggestion Agent")
    print("   Focus: Deep intent understanding → Actionable help")

    return app


# Global workflow instance
workflow_app = create_workflow()


async def run_analysis_workflow(
    interactions: List[Dict[str, Any]],
    current_url: str,
    page_content: str = "",
    tab_id: int = None
) -> Dict[str, Any]:
    """
    Run the complete multi-agent analysis workflow

    Args:
        interactions: List of user interactions
        current_url: Current page URL
        page_content: Visible text content of current page
        tab_id: Optional tab ID

    Returns:
        Analysis response dictionary
    """
    try:
        print(f"\n{'='*60}")
        print(f"🚀 Starting Multi-Agent Analysis Workflow")
        print(f"   URL: {current_url}")
        print(f"   Interactions: {len(interactions)}")
        print(f"   Page content: {len(page_content)} characters")
        print(f"{'='*60}\n")

        # Create initial state
        initial_state = create_initial_state(
            interactions=interactions,
            current_url=current_url,
            page_content=page_content,
            tab_id=tab_id
        )

        # Run the workflow
        final_state = await workflow_app.ainvoke(initial_state)

        # Extract response
        response = extract_response(final_state)

        print(f"\n{'='*60}")
        print(f"✅ Workflow Complete")
        print(f"   Suggestions: {len(response.get('suggestions', []))}")
        print(f"   User Intent: {response.get('intent', 'Unknown')}")
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
    NEW Intent-Focused Multi-Agent Workflow
    =======================================

    ┌─────────────────┐
    │     START       │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────────────┐
    │   CONTEXT BUILDER       │ ← Analyzes ALL interactions
    │   (Gemini 2.5 Flash)    │   Extracts session context
    │   1M token context      │   User journey tracking
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │   INTENT ANALYZER       │ ← Deep psychological analysis
    │   (Gemini 2.5 Pro)      │   Understands REAL user goals
    │   Advanced reasoning    │   Detects if stuck/confused
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │   SUGGESTION AGENT      │ ← ONE powerful suggestion
    │   (Gemini 2.5 Pro)      │   Actionable help
    │   Contextual insight    │   Unblocks users
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────┐
    │      END        │
    └─────────────────┘

    KEY IMPROVEMENTS:
    • Full session context (not just 20 interactions)
    • Deep intent understanding (not surface patterns)
    • Actionable suggestions (not generic tips)
    • Focused on user's actual goals
    """
    return visualization
