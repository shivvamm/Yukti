from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from config.settings import settings
from graph.state import AgentState
import json
from typing import Dict, Any


class SuggestionAgent:
    """
    Suggestion Agent - Provides actionable help based on deep user intent understanding
    Uses Google Gemini 2.5 Pro for insightful, helpful suggestions
    """

    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            google_api_key=settings.google_api_key,
            model=settings.suggestion_model,
            temperature=0.7,  # Balanced for helpful yet accurate suggestions
            max_tokens=2048
        )

    def suggest(self, state: AgentState) -> AgentState:
        """
        Generate ONE powerful suggestion based on intent analysis

        Args:
            state: Current agent state with intent analysis

        Returns:
            Updated state with actionable suggestion
        """
        try:
            intent_analysis = state.get("intent_analysis", {})
            session_context = state.get("session_context", {})
            current_url = state["current_url"]
            page_content = state.get("page_content", "")

            # Create suggestion prompt
            prompt = self._create_suggestion_prompt(
                intent_analysis,
                session_context,
                current_url,
                page_content
            )

            # Call LLM
            response = self.llm.invoke([
                SystemMessage(content=self._get_system_message()),
                HumanMessage(content=prompt)
            ])

            # Parse response
            result = self._parse_response(response.content)

            # Extract single suggestion
            suggestion_text = result.get("suggestion", "")

            # Update state - return as list with single item for compatibility
            state["suggestions"] = [suggestion_text] if suggestion_text else []
            state["suggestion_reasoning"] = result.get("reasoning", "")
            state["suggestion_priority"] = result.get("priority", "medium")
            state["suggestion_complete"] = True

            if suggestion_text:
                print(f"✅ Suggestion: {suggestion_text[:80]}...")
                print(f"   Priority: {result.get('priority', 'medium')}")
            else:
                print("⚠️  Suggestion: No suggestion generated")

        except Exception as e:
            import traceback
            print(f"❌ Suggestion Error: {str(e)}")
            print(f"   Traceback: {traceback.format_exc()}")

            # Safely append error
            if "errors" not in state or state["errors"] is None:
                state["errors"] = []
            state["errors"].append(f"Suggestion: {str(e)}")

            state["suggestions"] = []
            state["suggestion_priority"] = "low"
            state["suggestion_complete"] = True

        return state

    def _get_system_message(self) -> str:
        """Get system message for suggestion agent"""
        return """You are a UX expert and helpful assistant that provides ONE powerful, actionable suggestion.

Your role:
1. Understand the user's REAL goal from intent analysis
2. Identify if they're stuck, confused, or doing something inefficiently
3. Provide ONE suggestion that:
   - Directly helps them achieve their goal
   - Shows them a better/faster way if needed
   - Unblocks them if they're stuck
   - Is specific and actionable (not generic)

Priority levels:
- high: User is stuck or suggestion saves significant time
- medium: Helpful optimization or relevant tip
- low: Nice-to-have insight

Return ONLY valid JSON in this exact format:
{
    "suggestion": "Try using the price comparison view to see all hotels side-by-side instead of switching tabs",
    "reasoning": "User is comparing prices across multiple tabs which is inefficient",
    "priority": "medium",
    "helps_with": "comparing_options"
}

Rules:
- Max 150 characters for suggestion
- Be conversational but concise
- Focus on user's actual goal
- If user is browsing normally with no clear need, return empty suggestion
- Never suggest things user is already doing correctly

Do not include explanations outside JSON."""

    def _create_suggestion_prompt(
        self,
        intent_analysis: dict,
        session_context: dict,
        current_url: str,
        page_content: str
    ) -> str:
        """Create suggestion prompt based on intent analysis"""

        # Extract intent analysis
        primary_intent = intent_analysis.get("primary_intent", "Unknown")
        user_stage = intent_analysis.get("user_stage", "exploring")
        pain_points = intent_analysis.get("pain_points", [])
        is_stuck = intent_analysis.get("is_user_stuck", False)
        stuck_reason = intent_analysis.get("stuck_reason", "")
        what_would_help = intent_analysis.get("what_would_help", "")
        emotional_state = intent_analysis.get("emotional_state", "neutral")

        # Extract session context
        current_goal = session_context.get("current_goal", "Unknown")

        pain_points_str = "\n".join(f"- {p}" for p in pain_points) if pain_points else "None"

        # Truncate page content
        page_preview = page_content[:400] + "..." if len(page_content) > 400 else page_content

        return f"""Provide ONE powerful suggestion to help this user:

CURRENT PAGE:
{current_url}

WHAT'S ON THIS PAGE:
{page_preview if page_preview else "No content available"}
(Use this to give context-specific suggestions based on what they're looking at)

USER'S GOAL:
{primary_intent}

CURRENT STAGE:
{user_stage}

EMOTIONAL STATE:
{emotional_state}

IS USER STUCK?
{is_stuck}
{f"Reason: {stuck_reason}" if stuck_reason else ""}

PAIN POINTS:
{pain_points_str}

WHAT WOULD HELP (from intent analysis):
{what_would_help}

YOUR TASK:
Based on this deep understanding of the user, provide ONE actionable suggestion that:
1. Directly addresses their goal: "{current_goal}"
2. Helps with their current pain points
3. Unblocks them if stuck
4. Shows a better way if they're being inefficient

If user is browsing normally with no clear need for help, return empty suggestion ("").

Return suggestion in JSON format."""

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
            print(f"⚠️  Failed to parse suggestion response: {e}")
            return {
                "suggestion": "",
                "reasoning": "Failed to generate suggestion",
                "priority": "low",
                "helps_with": ""
            }


# Create singleton instance
suggestion_agent = SuggestionAgent()


def run_suggestion(state: AgentState) -> AgentState:
    """Node function for LangGraph workflow"""
    return suggestion_agent.suggest(state)
