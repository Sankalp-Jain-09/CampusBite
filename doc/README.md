# CampusBite — Phase Documents

One document per implementation phase. Each one stands on its own: goal, scope, design details, files, task checklist, tests and the **Done when** check.

- Overall design and decisions: [../PLAN.md](../PLAN.md)
- Master checklist: [../TODO.md](../TODO.md)
- Requirements: [../prd.txt](../prd.txt)
- **Manual UI test plan (138 step-by-step checks):** [UI_TEST_PLAN.md](UI_TEST_PLAN.md) (results ticked; 5 regression checks added)
- **UI test report (175 cases, 8 bugs found and fixed, PostgreSQL run):** [UI_TEST_REPORT.md](UI_TEST_REPORT.md) · automated suite and screenshot script: [ui-test-run/](ui-test-run/)

| Phase | Document | Status |
|---|---|---|
| P0 | [Setup & Infrastructure](P0-setup-infrastructure.md) | 🟡 Code complete; Docker run pending |
| P1 | [Database Models, Auth & RBAC](P1-models-auth-rbac.md) | 🟡 Code complete; live PostgreSQL run pending |
| P2 | [Restaurant Catalog & Menu Management](P2-catalog-menu.md) | ✅ Done |
| P3 | [Orders Core: Checkout, State Machine, Assignment, Delivery](P3-orders-core.md) | ✅ Done |
| P4 | [Reviews, Returns & Refunds](P4-reviews-returns-refunds.md) | ✅ Done |
| P5 | [Owner Stats & Reminder Background Task](P5-stats-reminders.md) | ✅ Done |
| P6 | [AI Order Insights](P6-ai-insights.md) | ✅ Done |
| P7 | [Frontend Foundation](P7-frontend-foundation.md) | ✅ Done |
| P8 | [Customer UI](P8-customer-ui.md) | ✅ Done |
| P9 | [Owner & Delivery Partner UI](P9-owner-delivery-ui.md) | ✅ Done |
| P10 | [Seed Data, Polish, Docs & Submission](P10-seed-polish-submission.md) | 🟡 Built; Docker run, git push and submission are yours |

## Confirmed decisions referenced in these documents

| Ref | Decision |
|---|---|
| D2 | Separate signups, Zomato/Swiggy style: customer `/register`, restaurant "Partner with us", delivery "Ride with us"; one shared login. The server sets the role. |
| D3 | One restaurant per owner. |
| D4 | The cart lives on the client and holds items from one restaurant; the server recomputes prices at checkout. |
| D5 | After delivery, refunds go only through a return request with a reason and owner approval. Cancelling after the free window gives no refund. |
| D6 | Owners cannot reject or cancel orders. Their only action on a PLACED order is Accept. |
| D12 | Menu items are soft-deleted; order items store a snapshot of the name and price. |
| D14 | 60-second free cancellation window with an automatic full refund. No reason asked and no owner involvement. The owner cannot Accept during the window. |
