from langchain_core.messages import SystemMessage, HumanMessage
from graph.state import AgentState
from llm.factory import get_llm
import json
from typing import Dict, Any


class AnalyzerAgent:
    """
    Intent Analyzer Agent - Deep analysis of user intent and behavior
    Uses the configured LLM provider for advanced reasoning about user goals.
    """

    def __init__(self):
        self.llm = get_llm("analyzer")

    def analyze(self, state: AgentState) -> AgentState:
        """
        Deeply analyze user intent from session context

        Args:
            state: Current agent state with session context

        Returns:
            Updated state with intent analysis
        """
        try:
            session_context = state.get("session_context", {})
            current_url = state["current_url"]
            page_content = state.get("page_content", "")

            # Create intent analysis prompt
            prompt = self._create_intent_prompt(session_context, current_url, page_content)

            # Call LLM for deep intent analysis
            response = self.llm.invoke([
                SystemMessage(content=self._get_system_message()),
                HumanMessage(content=prompt)
            ])

            # Parse response
            intent_analysis = self._parse_response(response.content)

            # Update state
            state["intent_analysis"] = intent_analysis
            state["analyzer_complete"] = True

            print(f"✅ Intent Analyzer: User intent - {intent_analysis.get('primary_intent', 'Unknown')}")
            print(f"   Stage: {intent_analysis.get('user_stage', 'Unknown')}")
            print(f"   Confidence: {intent_analysis.get('confidence', 0)}")

        except Exception as e:
            import traceback
            print(f"❌ Intent Analyzer Error: {str(e)}")
            print(f"   Traceback: {traceback.format_exc()}")

            # Safely append error
            if "errors" not in state or state["errors"] is None:
                state["errors"] = []
            state["errors"].append(f"IntentAnalyzer: {str(e)}")

            state["intent_analysis"] = self._get_default_analysis()
            state["analyzer_complete"] = True

        return state

    def _get_system_message(self) -> str:
        """Get system message for intent analyzer"""
        return """You are an expert psychologist and UX researcher analyzing user behavior.

Your task is to deeply understand what the user is REALLY trying to accomplish and WHY.

Analyze:
1. PRIMARY INTENT - What is their main goal? (Be specific, not generic)
2. SUB-GOALS - What steps are they taking to achieve this?
3. USER STAGE - Where are they in their journey?
   - exploring: Just starting to research
   - comparing: Evaluating multiple options
   - deciding: Ready to make a decision but hesitant
   - executing: Taking action (booking, buying, etc.)
   - stuck: Confused or blocked
4. PAIN POINTS - What problems/friction are they experiencing?
5. UNDERSTANDING LEVEL - Do they know what they're doing or confused?
6. EMOTIONAL STATE - Frustrated? Patient? Excited? Bored?

Return ONLY valid JSON in this exact format:
{
    "primary_intent": "Book a hotel in Paris for July vacation under $150/night near attractions",
    "sub_goals": ["Compare hotel prices", "Check locations on map", "Read recent reviews"],
    "user_stage": "comparing",
    "pain_points": ["Prices differ across sites", "Can't see all options on map", "Unclear cancellation policies"],
    "understanding_level": "intermediate",
    "emotional_state": "slightly_frustrated",
    "confidence": 0.85,
    "is_user_stuck": false,
    "stuck_reason": null,
    "what_would_help": "Show price comparison tool or suggest best-rated hotels in budget"
}

Be insightful. Understand the human behind the clicks."""

    def _create_intent_prompt(self, session_context: dict, current_url: str, page_content: str) -> str:
        """Create intent analysis prompt"""

        current_goal = session_context.get("current_goal", "Unknown")
        research_topic = session_context.get("research_topic", "Unknown")
        user_stage = session_context.get("user_stage", "Unknown")
        pain_points = session_context.get("pain_points", [])
        accomplishments = session_context.get("accomplishments", [])
        key_interests = session_context.get("key_interests", [])
        raw_stats = session_context.get("raw_stats", {})

        pain_points_str = "\n".join(f"- {p}" for p in pain_points) if pain_points else "None detected"
        accomplishments_str = "\n".join(f"- {a}" for a in accomplishments) if accomplishments else "None yet"
        interests_str = ", ".join(key_interests) if key_interests else "Not clear yet"

        # Truncate page content for prompt
        page_preview = page_content[:500] + "..." if len(page_content) > 500 else page_content

        return f"""Deeply analyze this user's intent and provide actionable insights:

CURRENT PAGE:
{current_url}

WHAT'S ON THE CURRENT PAGE:
{page_preview if page_preview else "No content available"}

SESSION CONTEXT (from Context Builder):
Current Goal: {current_goal}
Research Topic: {research_topic}
User Stage: {user_stage}

PAIN POINTS DETECTED:
{pain_points_str}

WHAT THEY'VE ACCOMPLISHED:
{accomplishments_str}

KEY INTERESTS:
{interests_str}

SESSION STATISTICS:
- Total interactions: {raw_stats.get('total_interactions', 0)}
- Pages visited: {raw_stats.get('pages_visited_count', 0)}
- Searches performed: {raw_stats.get('searches_made', 0)}
- Session duration: {raw_stats.get('session_duration_ms', 0) // 1000} seconds

TASK:
Provide deep psychological analysis of:
1. What is their REAL intent? (not surface level)
2. What stage of their journey are they at?
3. Are they stuck or confused?
4. What emotions might they be feeling?
5. What would genuinely help them succeed?

Return detailed intent analysis in JSON format."""

    def _parse_response(self, content: str) -> Dict[str, Any]:
        """Parse LLM response"""
        try:
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1

            if start_idx != -1 and end_idx > start_idx:
                json_str = content[start_idx:end_idx]
                return json.loads(json_str)
            else:
                raise ValueError("No JSON found in response")

        except (json.JSONDecodeError, ValueError) as e:
            print(f"⚠️  Failed to parse intent analysis response: {e}")
            return self._get_default_analysis()

    def _get_default_analysis(self) -> Dict[str, Any]:
        """Return default analysis when parsing fails"""
        return {
            "primary_intent": "Browsing and exploring content",
            "sub_goals": [],
            "user_stage": "exploring",
            "pain_points": [],
            "understanding_level": "unknown",
            "emotional_state": "neutral",
            "confidence": 0.3,
            "is_user_stuck": False,
            "stuck_reason": None,
            "what_would_help": "Continue monitoring user behavior"
        }


# Create singleton instance
analyzer_agent = AnalyzerAgent()


def run_analyzer(state: AgentState) -> AgentState:
    """
    Node function for LangGraph workflow

    Args:
        state: Current agent state

    Returns:
        Updated state
    """
    return analyzer_agent.analyze(state)
