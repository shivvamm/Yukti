"""Transform raw browser-interaction dicts into Pinecone-ready records.

Each interaction becomes one vector. The `values_text` field is what
Pinecone embeds; the `metadata` field is what we filter/return on.

Scrolls are skipped — they're pure noise without page content.
"""

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse


@dataclass(frozen=True)
class FormattedRecord:
    id: str
    values_text: str
    metadata: dict[str, Any]


def format(interaction: dict[str, Any]) -> FormattedRecord | None:
    """Convert one interaction dict into a FormattedRecord, or None if skipped."""
    event_type = interaction.get("type") or "unknown"
    if event_type == "scroll":
        return None

    url = interaction.get("url") or ""
    timestamp_ms = interaction.get("timestamp") or 0
    hostname = urlparse(url).hostname or "unknown"
    date_str = _format_date(timestamp_ms)

    values_text = _render_text(interaction, event_type, hostname, date_str)
    metadata = _build_metadata(interaction, event_type)
    record_id = _make_id(interaction, event_type)

    return FormattedRecord(id=record_id, values_text=values_text, metadata=metadata)


def _render_text(interaction: dict, event_type: str, hostname: str, date_str: str) -> str:
    """Render a one-line natural-language description of the event."""
    if event_type == "click":
        el_type = interaction.get("elementType") or "element"
        el_text = interaction.get("elementText") or ""
        if el_text:
            return f"Clicked {el_type} '{el_text}' on {hostname} ({date_str})"
        return f"Clicked {el_type} on {hostname} ({date_str})"

    if event_type == "navigation":
        title = interaction.get("tabTitle") or hostname
        return f"Visited {title} at {hostname} ({date_str})"

    if event_type == "input_value":
        name = interaction.get("inputName") or "field"
        value = interaction.get("inputValue") or ""
        return f"Typed '{value}' into {name} on {hostname} ({date_str})"

    if event_type == "form_interaction":
        name = interaction.get("inputName") or "field"
        return f"Focused {name} field on {hostname} ({date_str})"

    return f"User activity ({event_type}) on {hostname} ({date_str})"


def _build_metadata(interaction: dict, event_type: str) -> dict[str, Any]:
    """Pinecone metadata must be JSON-serializable scalars/lists. Drop Nones safely."""
    md: dict[str, Any] = {
        "type": event_type,
        "url": interaction.get("url") or "",
        "tab_title": interaction.get("tabTitle") or "",
        "timestamp": int(interaction.get("timestamp") or 0),
    }
    # Optional fields — include only when non-null to keep metadata payload small
    for key, src_key in [
        ("element_text", "elementText"),
        ("element_type", "elementType"),
        ("input_name", "inputName"),
        ("input_value", "inputValue"),
    ]:
        v = interaction.get(src_key)
        if v:
            md[key] = v
    return md


def _make_id(interaction: dict, event_type: str) -> str:
    """Deterministic SHA1 of the canonical fields → idempotent upsert."""
    canonical = "|".join([
        event_type,
        interaction.get("url") or "",
        str(int(interaction.get("timestamp") or 0) // 1000),  # second precision
        interaction.get("elementText") or "",
        interaction.get("inputValue") or "",
    ])
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()


def _format_date(timestamp_ms: int) -> str:
    """Format epoch-ms as a human/LLM-friendly date, UTC."""
    if not timestamp_ms:
        return "unknown date"
    dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
    return dt.strftime("%a %b %-d %Y, %H:%M")
