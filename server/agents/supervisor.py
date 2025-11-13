from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from config.settings import settings
from graph.state import AgentState
import json
from typing import Dict, Any


class SupervisorAgent:
    """
    Supervisor Agent - Orchestrates and makes final decisions
    Uses Groq Llama 3.1 70B for complex reasoning and coordination
    """

    def __init__(self):
        self.llm = ChatGroq(
            groq_api_key=settings.groq_api_key,
            model_name=settings.supervisor_model,
            temperature=0.6,
            max_tokens=settings.max_tokens
        )

    def supervise(self, state: AgentState) -> AgentState:
        """
        Make final decision based on all agent outputs

        Args:
            state: Current agent state with all agent results

        Returns:
            Updated state with final decision
        """
        try:
            analysis = state.get("analysis", {})
            predictions = state.get("predictions", {})
            suggestions = state.get("suggestions", [])
            actions = state.get("actions", [])

            # Create supervision prompt
            prompt = self._create_supervision_prompt(analysis, predictions, suggestions, actions)

            # Call LLM
            response = self.llm.invoke([
                SystemMessage(content=self._get_system_message()),
                HumanMessage(content=prompt)
            ])

            # Parse response
            decision = self._parse_response(response.content)

            # Update state with final decision
            state["supervisor_decision"] = decision
            state["should_continue"] = False  # Stop processing
            state["final_reasoning"] = decision.get("reasoning", "")
            state["confidence"] = decision.get("confidence", 0.5)
            state["processing_complete"] = True

            # Filter suggestions and actions based on supervisor decision
            if not decision.get("should_act", True):
                state["suggestions"] = []
                state["actions"] = []
                print("⚠️  Supervisor: Decided not to show suggestions/actions")
            else:
                print(f"✅ Supervisor: Approved {len(suggestions)} suggestions, {len(actions)} actions")

        except Exception as e:
            print(f"❌ Supervisor Error: {str(e)}")
            state["errors"].append(f"Supervisor: {str(e)}")
            state["supervisor_decision"] = {
                "should_act": True,
                "reasoning": "Default approval due to error",
                "confidence": 0.3
            }
            state["should_continue"] = False
            state["processing_complete"] = True

        return state

    def _get_system_message(self) -> str:
        """Get system message for supervisor"""
        return """You are the supervisor of a multi-agent system that assists users with browsing.

Your responsibilities:
1. Review outputs from all agents (analyzer, predictor, suggestion, action)
2. Decide if suggestions/actions should be shown to the user
3. Assess overall confidence in recommendations
4. Provide clear reasoning for your decision
5. Ensure user safety and privacy

Decision criteria:
- Show suggestions if they're helpful and non-intrusive
- Only approve actions if confidence > 0.7
- Reject if suggestions seem irrelevant or annoying
- Prioritize user experience over engagement

Return ONLY valid JSON in this exact format:
{
    "should_act": true,
    "reasoning": "User shows clear research pattern, suggestions are relevant and helpful.",
    "confidence": 0.85,
    "priority": "high"
}

Do not include explanations, just the JSON."""

    def _create_supervision_prompt(
        self,
        analysis: dict,
        predictions: dict,
        suggestions: list,
        actions: list
    ) -> str:
        """Create supervision prompt"""
        return f"""Review the multi-agent analysis and make final decision:

=== ANALYZER OUTPUT ===
User Intent: {analysis.get('user_intent', 'unknown')}
Navigation Pattern: {analysis.get('navigation_pattern', 'unknown')}
Time Pattern: {analysis.get('time_pattern', 'unknown')}

=== PREDICTOR OUTPUT ===
Next Likely Actions: {predictions.get('next_likely_actions', [])}
Prediction Confidence: {predictions.get('confidence', 0.0)}

=== SUGGESTION OUTPUT ===
Suggestions ({len(suggestions)}):
{json.dumps(suggestions, indent=2)}

=== ACTION OUTPUT ===
Actions ({len(actions)}):
{json.dumps(actions, indent=2)}

=== YOUR TASK ===
Decide if these suggestions and actions should be shown to the user.
Consider:
- Are suggestions relevant and helpful?
- Are actions safe and high-confidence?
- Will this improve user experience?
- Is timing appropriate?

Provide decision in JSON format."""

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
            print(f"⚠️  Failed to parse supervisor response: {e}")
            return {
                "should_act": True,
                "reasoning": "Default approval - unable to parse supervisor decision",
                "confidence": 0.5,
                "priority": "medium"
            }


# Create singleton instance
supervisor_agent = SupervisorAgent()


def run_supervisor(state: AgentState) -> AgentState:
    """Node function for LangGraph workflow"""
    return supervisor_agent.supervise(state)
