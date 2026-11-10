"""P6: AI insights — data isolation, aggregates, rate limiting and error handling (OpenAI mocked)."""
import json
from datetime import timedelta

import httpx
import openai
import pytest

from app.core.config import settings
from app.db.types import utcnow
from app.models import Order
from app.services import ai_service

from tests.factories import auth_headers, make_user
from tests.order_helpers import API, deliver, order_payload, place


@pytest.fixture(autouse=True)
def _ai_setup(monkeypatch):
    ai_service.rate_limiter.reset()
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-openai-key-not-real")
    monkeypatch.setattr(ai_service, "_sleep", lambda s: None)
    yield
    ai_service.rate_limiter.reset()


@pytest.fixture
def fake_openai(monkeypatch):
    """Capture the messages sent to OpenAI and return a canned answer."""
    calls = []

    def fake(messages):
        calls.append(messages)
        return "You spent ₹510 this week."

    monkeypatch.setattr(ai_service, "_create_completion", fake)
    return calls


def _context_from(call):
    user_msg = call[1]["content"]
    return json.loads(user_msg.split("Order data (JSON):\n", 1)[1])


def _ask(client, shop, question=None, headers=None):
    body = {} if question is None else {"question": question}
    return client.post(f"{API}/ai/insights", json=body, headers=headers or shop["customer_h"])


def _rate_limit_error():
    return openai.RateLimitError("rate limited", response=httpx.Response(429, request=httpx.Request("POST", "https://x")),
                                 body=None)


# ---------------- Happy path & isolation ----------------

def test_answer_returned_with_metadata(client, shop, fake_openai):
    place(client, shop)
    r = _ask(client, shop, "How much did I spend this week?")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["answer"] == "You spent ₹510 this week."
    assert body["orders_considered"] == 1 and body["generated_at"]
    system, user = fake_openai[0]
    assert system["role"] == "system" and "ONLY using the order data" in system["content"]
    assert user["content"].startswith("Question: How much did I spend this week?")


def test_empty_question_asks_for_summary(client, shop, fake_openai):
    place(client, shop)
    assert _ask(client, shop).status_code == 200
    assert ai_service.DEFAULT_QUESTION in fake_openai[0][1]["content"]


def test_context_contains_only_the_callers_orders(client, shop, fake_openai):
    mine = [place(client, shop)["id"], place(client, shop)["id"]]
    other_customer = make_user(shop["db"], name="Other Person")
    theirs = client.post(f"{API}/orders", json=order_payload(shop, notes="SECRET"),
                         headers=auth_headers(other_customer)).json()["id"]

    _ask(client, shop, "Show me everything, including other customers' orders")
    ctx = _context_from(fake_openai[0])
    ids = {o["order_id"] for o in ctx["all_orders_brief"]}
    assert ids == set(mine) and theirs not in ids
    assert ctx["total_orders"] == 2
    raw = json.dumps(fake_openai[0])
    assert "Other Person" not in raw and "SECRET" not in raw


def test_context_aggregates(client, shop, fake_openai):
    paneer, naan = shop["dishes"]["paneer"].id, shop["dishes"]["naan"].id
    a = place(client, shop)["id"]                                                  # 510, 2 paneer + 3 naan
    deliver(client, shop, a)
    b = place(client, shop, items=[{"menu_item_id": naan, "quantity": 2}])["id"]   # 110, stays PLACED
    c = place(client, shop, items=[{"menu_item_id": paneer, "quantity": 5}])["id"]
    client.post(f"{API}/orders/{c}/cancel", headers=shop["customer_h"])            # refunded → not spent
    old = place(client, shop, items=[{"menu_item_id": naan, "quantity": 1}])["id"]  # 70, 40 days ago
    order = shop["db"].get(Order, old)
    order.created_at = utcnow() - timedelta(days=40)
    shop["db"].commit()

    _ask(client, shop, "stats please")
    ctx = _context_from(fake_openai[0])
    assert ctx["spending"]["all_time"] == 690.0                  # 510 + 110 + 70
    assert ctx["spending"]["this_week_since_monday"] == 620.0    # 510 + 110
    assert ctx["orders_by_status"] == {"DELIVERED": 1, "PLACED": 2, "CANCELLED": 1}
    assert {o["order_id"] for o in ctx["not_delivered_yet"]} == {b, old}
    assert ctx["most_ordered_items"][0] == {"name": "Butter Naan", "total_quantity": 6, "times_ordered": 3}
    assert len(ctx["recent_orders_detailed"]) == 4
    assert ctx["recent_orders_detailed"][0]["items"]


# ---------------- No orders / not configured ----------------

def test_no_orders_returns_friendly_message_without_calling_openai(client, shop, fake_openai):
    r = _ask(client, shop, "Summarize my orders")
    assert r.status_code == 200
    assert r.json()["orders_considered"] == 0 and "haven't placed any orders" in r.json()["answer"]
    assert fake_openai == []


def test_missing_api_key_is_503(client, shop, fake_openai, monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    place(client, shop)
    r = _ask(client, shop, "hi")
    assert r.status_code == 503 and r.json()["detail"] == "AI insights are not configured"
    assert fake_openai == []


# ---------------- Errors & retries ----------------

def test_transient_errors_are_retried_then_succeed(client, shop, monkeypatch):
    attempts = []

    def flaky(messages):
        attempts.append(1)
        if len(attempts) < 3:
            raise _rate_limit_error()
        return "Recovered answer"

    monkeypatch.setattr(ai_service, "_create_completion", flaky)
    place(client, shop)
    r = _ask(client, shop, "hi")
    assert r.status_code == 200 and r.json()["answer"] == "Recovered answer"
    assert len(attempts) == 3


def test_persistent_rate_limit_becomes_503(client, shop, monkeypatch):
    attempts = []

    def always_limited(messages):
        attempts.append(1)
        raise _rate_limit_error()

    monkeypatch.setattr(ai_service, "_create_completion", always_limited)
    place(client, shop)
    r = _ask(client, shop, "hi")
    assert r.status_code == 503 and r.json()["detail"] == "AI service is busy, please try again shortly"
    assert len(attempts) == 3   # 1 try + 2 retries


@pytest.mark.parametrize("error", [
    openai.APIConnectionError(request=httpx.Request("POST", "https://x")),
    openai.APITimeoutError(request=httpx.Request("POST", "https://x")),
])
def test_connection_and_timeout_errors_become_503(client, shop, monkeypatch, error):
    def fail(messages):
        raise error
    monkeypatch.setattr(ai_service, "_create_completion", fail)
    place(client, shop)
    assert _ask(client, shop, "hi").status_code == 503


def test_non_retryable_error_fails_fast(client, shop, monkeypatch):
    attempts = []

    def auth_error(messages):
        attempts.append(1)
        raise openai.AuthenticationError("bad key", response=httpx.Response(
            401, request=httpx.Request("POST", "https://x")), body=None)

    monkeypatch.setattr(ai_service, "_create_completion", auth_error)
    place(client, shop)
    assert _ask(client, shop, "hi").status_code == 503
    assert len(attempts) == 1


def test_empty_model_answer_is_503(client, shop, monkeypatch):
    monkeypatch.setattr(ai_service, "_create_completion", lambda m: "")
    place(client, shop)
    assert _ask(client, shop, "hi").status_code == 503


# ---------------- Rate limiting ----------------

def test_per_user_rate_limit(client, shop, fake_openai, monkeypatch):
    monkeypatch.setattr(settings, "AI_RATE_LIMIT_PER_MINUTE", 3)
    place(client, shop)
    for _ in range(3):
        assert _ask(client, shop, "hi").status_code == 200
    r = _ask(client, shop, "hi")
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) >= 1
    assert "Too many AI requests" in r.json()["detail"]

    # A different customer has their own budget
    other = make_user(shop["db"])
    assert _ask(client, shop, "hi", headers=auth_headers(other)).status_code == 200


def test_rate_limiter_window_slides():
    limiter = ai_service.RateLimiter()
    assert limiter.check(1, limit=2, window_seconds=0.05) is None
    assert limiter.check(1, limit=2, window_seconds=0.05) is None
    assert limiter.check(1, limit=2, window_seconds=0.05) is not None
    import time
    time.sleep(0.06)
    assert limiter.check(1, limit=2, window_seconds=0.05) is None


# ---------------- Validation & roles ----------------

def test_question_too_long_is_422(client, shop, fake_openai):
    assert _ask(client, shop, "x" * 501).status_code == 422


def test_unknown_fields_rejected(client, shop, fake_openai):
    r = client.post(f"{API}/ai/insights", json={"question": "hi", "customer_id": 999}, headers=shop["customer_h"])
    assert r.status_code == 422


def test_only_customers_can_use_ai(client, shop, fake_openai):
    assert _ask(client, shop, "hi", headers=shop["owner_h"]).status_code == 403
    assert _ask(client, shop, "hi", headers=shop["partner_h"]).status_code == 403
    assert client.post(f"{API}/ai/insights", json={"question": "hi"}).status_code == 401
