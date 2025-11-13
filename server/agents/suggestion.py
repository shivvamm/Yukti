from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from config.settings import settings
from graph.state import AgentState
import json
from typing import Dict, Any


class SuggestionAgent:
    """
    Suggestion Agent - Generates helpful suggestions for users
    Uses Groq Llama 3.1 70B for better quality suggestions
    """

    def __init__(self):
        self.llm = ChatGroq(
            groq_api_key=settings.groq_api_key,
            model_name=settings.suggestion_model,
            temperature=0.8,  # Higher temperature for more creative suggestions
            max_tokens=settings.max_tokens
        )

    def suggest(self, state: AgentState) -> AgentState:
        """
        Generate helpful suggestions based on analysis and predictions

        Args:
            state: Current agent state

        Returns:
            Updated state with suggestions
        """
        try:
            analysis = state.get("analysis", {})
            predictions = state.get("predictions", {})
            current_url = state["current_url"]

            # Create suggestion prompt
            prompt = self._create_suggestion_prompt(analysis, predictions, current_url)

            # Call LLM
            response = self.llm.invoke([
                SystemMessage(content=self._get_system_message()),
                HumanMessage(content=prompt)
            ])

            # Parse response
            result = self._parse_response(response.content)

            # Update state
            state["suggestions"] = result.get("suggestions", [])
            state["suggestion_priority"] = result.get("priority", "medium")
            state["suggestion_complete"] = True

            print(f"✅ Suggestion: Generated {len(state['suggestions'])} suggestions")

        except Exception as e:
            print(f"❌ Suggestion Error: {str(e)}")
            state["errors"].append(f"Suggestion: {str(e)}")
            state["suggestions"] = ["Keep browsing! I'm learning your patterns."]
            state["suggestion_priority"] = "low"
            state["suggestion_complete"] = True

        return state

    def _get_system_message(self) -> str:
        """Get system message for suggestion agent"""
        return """You are a helpful AI assistant that provides personalized browsing suggestions.

Your task is to:
1. Generate 2-4 helpful, actionable suggestions based on user behavior
2. Make suggestions friendly and conversational
3. Prioritize suggestions (low, medium, high)
4. Focus on productivity, time-saving, and user convenience

Return ONLY valid JSON in this exact format:
{
    "suggestions": [
        "You frequently visit this site. Consider bookmarking it for quick access.",
        "Based on your reading pattern, you might find the related articles section useful."
    ],
    "priority": "medium"
}

Keep suggestions concise (under 100 characters each). Do not include explanations, just the JSON."""

    def _create_suggestion_prompt(self, analysis: dict, predictions: dict, current_url: str) -> str:
        """Create suggestion prompt"""
        return f"""Generate personalized suggestions for the user:

Current URL: {current_url}
User Intent: {analysis.get('user_intent', 'browsing')}
Navigation Pattern: {analysis.get('navigation_pattern', 'casual')}
Time Pattern: {analysis.get('time_pattern', 'unknown')}
Predicted Next Actions: {predictions.get('next_likely_actions', [])}
Confidence: {predictions.get('confidence', 0.0)}

Generate helpful, friendly suggestions in JSON format."""

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
                "suggestions": ["I'm learning your browsing patterns to provide better suggestions."],
                "priority": "low"
            }


# Create singleton instance
suggestion_agent = SuggestionAgent()


def run_suggestion(state: AgentState) -> AgentState:
    """Node function for LangGraph workflow"""
    return suggestion_agent.suggest(state)
