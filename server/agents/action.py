from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from config.settings import settings
from graph.state import AgentState
import json
from typing import Dict, Any


class ActionAgent:
    """
    Action Agent - Determines specific actions to suggest/perform
    Uses Google Gemini 2.5 Flash for fast, reliable action decisions
    """

    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            google_api_key=settings.google_api_key,
            model=settings.action_model,
            temperature=0.5,  # Lower temperature for more deterministic actions
            max_tokens=settings.max_tokens
        )

    def determine_actions(self, state: AgentState) -> AgentState:
        """
        Determine specific actions to suggest to the user

        Args:
            state: Current agent state

        Returns:
            Updated state with action recommendations
        """
        try:
            analysis = state.get("analysis", {})
            predictions = state.get("predictions", {})
            current_url = state["current_url"]

            # Create action prompt
            prompt = self._create_action_prompt(analysis, predictions, current_url)

            # Call LLM
            response = self.llm.invoke([
                SystemMessage(content=self._get_system_message()),
                HumanMessage(content=prompt)
            ])

            # Parse response
            result = self._parse_response(response.content)

            # Update state
            state["actions"] = result.get("actions", [])
            state["action_complete"] = True

            print(f"✅ Action: Suggested {len(state['actions'])} actions")

        except Exception as e:
            print(f"❌ Action Error: {str(e)}")
            state["errors"].append(f"Action: {str(e)}")
            state["actions"] = []
            state["action_complete"] = True

        return state

    def _get_system_message(self) -> str:
        """Get system message for action agent"""
        return """You are an action recommendation specialist. Suggest specific browser actions.

Available action types:
- "navigate": Navigate to a URL
- "click": Click an element (needs selector)
- "fill_form": Fill a form field (needs selector and value)
- "scroll": Scroll to position
- "bookmark": Suggest bookmarking current page
- "none": No action needed

Your task is to:
1. Suggest 0-3 safe, helpful actions
2. Provide confidence score for each action (0.0 to 1.0)
3. Only suggest high-confidence actions (>0.6)
4. Never suggest destructive actions

Return ONLY valid JSON in this exact format:
{
    "actions": [
        {
            "type": "bookmark",
            "target": null,
            "value": null,
            "confidence": 0.85
        },
        {
            "type": "navigate",
            "target": "https://example.com/related",
            "value": null,
            "confidence": 0.75
        }
    ]
}

If no actions recommended, return empty actions array. Do not include explanations, just the JSON."""

    def _create_action_prompt(self, analysis: dict, predictions: dict, current_url: str) -> str:
        """Create action prompt"""
        return f"""Determine helpful actions for the user:

Current URL: {current_url}
User Intent: {analysis.get('user_intent', 'browsing')}
Navigation Pattern: {analysis.get('navigation_pattern', 'casual')}
Predicted Next Actions: {predictions.get('next_likely_actions', [])}
Predicted Pages: {predictions.get('predicted_pages', [])}
Confidence: {predictions.get('confidence', 0.0)}

Suggest safe, helpful actions in JSON format. Only suggest high-confidence actions."""

    def _parse_response(self, content: str) -> Dict[str, Any]:
        """Parse LLM response"""
        try:
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1

            if start_idx != -1 and end_idx > start_idx:
                json_str = content[start_idx:end_idx]
                parsed = json.loads(json_str)

                # Filter out low-confidence actions
                if "actions" in parsed:
                    parsed["actions"] = [
                        action for action in parsed["actions"]
                        if action.get("confidence", 0) > 0.6
                    ]

                return parsed
            else:
                raise ValueError("No JSON found in response")

        except (json.JSONDecodeError, ValueError) as e:
            print(f"⚠️  Failed to parse action response: {e}")
            return {"actions": []}


# Create singleton instance
action_agent = ActionAgent()


def run_action(state: AgentState) -> AgentState:
    """Node function for LangGraph workflow"""
    return action_agent.determine_actions(state)
