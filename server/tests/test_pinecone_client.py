"""Test the Pinecone wrapper by monkeypatching the SDK with fakes.

We never hit a real Pinecone in tests — too slow, costs money, flaky.
"""
import pytest
from rag import pinecone_client as pc
from rag.formatter import FormattedRecord


class FakeIndex:
    def __init__(self):
        self.upserts: list = []
        self.queries: list = []
        self.fake_query_result = {
            "result": {
                "hits": [
                    {
                        "_id": "id1",
                        "_score": 0.92,
                        "fields": {
                            "values_text": "Visited Hacker News at news.ycombinator.com (Sun Jun 7 2026, 12:00)",
                            "url": "https://news.ycombinator.com/",
                            "tab_title": "Hacker News",
                            "timestamp": 1717764493000,
                            "type": "navigation",
                        },
                    },
                ]
            }
        }

    def upsert_records(self, namespace, records):
        self.upserts.append((namespace, list(records)))

    def search(self, namespace, query, fields=None):
        self.queries.append((namespace, query, fields))
        return self.fake_query_result


class FakePinecone:
    def __init__(self, api_key):
        self.api_key = api_key
        self.created_indexes: list = []
        self._index = FakeIndex()
        self._existing_indexes: list[str] = []

    def has_index(self, name):
        return name in self._existing_indexes

    def create_index_for_model(self, name, cloud, region, embed):
        self.created_indexes.append({"name": name, "cloud": cloud, "region": region, "embed": embed})
        self._existing_indexes.append(name)

    def Index(self, name):
        return self._index


@pytest.fixture(autouse=True)
def reset_module(monkeypatch):
    """Each test gets a fresh fake Pinecone."""
    fake = FakePinecone(api_key="test-stub-key")
    monkeypatch.setattr(pc, "Pinecone", lambda api_key: fake)
    pc._reset_for_tests()
    return fake


def test_ensure_index_creates_when_missing(reset_module):
    pc.ensure_index()
    fake = reset_module
    assert len(fake.created_indexes) == 1
    created = fake.created_indexes[0]
    assert created["name"] == "yukti-interactions"
    assert created["cloud"] == "aws"
    assert created["region"] == "us-east-1"
    assert created["embed"]["model"] == "multilingual-e5-large"
    assert created["embed"]["field_map"] == {"text": "values_text"}


def test_ensure_index_skips_when_present(reset_module):
    reset_module._existing_indexes.append("yukti-interactions")
    pc.ensure_index()
    assert len(reset_module.created_indexes) == 0


def test_upsert_texts_passes_records_through(reset_module):
    reset_module._existing_indexes.append("yukti-interactions")
    records = [
        FormattedRecord(id="a", values_text="text-a", metadata={"url": "u1"}),
        FormattedRecord(id="b", values_text="text-b", metadata={"url": "u2"}),
    ]
    result = pc.upsert_texts(records)
    assert result == {"indexed": 2}
    upserted_ns, upserted_records = reset_module._index.upserts[0]
    assert upserted_ns == "default"
    assert upserted_records[0]["_id"] == "a"
    assert upserted_records[0]["values_text"] == "text-a"
    assert upserted_records[0]["url"] == "u1"


def test_upsert_empty_records_is_noop(reset_module):
    result = pc.upsert_texts([])
    assert result == {"indexed": 0}
    assert reset_module._index.upserts == []


def test_query_returns_query_hits(reset_module):
    reset_module._existing_indexes.append("yukti-interactions")
    hits = pc.query("what was the news site?", top_k=5)
    assert len(hits) == 1
    assert hits[0].id == "id1"
    assert hits[0].score == 0.92
    assert hits[0].values_text.startswith("Visited Hacker News")
    assert hits[0].metadata["url"] == "https://news.ycombinator.com/"
    _, query_payload, fields = reset_module._index.queries[0]
    assert query_payload["inputs"]["text"] == "what was the news site?"
    assert query_payload["top_k"] == 5
