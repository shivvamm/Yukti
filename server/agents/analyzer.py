from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from config.settings import settings
from graph.state import AgentState
import json
from typing import Dict, Any


class AnalyzerAgent:
    """
    Analyzer Agent - Analyzes user behavior patterns
    Uses Groq Llama 3.1 8B for fast pattern recognition
    """

    def __init__(self):
        self.llm = ChatGroq(
            groq_api_key=settings.groq_api_key,
            model_name=settings.analyzer_model,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens
        )

    def analyze(self, state: AgentState) -> AgentState:
        """
        Analyze user interactions and identify patterns

        Args:
            state: Current agent state

        Returns:
            Updated state with analysis results
        """
        try:
            interactions = state["interactions"]
            current_url = state["current_url"]

            # Take last 20 interactions for analysis
            recent_interactions = interactions[-20:] if len(interactions) > 20 else interactions

            # Create prompt for analysis
            prompt = self._create_analysis_prompt(recent_interactions, current_url)

            # Call LLM
            response = self.llm.invoke([
                SystemMessage(content=self._get_system_message()),
                HumanMessage(content=prompt)
            ])

            # Parse response
            analysis = self._parse_response(response.content)

            # Update state
            state["analysis"] = analysis
            state["analyzer_complete"] = True

            print(f"✅ Analyzer: Found {len(analysis.get('frequent_actions', []))} frequent actions")

        except Exception as e:
            print(f"❌ Analyzer Error: {str(e)}")
            state["errors"].append(f"Analyzer: {str(e)}")
            state["analysis"] = {
                "frequent_actions": [],
                "time_pattern": "unknown",
                "navigation_pattern": "unknown",
                "user_intent": "browsing"
            }
            state["analyzer_complete"] = True

        return state

    def _get_system_message(self) -> str:
        """Get system message for analyzer"""
        return """You are an expert user behavior analyst. Analyze user interactions and identify patterns.

Your task is to:
1. Identify the most frequent action types
2. Determine time patterns (morning/afternoon/evening user)
3. Analyze navigation patterns (deep browsing, quick visits, research mode)
4. Predict user intent (shopping, research, entertainment, work)

Return ONLY valid JSON in this exact format:
{
    "frequent_actions": ["click", "scroll", "navigation"],
    "time_pattern": "evening_user",
    "navigation_pattern": "deep_browsing",
    "user_intent": "research"
}

Do not include any explanations, just the JSON."""

    def _create_analysis_prompt(self, interactions: list, current_url: str) -> str:
        """Create analysis prompt"""
        # Summarize interactions for better token efficiency
        interaction_summary = self._summarize_interactions(interactions)

        return f"""Analyze these user interactions:

Current URL: {current_url}
Number of interactions: {len(interactions)}

Interaction Summary:
{interaction_summary}

Provide analysis in JSON format."""

    def _summarize_interactions(self, interactions: list) -> str:
        """Summarize interactions for the prompt"""
        action_counts = {}
        urls_visited = set()
        total_time = 0

        for interaction in interactions:
            # Count action types
            action_type = interaction.get("type", "unknown")
            action_counts[action_type] = action_counts.get(action_type, 0) + 1

            # Track URLs
            if interaction.get("url"):
                urls_visited.add(interaction["url"])

            # Sum time spent
            if interaction.get("timeSpent"):
                total_time += interaction["timeSpent"]

        summary = f"""
Action Types: {dict(action_counts)}
Unique URLs Visited: {len(urls_visited)}
Total Time Spent: {total_time}ms
Most Common Actions: {sorted(action_counts.items(), key=lambda x: x[1], reverse=True)[:3]}
"""
        return summary.strip()

    def _parse_response(self, content: str) -> Dict[str, Any]:
        """Parse LLM response"""
        try:
            # Try to extract JSON from response
            # Sometimes LLM adds extra text, so we need to extract JSON
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1

            if start_idx != -1 and end_idx > start_idx:
                json_str = content[start_idx:end_idx]
                return json.loads(json_str)
            else:
                raise ValueError("No JSON found in response")

        except (json.JSONDecodeError, ValueError) as e:
            print(f"⚠️  Failed to parse analyzer response: {e}")
            print(f"Raw response: {content}")

            # Return default analysis
            return {
                "frequent_actions": ["click", "scroll"],
                "time_pattern": "unknown",
                "navigation_pattern": "browsing",
                "user_intent": "general"
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
