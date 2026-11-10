# P4 — Reviews, Returns & Refunds

**Status:** ✅ Done (186 tests passing; verified on a live server)
**Depends on:** P3 · **Unblocks:** P5 (stats use reviews and refunds), P8 and P9 UI

## Goal

After delivery, customers can rate and review an order and request a return or refund with a reason. Restaurant owners approve or reject returns; an approval refunds the dummy payment and records it in the ledger (D5).

## Scope

| In scope | Out of scope |
|---|---|
| Create a review (one per delivered order) | Editing or deleting reviews |
| Create a return request (one per delivered order, reason required) | Partial refunds (always the full amount) |
| Owner return list, approve, reject | Customer withdrawing a return request |
| Refund ledger entry on approval | |

## Design

### Reviews — `POST /orders/{id}/review` (customer)
Body: `{"rating": 1-5, "comment": "optional, max 1000 chars"}`

| Check | Error |
|---|---|
| Order belongs to the caller | 404 |
| Order status is DELIVERED | 409 "Reviews are allowed only after delivery" |
| No existing review (`order_id` UNIQUE as a backstop, `IntegrityError` → 409) | 409 "Order already reviewed" |
| Rating 1–5 | 422 |

Creates a `Review` with `restaurant_id` copied from the order → 201 `ReviewOut`. The restaurant's average rating (P2 aggregate) picks it up automatically.

> Should an order in REFUNDED status still accept a review? Decision: **no**. Only DELIVERED orders can be reviewed (the PRD says "after successful delivery").

### Returns — `POST /orders/{id}/return` (customer)
Body: `{"reason": "10–500 chars, required"}`

| Check | Error |
|---|---|
| Order belongs to the caller | 404 |
| Order status is DELIVERED | 409 "Returns are allowed only after delivery" |
| No existing return request (`order_id` UNIQUE) | 409 "A return request already exists for this order" |
| Reason length | 422 |

Creates a `ReturnRequest(status=requested)` → 201 `ReturnRequestOut`. The order status stays DELIVERED until the owner decides.

### Owner return management (`/owner/returns`, `require_roles(restaurant_owner)`)
| Method | Path | Body | Effect |
|---|---|---|---|
| GET | `/owner/returns` | `status`, `page`, `page_size` | Requests for orders of the caller's restaurant, newest first, with the order summary (id, customer name, total, items) and reason |
| POST | `/owner/returns/{id}/approve` | — | See below |
| POST | `/owner/returns/{id}/reject` | `{"owner_note": "required, 5–500 chars"}` | return → `rejected`, `resolved_at`, `resolved_by`; order and payment unchanged |

**Approve (single transaction, order row locked `FOR UPDATE`):**
1. The return belongs to the caller's restaurant (404) and its status is `requested` (409 "Already resolved").
2. return → `approved`, `resolved_at = now`, `resolved_by = owner`.
3. `payment_service.mock_refund(order, note="return_approved")` → ledger refund entry + payment `refunded`.
4. `apply_transition(order, REFUNDED, owner)` → history row.
5. Commit → 200 with the updated return and order.

### Customer visibility
`GET /orders/me` and `GET /orders/{id}` (from P3) are extended with:
- `return_status` (`null` / `requested` / `approved` / `rejected`), `return_reason`, `owner_note`
- `refund`: `{amount, transaction_ref, refunded_at}` when a refund ledger entry exists
- `has_review`, `review` (rating and comment)

## Files to create
```
app/schemas/review.py (ReviewCreate, ReviewOut), return_request.py (ReturnCreate, ReturnRequestOut, RejectRequest)
app/services/review_service.py, return_service.py
app/api/v1/orders.py (review + return routes), owner.py (returns routes)
tests/test_reviews.py, tests/test_returns.py
```

## Tasks
- [x] Review endpoint + service
- [x] Return request endpoint + service
- [x] Owner list, approve and reject
- [x] Extend the order list and detail responses with return, refund and review info
- [x] Map `IntegrityError` on the UNIQUE constraints to 409

## Tests
- [x] Review: not delivered → 409; delivered → 201; second review → 409; rating 0 or 6 → 422; another customer's order → 404
- [x] Return: not delivered (PLACED, OUT_FOR_DELIVERY, CANCELLED) → 409; missing or short reason → 422; second request → 409
- [x] Approve → return `approved`, order REFUNDED, payment `refunded`, ledger has exactly 1 charge + 1 refund, history row added
- [x] Reject without a note → 422; reject → `rejected`, order DELIVERED, payment `mock_paid`, no refund entry
- [x] Approving or rejecting an already-resolved request → 409
- [x] Owner B acting on owner A's return → 404; customer calling the owner endpoints → 403

## Done when
A delivered order can be reviewed and returned; the owner can approve (refund recorded, order REFUNDED) or reject (status rejected); and the customer can see the payment, refund and return status on their order.

## Implementation notes (as built)

**Files**
```
app/schemas/review.py          + ReviewCreate (rating 1–5, comment ≤ 1000), ReviewOut
app/schemas/return_request.py  ReturnCreate (reason 10–500, trimmed), RejectRequest (owner_note 5–500), ReturnRequestOut
app/services/review_service.py create_review
app/services/return_service.py create_return, list_owner_returns, approve, reject, to_out
app/api/v1/orders.py           + POST /orders/{id}/review, POST /orders/{id}/return
app/api/v1/owner.py            + GET /owner/returns, POST /owner/returns/{id}/approve, POST /owner/returns/{id}/reject
tests/test_reviews_returns.py  32 tests
```

**Decisions made while building**
| Topic | Decision |
|---|---|
| Return response | `ReturnRequestOut` carries the order context the owner needs: customer name, total, `items_summary`, `order_status`, `payment_status`, placed time |
| Approve | One transaction: lock the return and the order → `mock_refund(note="return_approved")` → `transition(DELIVERED→REFUNDED)` (history row added) → return `approved` with `resolved_at` and `resolved_by` |
| Reject | Only the return changes (`rejected`, note, `resolved_at`, `resolved_by`); order stays DELIVERED, payment `mock_paid`, no ledger entry |
| Already resolved | Approving or rejecting again → 409 "Return request already approved/rejected"; never a second refund |
| Duplicates | Checked in code first, with the UNIQUE(order_id) constraint as a race backstop (`IntegrityError` → 409) for both reviews and returns |
| Refunded orders | Cannot be reviewed (only DELIVERED); they still appear in the delivery partner's history |
| Order detail | P3's `OrderDetail` already exposes `review`, `return_request`, `return_status`, `has_review` and `refund`, so the customer sees every status without extra endpoints |

**Verification log**
- [x] `pytest`: 186 passed (32 new), no warnings
- [x] Live server: review → 201, second review → 409, restaurant rating updated to 4.0; return → 201, short reason → 422; owner list shows the request; approve → REFUNDED / `refunded`; customer sees the refund amount and reference; ledger = charge + refund
