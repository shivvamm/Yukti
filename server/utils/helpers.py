import logging
from datetime import datetime
from typing import Any, Dict
from loguru import logger
import sys


# Configure loguru logger
logger.remove()  # Remove default handler
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO"
)


def log_info(message: str, **kwargs):
    """Log info message"""
    logger.info(message, **kwargs)


def log_error(message: str, **kwargs):
    """Log error message"""
    logger.error(message, **kwargs)


def log_warning(message: str, **kwargs):
    """Log warning message"""
    logger.warning(message, **kwargs)


def log_debug(message: str, **kwargs):
    """Log debug message"""
    logger.debug(message, **kwargs)


def format_timestamp(timestamp_ms: int) -> str:
    """
    Format millisecond timestamp to readable string

    Args:
        timestamp_ms: Timestamp in milliseconds

    Returns:
        Formatted datetime string
    """
    try:
        dt = datetime.fromtimestamp(timestamp_ms / 1000)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except:
        return "Invalid timestamp"


def truncate_text(text: str, max_length: int = 100) -> str:
    """
    Truncate text to max length

    Args:
        text: Text to truncate
        max_length: Maximum length

    Returns:
        Truncated text
    """
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."


def sanitize_url(url: str) -> str:
    """
    Sanitize URL for logging/display

    Args:
        url: URL to sanitize

    Returns:
        Sanitized URL
    """
    # Remove query parameters and fragments
    if "?" in url:
        url = url.split("?")[0]
    if "#" in url:
        url = url.split("#")[0]
    return url


def calculate_interaction_summary(interactions: list) -> Dict[str, Any]:
    """
    Calculate summary statistics from interactions

    Args:
        interactions: List of interaction dictionaries

    Returns:
        Summary dictionary
    """
    if not interactions:
        return {
            "total": 0,
            "types": {},
            "unique_urls": 0,
            "time_span_ms": 0
        }

    # Count action types
    action_types = {}
    urls = set()
    timestamps = []

    for interaction in interactions:
        # Count types
        action_type = interaction.get("type", "unknown")
        action_types[action_type] = action_types.get(action_type, 0) + 1

        # Track URLs
        if "url" in interaction:
            urls.add(interaction["url"])

        # Track timestamps
        if "timestamp" in interaction:
            timestamps.append(interaction["timestamp"])

    # Calculate time span
    time_span = 0
    if len(timestamps) >= 2:
        time_span = max(timestamps) - min(timestamps)

    return {
        "total": len(interactions),
        "types": action_types,
        "unique_urls": len(urls),
        "time_span_ms": time_span,
        "most_common_action": max(action_types.items(), key=lambda x: x[1])[0] if action_types else "none"
    }


def validate_groq_api_key(api_key: str) -> bool:
    """
    Validate Groq API key format

    Args:
        api_key: API key to validate

    Returns:
        True if valid format
    """
    if not api_key:
        return False

    # Groq API keys start with "gsk_"
    if not api_key.startswith("gsk_"):
        return False

    # Should be at least 20 characters
    if len(api_key) < 20:
        return False

    return True


class RequestLogger:
    """Logger for API requests"""

    @staticmethod
    def log_request(endpoint: str, method: str, data: Dict[str, Any] = None):
        """Log incoming request"""
        log_info(f"📥 {method} {endpoint}", data=truncate_text(str(data), 200) if data else None)

    @staticmethod
    def log_response(endpoint: str, status: int, response_time_ms: float):
        """Log outgoing response"""
        emoji = "✅" if status < 400 else "❌"
        log_info(f"{emoji} {endpoint} - {status} ({response_time_ms:.0f}ms)")

    @staticmethod
    def log_error(endpoint: str, error: Exception):
        """Log request error"""
        log_error(f"💥 Error in {endpoint}: {str(error)}")
