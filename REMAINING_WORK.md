# CampusBite — What's Left To Do

*Updated 10 Nov 2026*

**Everything is built, tested and running on this machine.**
- Backend: 228 tests.
- Frontend: 58 tests.
- Full UI test plan plus edge cases in a real browser: 175/175 after 8 bug fixes.
- **Docker Compose with PostgreSQL works** (UI suite 160/160 against it).
- README screenshots are up to date.

**Three steps are left, and all three need your accounts:** an OpenAI key, a git repository on GitHub, and submitting the link.

Status key: 🔴 required before submission · 🟡 recommended · ⚪ optional

> The project lives on this Linux machine at `~/concept understanding/practice/practice`. Quote the path, because it contains spaces: `cd ~/"concept understanding/practice/practice"`.

---

## Summary

| # | Task | Priority | Status | Who |
|---|---|---|---|---|
| 1 | Run the backend with Docker Compose | 🔴 | ✅ Done 10 Nov | — |
| 2 | Install Node.js 20 and run the frontend | 🔴 | ✅ Done 10 Nov | — |
| 3 | Get an OpenAI API key and test AI insights | 🔴 | ⏳ To do (5–10 min) | **You** (needs your OpenAI account and billing) |
| 4 | Run the manual UI test plan | 🟡 | ✅ Done 9–10 Nov | — |
| 5 | Retake the README screenshots | 🟡 | ✅ Done 10 Nov | — |
| 6 | Git: init, commit, check that no secrets are included | 🔴 | ⏳ To do (10 min) | **You** |
| 7 | Push to a public GitHub repository and submit the link | 🔴 | ⏳ To do (10 min) | **You** |
| 8 | Optional improvements | ⚪ | — | Ask me |

---

## What's running right now

| Part | How | URL |
|---|---|---|
| Backend + database | Docker Compose (`campusbite-backend`, `campusbite-db`, PostgreSQL 16) with fresh demo data | http://localhost:8000/docs |
| Frontend | Vite dev server on your Node 20 | http://localhost:5173 |

Demo login: `demo.customer@campusbite.dev` · `owner.curry@campusbite.dev` · `rider.one@campusbite.dev`, password `Demo@1234`.

---

## 1. ✅ Backend with Docker Compose — done

- [x] Docker Desktop started (`systemctl --user start docker-desktop`; Docker 29.2).
- [x] `docker compose up --build`: the log shows `Waiting for database` → `Running upgrade -> 0001, initial schema` (on PostgreSQL) → `Seed: created 7 users, 3 restaurants, 30 dishes, 17 orders, 2 reminders` → `Starting CampusBite API on port 8000`.
- [x] `/api/v1/health` returns `{"status":"ok","db":"ok"}`, and both containers report healthy.
- [x] Demo logins work. The full browser test suite passed against PostgreSQL (**160/160**, no server errors in 1,262 requests); see [doc/UI_TEST_REPORT.md](doc/UI_TEST_REPORT.md).
- [x] **One machine-specific setting:** `.env` now has `POSTGRES_PORT=5433`, because a local PostgreSQL already uses port 5432. This only changes the database port published on this machine; the backend reaches the database inside Docker as before. `.env.example` keeps the default 5432.

**Day-to-day commands:**
```bash
cd ~/"concept understanding/practice/practice"
systemctl --user start docker-desktop     # after a reboot, if Docker Desktop isn't running
docker compose up -d                      # start (add --build after backend code changes)
docker compose logs -f backend            # request logs
docker compose down                       # stop (keeps data); add -v to reset the demo data
```

Phases **P0 and P1 are now complete** ([TODO.md](TODO.md)).

---

## 2. ✅ Node.js 20 and the frontend — done

- [x] nvm installed; **Node 20.20.2 / npm 10.8.2** is the default in every new terminal. The system `/bin/node` v12 is untouched, and nvm takes priority.
- [x] `frontend/.env` created from `.env.example`; dependencies reinstalled with Node 20 (`npm ci`); 58 tests pass; the build is clean.
- [x] The dev server runs on your Node at http://localhost:5173. To start it yourself later:
  ```bash
  cd ~/"concept understanding/practice/practice/frontend"
  npm run dev
  ```

---

## 3. 🔴 OpenAI API key and AI insights — your step

This needs your OpenAI login and a payment method, so it can't be done for you.

**Already verified without a key**, using a local OpenAI stand-in:
- the full request flow and the answers based on your orders
- the 10-per-minute rate limit ("try again in N seconds")
- "AI insights are not configured" without a key
- the new-customer message
- privacy: only the caller's own orders are sent to the model

1. Create a key at https://platform.openai.com/api-keys.
2. Add a little credit under **Settings → Billing** (about $5 is plenty). The API is pay-as-you-go and separate from ChatGPT Plus. Optional: set a monthly limit under **Settings → Limits**.
3. Put it **only** in the root `.env`: `OPENAI_API_KEY=sk-...` (never in `.env.example` or the code).
4. Apply it: `docker compose up -d --force-recreate backend`.
5. As the customer, open **AI insights** and click all 4 suggested questions. Check that the answers match your orders (plan C-36 to C-38).

If every answer is "AI service is busy, please try again shortly", the account has no quota: add billing credit (or see 8.1).

---

## 4. ✅ Manual UI test run — done

- [x] All of **[doc/UI_TEST_PLAN.md](doc/UI_TEST_PLAN.md)** (138 cases + 5 regression checks) plus **37 edge cases**, automated with Playwright in Chromium (desktop and phone-size).
- [x] **8 bugs found and fixed** (3 Medium, 5 Low) with regression tests. Re-run: **175/175** on SQLite and **160/160** on Docker + PostgreSQL.
- [x] Report: **[doc/UI_TEST_REPORT.md](doc/UI_TEST_REPORT.md)**. The suite for re-running is in `doc/ui-test-run/scripts/`.

**Not covered** (optional, worth a quick look by you): Safari/Firefox and one real phone.

---

## 5. ✅ README screenshots — done

- [x] All 15 screenshots in `doc/screenshots/` retaken on 10 Nov against fresh demo data, with the same sizes and framing. They now show the restaurant photos and the current UI, in the app's intended font (Inter).
- [x] Script for future retakes: `doc/ui-test-run/scripts/screenshots.mjs`.

---

## 6. 🔴 Git: init and first commit (check for secrets) — your step

The folder still isn't a git repository (you asked to skip `git init`). `.gitignore` already excludes these, which **must not** be committed:
- `.env` and `frontend/.env`
- `node_modules/`
- `backend/.venv/`
- `frontend/dist/`
- `*.db` (e.g. `backend/campusbite.db`)
- caches

```bash
cd ~/"concept understanding/practice/practice"
git init -b main
git add .
git status                                                   # review the file list
git ls-files | grep -i "\.env"                               # expect only .env.example files
git ls-files | grep -E "\.db$|\.venv/|node_modules/|dist/"   # expect nothing
git grep -nI "sk-" -- ':!*.lock' ':!package-lock.json'       # only the fake "sk-stub" in doc/ui-test-run/scripts is expected
git commit -m "CampusBite: full-stack restaurant ordering & delivery platform"
```

**Notes:**
- `.env.example` contains only placeholders (`change_me`, `replace_with_long_random_string`, empty `OPENAI_API_KEY`).
- `prd.txt` and `CLAUDE.md`: keep or delete as you prefer.
- `doc/ui-test-run/scripts/start_backend.sh` and `reset_db.sh` contain this machine's project path, which is harmless.

---

## 7. 🔴 Publish and submit — your step

- [ ] Create a **new public repository** on GitHub (e.g. `campusbite`), without a README.
- [ ] Push:
  ```bash
  git remote add origin https://github.com/<your-username>/campusbite.git
  git push -u origin main
  ```
- [ ] Open it in a **private/logged-out window** to confirm it's public.
- [ ] Recommended **fresh-clone test**: clone into a new folder and follow only the README:
  `cp .env.example .env` → set secrets → `docker compose up --build`, and in `frontend/`, `cp .env.example .env && npm ci && npm run dev`.
  Stop the current stack first (`docker compose down`), because it uses the same ports.
- [ ] Submit the repository URL.

---

## 8. ⚪ Optional improvements (ask me and I'll do them)

| # | Improvement | Why |
|---|---|---|
| 8.1 | Show **"AI quota exhausted — check OpenAI billing"** instead of "AI service is busy" when the key has no credit | Clearer message; avoids pointless retries |
| 8.2 | Store the dish and restaurant photos **inside the project** (`frontend/public/images/`, ~1.7 MB) | Works offline and doesn't depend on Wikimedia |
| 8.3 | Add a **frontend service to docker-compose** | One command starts everything (the PRD only requires the backend in Docker) |
| 8.4 | Add a **GitHub Actions** workflow that runs the backend and frontend tests on every push | Shows CI and catches regressions |
| 8.5 | Make the AI suggestion chips (30 px) and the dialog close × (21×32 px) at least **40 px** tall | Matches the project's own tap-target rule (test report OBS-1) |
| 8.6 | Bundle the **Inter** font with the app (e.g. `@fontsource/inter`) | The app asks for Inter but doesn't ship it, so Linux/Windows users without it see a fallback font |
| 8.7 | Real-time updates with WebSockets | Not required by the PRD; polling every 15–60 s already covers tracking |

---

## Phase status (from [TODO.md](TODO.md))

| Phase | Status | What's missing |
|---|---|---|
| P0 Setup & infrastructure | ✅ | — (Docker Compose verified 10 Nov) |
| P1 Models, auth & RBAC | ✅ | — (migration applied on PostgreSQL 16) |
| P2 – P9 | ✅ | — |
| P10 Seed, polish, docs | 🟡 | Tasks 3, 6, 7 (your accounts) |

## Quick reference

| What | Where |
|---|---|
| Requirements | [prd.txt](prd.txt) |
| Design & decisions | [PLAN.md](PLAN.md) |
| Build checklist | [TODO.md](TODO.md) |
| Per-phase design & as-built notes | [doc/](doc/README.md) |
| Manual UI test plan (results ticked) | [doc/UI_TEST_PLAN.md](doc/UI_TEST_PLAN.md) |
| UI test report (bugs, fixes, edge cases, PostgreSQL run) | [doc/UI_TEST_REPORT.md](doc/UI_TEST_REPORT.md) |
| Automated UI test suite + screenshot script | [doc/ui-test-run/](doc/ui-test-run/) |
| How to run, env vars, API table | [README.md](README.md) |
| Demo login | `demo.customer@campusbite.dev` · `owner.curry@campusbite.dev` · `rider.one@campusbite.dev` — password `Demo@1234` |
