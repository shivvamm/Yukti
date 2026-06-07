from langchain_core.messages import SystemMessage, HumanMessage
from graph.state import AgentState
from llm.factory import get_llm
import json
from typing import Dict, Any, List
from collections import Counter


class ContextBuilderAgent:
    """
    Context Builder Agent - Builds rich session context from ALL user interactions
    Uses the configured LLM provider (see settings.llm_provider) for context extraction.
    """

    def __init__(self):
        self.llm = get_llm("context_builder")

    def build_context(self, state: AgentState) -> AgentState:
        """
        Build comprehensive session context from all interactions

        Args:
            state: Current agent state with all interactions

        Returns:
            Updated state with session context
        """
        try:
            interactions = state["interactions"]
            current_url = state["current_url"]
            page_content = state.get("page_content", "")

            # Extract structured context from interactions
            structured_context = self._extract_structured_context(interactions)

            # Use LLM to interpret and enrich context
            enriched_context = self._enrich_context_with_llm(
                structured_context,
                current_url,
                page_content,
                interactions
            )

            # Update state
            state["session_context"] = enriched_context
            state["context_complete"] = True

            print(f"✅ Context Builder: Built context from {len(interactions)} interactions")
            print(f"   Current Goal: {enriched_context.get('current_goal', 'Unknown')}")

        except Exception as e:
            import traceback
            print(f"❌ Context Builder Error: {str(e)}")
            print(f"   Traceback: {traceback.format_exc()}")

            # Safely append error
            if "errors" not in state or state["errors"] is None:
                state["errors"] = []
            state["errors"].append(f"ContextBuilder: {str(e)}")

            state["session_context"] = self._get_default_context()
            state["context_complete"] = True

        return state

    def _extract_structured_context(self, interactions: List[Dict]) -> Dict[str, Any]:
        """Extract structured data from interactions"""

        # Extract search queries and form inputs
        search_queries = []
        form_inputs = []
        for interaction in interactions:
            if interaction.get("type") == "input_value" and interaction.get("inputValue"):
                input_val = interaction["inputValue"].strip()
                if len(input_val) > 2:  # Ignore very short inputs
                    form_inputs.append({
                        "value": input_val,
                        "name": interaction.get("inputName") or "unknown",
                        "url": interaction.get("url") or ""
                    })
                    # Detect search queries
                    if "search" in (interaction.get("inputName") or "").lower():
                        search_queries.append(input_val)

        # Extract navigation history
        pages_visited = []
        page_times = {}
        last_nav_time = None
        last_url = None

        for interaction in interactions:
            if interaction.get("type") == "navigation":
                url = interaction.get("url") or ""
                timestamp = interaction.get("timestamp") or 0

                # Calculate time spent on previous page
                if last_url and last_nav_time:
                    time_spent = timestamp - last_nav_time
                    if last_url not in page_times:
                        page_times[last_url] = 0
                    page_times[last_url] += time_spent

                pages_visited.append({
                    "url": url,
                    "timestamp": timestamp,
                    "title": interaction.get("tabTitle") or ""
                })
                last_nav_time = timestamp
                last_url = url

        # Extract clicked elements
        clicked_elements = []
        for interaction in interactions:
            if interaction.get("type") == "click":
                clicked_elements.append({
                    "element_type": interaction.get("elementType") or "",
                    "element_text": (interaction.get("elementText") or "")[:100],
                    "element_id": interaction.get("elementId") or "",
                    "url": interaction.get("url") or ""
                })

        # Count action types
        action_counts = Counter(i.get("type", "unknown") for i in interactions)

        # Extract scroll behavior
        scroll_depths = [i.get("scrollDepth", 0) for i in interactions if i.get("type") == "scroll"]
        avg_scroll = sum(scroll_depths) / len(scroll_depths) if scroll_depths else 0

        return {
            "total_interactions": len(interactions),
            "search_queries": search_queries,
            "form_inputs": form_inputs,
            "pages_visited": pages_visited[-10:],  # Last 10 pages
            "page_times": page_times,
            "clicked_elements": clicked_elements[-20:],  # Last 20 clicks
            "action_counts": dict(action_counts),
            "avg_scroll_depth": round(avg_scroll, 1),
            "session_duration_ms": interactions[-1].get("timestamp", 0) - interactions[0].get("timestamp", 0) if interactions else 0
        }

    def _enrich_context_with_llm(
        self,
        structured_context: Dict,
        current_url: str,
        page_content: str,
        interactions: List[Dict]
    ) -> Dict[str, Any]:
        """Use LLM to interpret and enrich the structured context"""

        try:
            prompt = self._create_context_prompt(structured_context, current_url, page_content)

            response = self.llm.invoke([
                SystemMessage(content=self._get_system_message()),
                HumanMessage(content=prompt)
            ])

            # Parse LLM response
            enriched = self._parse_response(response.content)

            # Merge with structured context
            enriched.update({
                "raw_stats": {
                    "total_interactions": structured_context["total_interactions"],
                    "pages_visited_count": len(structured_context["pages_visited"]),
                    "searches_made": len(structured_context["search_queries"]),
                    "session_duration_ms": structured_context["session_duration_ms"]
                }
            })

            return enriched

        except Exception as e:
            print(f"⚠️  LLM enrichment failed: {e}")
            return self._get_default_context()

    def _get_system_message(self) -> str:
        """System message for context building"""
        return """You are an expert at understanding user behavior from browsing sessions.

Your task is to analyze a user's browsing session and build a rich context about what they're doing.

Focus on:
1. What is the user's PRIMARY GOAL? (Be specific - not just "browsing" or "shopping")
2. What SPECIFIC TOPIC are they researching/exploring?
3. What STAGE are they at? (exploring, comparing, deciding, executing, stuck)
4. Are there any PAIN POINTS or signs they're struggling?
5. What have they ACCOMPLISHED so far in this session?

Return ONLY valid JSON in this exact format:
{
    "current_goal": "Find affordable hotels in Paris for summer vacation",
    "research_topic": "Paris hotels and accommodation",
    "user_stage": "comparing_options",
    "pain_points": ["Switching between multiple booking sites", "Unclear pricing differences"],
    "accomplishments": ["Found 5 potential hotels", "Checked reviews"],
    "key_interests": ["Price comparison", "Location near Eiffel Tower", "Guest reviews"],
    "next_likely_need": "Decision help - comparing top 3 options"
}

Be specific and detailed. Don't just categorize - understand the actual human goal."""

    def _create_context_prompt(self, context: Dict, current_url: str, page_content: str) -> str:
        """Create prompt for LLM context enrichment"""

        # Format search queries
        queries_str = "\n".join(f"- \"{q}\"" for q in context["search_queries"][:10])

        # Format pages visited with titles
        pages_str = "\n".join(
            f"- {p.get('title', 'Untitled')} ({p.get('url', '')[:50]}...)"
            for p in context["pages_visited"]
        )

        # Format clicked elements
        clicks_str = "\n".join(
            f"- {c.get('element_text', c.get('element_type', 'unknown'))[:80]}"
            for c in context["clicked_elements"][:15]
            if c.get('element_text') or c.get('element_type')
        )

        # Format form inputs
        inputs_str = "\n".join(
            f"- {inp.get('name', 'unknown')}: \"{inp.get('value', '')[:50]}\""
            for inp in context["form_inputs"][:10]
        )

        # Truncate page content if too long
        page_preview = page_content[:500] + "..." if len(page_content) > 500 else page_content

        return f"""Analyze this browsing session and determine user's goal:

CURRENT PAGE:
{current_url}

CURRENT PAGE CONTENT:
{page_preview if page_preview else "No content available"}

SEARCH QUERIES ENTERED:
{queries_str if queries_str else "No searches performed"}

PAGES VISITED:
{pages_str if pages_str else "Only current page"}

FORM INPUTS:
{inputs_str if inputs_str else "No form inputs"}

ELEMENTS CLICKED:
{clicks_str if clicks_str else "No significant clicks"}

SESSION STATS:
- Total interactions: {context['total_interactions']}
- Average scroll depth: {context['avg_scroll_depth']}%
- Session duration: {context['session_duration_ms'] // 1000} seconds
- Action breakdown: {context['action_counts']}

Based on this data, provide a detailed analysis of what the user is trying to accomplish.
Return analysis in JSON format."""

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
            print(f"⚠️  Failed to parse context response: {e}")
            return self._get_default_context()

    def _get_default_context(self) -> Dict[str, Any]:
        """Return default context when parsing fails"""
        return {
            "current_goal": "General browsing",
            "research_topic": "Unknown",
            "user_stage": "exploring",
            "pain_points": [],
            "accomplishments": [],
            "key_interests": [],
            "next_likely_need": "Continue browsing",
            "raw_stats": {}
        }


# Create singleton instance
context_builder_agent = ContextBuilderAgent()


def run_context_builder(state: AgentState) -> AgentState:
    """Node function for LangGraph workflow"""
    return context_builder_agent.build_context(state)
