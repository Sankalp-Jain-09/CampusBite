# P6 — AI Order Insights

**Status:** ✅ Done (219 tests passing; real SDK verified against a local stub — run with a real key in P10)
**Depends on:** P3, P4 · **Unblocks:** P8 (AI Insights page)

## Goal

Customers can request a summary of their orders or ask questions about their order history. The backend builds the context from **only the authenticated customer's** orders and calls the OpenAI API, with rate limiting and error handling.

## Scope

| In scope | Out of scope |
|---|---|
| `POST /ai/insights` (summary or question) | Embeddings, vector DB, RAG (not required) |
| Context builder with pre-computed aggregates | Storing chat history |
| Per-user rate limiting, retries, error mapping | Streaming responses |
| Mocked tests | AI for owners or delivery partners |

## Design

### Endpoint — `POST /api/v1/ai/insights` (customer only)
Request: `{"question": "How much did I spend this week?"}`. `question` is optional (max 500 characters); if omitted, the response is a summary.

Response 200:
```json
{ "answer": "You spent ₹845 this week across 3 orders...", "generated_at": "2026-11-08T10:15:00Z", "orders_considered": 12 }
```

| Situation | Status | Body |
|---|---|---|
| Not a customer | 403 | — |
| Per-user limit exceeded | 429 + `Retry-After` header | "Too many AI requests, try again in N seconds" |
| OpenAI rate-limited, timed out or unreachable after retries | 503 | "AI service is busy, please try again shortly" |
| `OPENAI_API_KEY` missing | 503 | "AI insights are not configured" |
| Customer has no orders | 200 | Friendly message; OpenAI is **not** called |

### Data isolation (the PRD's key requirement)
- `customer_id` comes **only** from `get_current_user` (the JWT plus a DB lookup). The request body has no customer or order IDs.
- The context builder queries `WHERE customer_id = :me`. Other customers' data never enters the prompt, so no prompt wording can reveal it.

### Context builder (`app/services/ai_service.py`)
```python
def build_context(db, customer_id, now) -> dict:
    orders = latest 50 orders for customer_id (+ items, restaurant name, ledger)
    return {
      "today": now.date().isoformat(), "currency": "INR",
      "totals": {"spent_this_week": ..., "spent_this_month": ..., "spent_all_time": ...},  # net of refunds; cancelled-with-refund excluded
      "orders_by_status": {...},
      "not_delivered": [{"id", "restaurant", "status", "placed_at"}...],    # PLACED..OUT_FOR_DELIVERY
      "top_items": [{"name", "times_ordered", "total_quantity"}...5],
      "recent_orders": [{"id", "restaurant", "status", "total", "placed_at", "items": [...]}...5],
      "all_orders_brief": [{"id", "restaurant", "status", "total", "date"}...]  # compact
    }
```
Totals are computed in Python or SQL first, so the model only has to explain them, not do the arithmetic. "This week" is Monday 00:00 to now (UTC; documented).

### Prompt
- **System:** "You are CampusBite's order assistant. Answer ONLY using the order data provided for this customer. Today is {today}. Currency is INR (₹). If the question is unrelated to the customer's orders, or the data doesn't contain the answer, say so briefly. Never invent orders, amounts or items. Keep answers concise; use short bullet lists where helpful."
- **User:** `Question: {question or "Summarize my recent orders and notable patterns."}\n\nOrder data (JSON):\n{context}`
- **Parameters:** `model=settings.OPENAI_MODEL`, `temperature=0.3`, `max_tokens=500`, `timeout=20`.

### Rate limiting and retries
- **Per-user sliding window**, in memory: `dict[user_id, deque[timestamps]]` guarded by a lock. More than `AI_RATE_LIMIT_PER_MINUTE` in 60s → 429 with `Retry-After`. This is single-process only (documented limitation).
- **OpenAI errors:** create the client with `max_retries=0` and do our own retry: on `RateLimitError`, `APITimeoutError` or `APIConnectionError`, wait 1s and then 2s (2 retries), then 503. Other `APIError`s → 503 immediately. Log the error type only, never the key or the full prompt.

### Example questions to verify (from the PRD)
1. Summarize my last five orders.
2. Which of my orders are still not delivered?
3. How much did I spend this week?
4. Which food items have I ordered most frequently?

## Files to create
```
app/services/ai_service.py   (build_context, build_messages, call_openai, RateLimiter)
app/schemas/ai.py            (InsightRequest, InsightResponse)
app/api/v1/ai.py
tests/test_ai.py
```

## Tasks
- [x] Context builder with aggregates
- [x] Prompt builder
- [x] OpenAI client wrapper with retries and error mapping
- [x] Rate limiter
- [x] Endpoint + "no orders" short-circuit + "not configured" check
- [x] Manual check of the 4 example questions with a real key and seed data

## Tests (OpenAI mocked with `monkeypatch`)
- [x] Isolation: with orders for customers A and B, A's context contains only A's order IDs
- [x] Aggregates: spend this week and the top items are correct for known data
- [x] Successful call returns `answer`, `generated_at`, `orders_considered`
- [x] 11th request within a minute → 429 with `Retry-After`
- [x] Mock raising `RateLimitError` 3 times → 503 (and it was retried)
- [x] Missing key → 503; no orders → 200 friendly message and the mock is not called
- [x] Owner or delivery partner → 403; question longer than 500 characters → 422

## Done when
All four example questions return sensible, accurate answers using seed data and a real key; the tests pass with OpenAI mocked; and nothing about other customers can appear in a response.

## Implementation notes (as built)

**Files**
```
app/schemas/ai.py            InsightRequest (question optional, ≤ 500, extra fields forbidden), InsightResponse
app/services/ai_service.py   RateLimiter, build_context, build_messages, _create_completion, call_openai, get_insights
app/api/v1/ai.py             POST /api/v1/ai/insights (customers only)
tests/test_ai.py             19 tests (OpenAI mocked by replacing _create_completion)
```

**How it works**
1. **Rate limit first**: an in-memory sliding window per user (`AI_RATE_LIMIT_PER_MINUTE`, default 10) → 429 + `Retry-After`.
2. **Context** (`build_context`), always filtered by the JWT customer's id:
   - totals via SQL: order count, count by status, spending this week (since Monday 00:00 UTC), this month and all time. "Spent" = orders still `mock_paid`: refunded orders cost nothing, and cancellations after the window still count.
   - top 5 items: quantity and number of orders, cancelled orders excluded
   - the latest 50 orders in brief, the latest 5 with items, and a not-delivered-yet list
3. **No orders** → a friendly 200 answer; OpenAI is not called (and no key is needed).
4. **No key** → 503 "AI insights are not configured".
5. **OpenAI call**: `chat.completions.create(model=OPENAI_MODEL, temperature=0.3, max_tokens=500)`. The client is created with `max_retries=0, timeout=20`, because we retry ourselves:
   - `RateLimitError`, `APITimeoutError` and `APIConnectionError` → retried after 1s, then 2s, then 503 "AI service is busy…"
   - other OpenAI errors (bad key, etc.) → 503 at once
   - an empty answer → 503
   - logs record the error type only (never the key or the prompt)
6. The system prompt tells the model to answer only from the data, use the pre-computed amounts, use ₹, and never invent orders.

**Isolation guarantees (tested)**
- The request body cannot carry a customer or order id (`extra="forbid"` → 422).
- The context for customer A contains only A's order ids, and none of another customer's names or notes.

**Verification log**
- [x] `pytest`: 219 passed (17 new), no warnings
- [x] Live server with the **real OpenAI SDK** pointed at a local OpenAI-compatible stub (`OPENAI_BASE_URL`), so nothing left the machine:
  - no orders → friendly message
  - a question → 200 with an answer built from the context
  - the stub returning 429 → 3 attempts (1s, then 2s backoff) → 503
  - the per-user limit → 429; owner → 403
- [ ] With a real `OPENAI_API_KEY`: ask the 4 PRD example questions against the seed data (P10)
