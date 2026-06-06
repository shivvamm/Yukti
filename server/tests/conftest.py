"""Test bootstrap.

Sets a stub GOOGLE_API_KEY before `config.settings` is imported so that
the module-level `validate_settings()` call doesn't crash the test
collection. Real provider behavior is exercised via monkeypatch in
individual tests.
"""

import os

os.environ.setdefault("GOOGLE_API_KEY", "test-stub-key")
os.environ.setdefault("LLM_PROVIDER", "gemini")
