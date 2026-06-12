import rag.pinecone_client as pc


class _FakeIndex:
    def __init__(self):
        self.last_filter = None

    def search(self, **kwargs):
        self.last_filter = kwargs.get("filter")
        return {"result": {"hits": []}}


def test_query_without_range_filters_only_user(monkeypatch):
    fake = _FakeIndex()
    monkeypatch.setattr(pc, "_index_handle", lambda: fake)
    pc.query(text="hi", user_id="u1")
    assert fake.last_filter == {"user_id": {"$eq": "u1"}}


def test_query_with_range_ands_timestamp(monkeypatch):
    fake = _FakeIndex()
    monkeypatch.setattr(pc, "_index_handle", lambda: fake)
    pc.query(text="hi", user_id="u1", time_range=(1000, 2000))
    assert fake.last_filter == {
        "user_id": {"$eq": "u1"},
        "timestamp": {"$gte": 1000, "$lte": 2000},
    }
