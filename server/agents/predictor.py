from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from config.settings import settings
from graph.state import AgentState
import json
from typing import Dict, Any


class PredictorAgent:
    """
    Predictor Agent - Predicts next likely user actions
    Uses Groq Llama 3.1 8B for fast predictions
    """

    def __init__(self):
        self.llm = ChatGroq(
            groq_api_key=settings.groq_api_key,
            model_name=settings.predictor_model,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens
        )

    def predict(self, state: AgentState) -> AgentState:
        """
        Predict next likely user actions based on patterns

        Args:
            state: Current agent state with analysis

        Returns:
            Updated state with predictions
        """
        try:
            analysis = state.get("analysis", {})
            current_url = state["current_url"]
            interactions = state["interactions"]

            # Create prediction prompt
            prompt = self._create_prediction_prompt(analysis, current_url, interactions)

            # Call LLM
            response = self.llm.invoke([
                SystemMessage(content=self._get_system_message()),
                HumanMessage(content=prompt)
            ])

            # Parse response
            predictions = self._parse_response(response.content)

            # Update state
            state["predictions"] = predictions
            state["predictor_complete"] = True

            print(f"✅ Predictor: Generated {len(predictions.get('next_likely_actions', []))} predictions")

        except Exception as e:
            print(f"❌ Predictor Error: {str(e)}")
            state["errors"].append(f"Predictor: {str(e)}")
            state["predictions"] = {
                "next_likely_actions": [],
                "confidence": 0.0,
                "predicted_pages": []
            }
            state["predictor_complete"] = True

        return state

    def _get_system_message(self) -> str:
        """Get system message for predictor"""
        return """You are an expert behavior prediction specialist. Predict what the user is likely to do next.

Your task is to:
1. Predict the next 3 most likely actions (click, scroll, navigate, form_fill)
2. Estimate confidence level (0.0 to 1.0)
3. Predict pages they might visit next

Return ONLY valid JSON in this exact format:
{
    "next_likely_actions": ["click_button", "scroll_down", "navigate_away"],
    "confidence": 0.75,
    "predicted_pages": ["https://example.com/page1", "https://example.com/page2"]
}

Do not include any explanations, just the JSON."""

    def _create_prediction_prompt(self, analysis: dict, current_url: str, interactions: list) -> str:
        """Create prediction prompt"""
        recent_actions = [i.get("type") for i in interactions[-5:]] if interactions else []

        return f"""Based on the analysis, predict user's next actions:

Current URL: {current_url}
User Intent: {analysis.get('user_intent', 'unknown')}
Navigation Pattern: {analysis.get('navigation_pattern', 'unknown')}
Recent Actions: {recent_actions}
Frequent Actions: {analysis.get('frequent_actions', [])}

Provide predictions in JSON format."""

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
            print(f"⚠️  Failed to parse predictor response: {e}")
            return {
                "next_likely_actions": ["scroll", "click"],
                "confidence": 0.5,
                "predicted_pages": []
            }


# Create singleton instance
predictor_agent = PredictorAgent()


def run_predictor(state: AgentState) -> AgentState:
    """Node function for LangGraph workflow"""
    return predictor_agent.predict(state)
