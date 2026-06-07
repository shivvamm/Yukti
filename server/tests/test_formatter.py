from rag.formatter import format, FormattedRecord


def test_click_with_text_formats_readable():
    record = format({
        "type": "click",
        "url": "https://workatastartup.com/companies?query=AI",
        "tabTitle": "Companies — Work at a Startup",
        "elementText": "Apply now",
        "elementType": "button",
        "timestamp": 1717764493000,
    })
    assert record is not None
    assert isinstance(record, FormattedRecord)
    assert "Clicked button 'Apply now'" in record.values_text
    assert "workatastartup.com" in record.values_text
    assert record.metadata["type"] == "click"
    assert record.metadata["url"] == "https://workatastartup.com/companies?query=AI"
    assert record.id  # non-empty deterministic id


def test_navigation_formats_with_title():
    record = format({
        "type": "navigation",
        "url": "https://news.ycombinator.com/",
        "tabTitle": "Hacker News",
        "timestamp": 1717764493000,
    })
    assert record is not None
    assert "Visited Hacker News" in record.values_text
    assert "news.ycombinator.com" in record.values_text


def test_input_value_formats():
    record = format({
        "type": "input_value",
        "url": "https://www.google.com/search?q=AI+engineer",
        "tabTitle": "AI engineer - Google Search",
        "inputName": "q",
        "inputValue": "AI engineer",
        "timestamp": 1717764493000,
    })
    assert record is not None
    assert "Typed 'AI engineer'" in record.values_text
    assert "google.com" in record.values_text


def test_scroll_returns_none():
    assert format({
        "type": "scroll",
        "scrollDepth": 75,
        "url": "https://example.com",
        "timestamp": 1717764493000,
    }) is None


def test_form_interaction_formats():
    record = format({
        "type": "form_interaction",
        "url": "https://example.com/signup",
        "inputName": "email",
        "timestamp": 1717764493000,
    })
    assert record is not None
    assert "Focused email field" in record.values_text


def test_unknown_type_uses_generic_fallback():
    record = format({
        "type": "tab_activated",
        "url": "https://example.com",
        "timestamp": 1717764493000,
    })
    assert record is not None
    assert "tab_activated" in record.values_text
    assert "example.com" in record.values_text


def test_null_fields_dont_crash():
    record = format({
        "type": "click",
        "url": "https://example.com",
        "elementText": None,
        "elementType": None,
        "tabTitle": None,
        "timestamp": 1717764493000,
    })
    assert record is not None  # falls back to generic phrasing


def test_id_is_deterministic():
    event = {
        "type": "click",
        "url": "https://example.com",
        "elementText": "X",
        "timestamp": 1717764493000,
    }
    a = format(event)
    b = format(event)
    assert a.id == b.id


def test_id_differs_when_fields_differ():
    a = format({"type": "click", "url": "https://example.com",
                "elementText": "A", "timestamp": 1717764493000})
    b = format({"type": "click", "url": "https://example.com",
                "elementText": "B", "timestamp": 1717764493000})
    assert a.id != b.id
