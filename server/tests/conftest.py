"""Test bootstrap.

Sets stub keys before `config.settings` is imported so that the
module-level `validate_settings()` call doesn't crash test collection.
Real provider behavior is exercised via monkeypatch in individual tests.
"""

import os

os.environ.setdefault("GOOGLE_API_KEY", "test-stub-key")
os.environ.setdefault("LLM_PROVIDER", "gemini")
os.environ.setdefault("PINECONE_API_KEY", "test-stub-key")
