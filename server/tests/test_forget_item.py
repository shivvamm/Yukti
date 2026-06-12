from fastapi.testclient import TestClient

import api.routes as routes
from main import app
from rag.formatter import format as format_interaction


def _click():
    return {
        "type": "click",
        "url": "https://example.com/a",
        "timestamp": 1717764493000,
        "elementText": "Apply now",
        "elementType": "button",
    }


def test_forget_item_deletes_reconstructed_id(monkeypatch):
    captured = {}

    def fake_delete_ids(ids):
        captured["ids"] = ids

    monkeypatch.setattr(routes.pinecone_client, "delete_ids", fake_delete_ids)

    client = TestClient(app)
    resp = client.post("/api/forget-item", json={"user_id": "u1", "interaction": _click()})

    assert resp.status_code == 200
    assert resp.json()["success"] is True
    # Must delete the SAME id the formatter would have indexed.
    expected_id = format_interaction(_click()).id
    assert captured["ids"] == [expected_id]


def test_forget_item_noops_on_unindexable(monkeypatch):
    called = {"n": 0}
    monkeypatch.setattr(routes.pinecone_client, "delete_ids",
                        lambda ids: called.__setitem__("n", called["n"] + 1))
    client = TestClient(app)
    # A scroll is skipped by the formatter (returns None) → nothing to delete.
    resp = client.post("/api/forget-item",
                       json={"user_id": "u1", "interaction": {"type": "scroll",
                             "url": "https://x.com", "timestamp": 1, "scrollDepth": 10}})
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert called["n"] == 0
