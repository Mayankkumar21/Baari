# AGENTS.md — Baari

Context for AI coding agents working on this repo. Read top-to-bottom once.
Everything you need to make safe, in-style changes is here.

---

## 1. What Baari is

A multi-tenant SaaS that replaces the **paper register** at the front desk
of any appointment-based business — clinics (primary use case, all original
PRD copy), salons, dental, spa, vet, etc. Each tenant signs up to their own
isolated workspace.

**Core problem solved:** a receptionist running a 100-patient/day clinic
keeps track of arrivals, tokens, family groups, no-shows, and WhatsApp
notifications, all in real time on one screen. The doctor sees who's next
and clicks "Mark done." No paper, no app installs.

**Target market:** Tier 2/3 cities in India. Free during early access.

**Original product spec:** `PRD-ClinicQueue.md` lives in the source folder
(not in this repo) — has 70+ numbered requirements across booking, queue,
check-in, notifications, family sub-tokens, no-show automation, day mgmt,
reports, auth.

---

## 2. Architecture at a glance

```
                  baari.in (future)        app.baari.in (future)
                       │                            │
            ┌──────────▼──────────┐      ┌─────────▼──────────┐
            │  Next.js frontend   │      │  Python backend    │
            │  (marketing only)   │      │  (the actual app)  │
            │                     │      │                    │
            │  baari-web-lac      │      │  baariprod         │
            │  .vercel.app        │      │  .vercel.app       │
            └─────────────────────┘      └───────────┬────────┘
                                                     │
                                          ┌──────────▼──────────┐
                                          │  Neon Postgres      │
                                          │  ap-southeast-1     │
                                          └─────────────────────┘
                                                     ▲
                                          ┌──────────┴──────────┐
                                          │  GitHub Actions     │
                                          │  cron-tick / 5 min  │
                                          └─────────────────────┘
```

**Two Vercel projects, one GitHub repo:**

- **Python backend** at repo root — FastAPI + Jinja2 + HTMX. Serves
  `/signup`, `/login`, `/queue`, `/settings`, `/reports`, `/api/cron/tick`,
  etc. The actual product.
- **Next.js frontend** under `frontend/` — marketing landing only. Has
  buttons that link to the backend for signup/login. Zero app logic.

Pushes that touch only `frontend/**` rebuild only Next.js. Pushes that
touch `api/**` or `app/**` rebuild only Python. Independent deploys.

---

## 3. Repo layout

```
Baari/
├── api/index.py                    # FastAPI app — Vercel Python entrypoint
├── app/
│   ├── config.py                   # Env-driven settings via pydantic-settings
│   ├── db.py                       # SQLModel engine + per-request session
│   ├── deps.py                     # Auth deps: current_user, DoctorUser, etc.
│   ├── i18n.py                     # English + Hindi string tables
│   ├── models.py                   # ALL DB tables (single file)
│   ├── time_utils.py               # IST display helpers — storage is UTC
│   ├── templating.py               # Jinja env with theme/lang/vocab processors
│   ├── vocab.py                    # Per-tenant-type label vocabulary
│   ├── routes/                     # FastAPI routers by domain
│   │   ├── auth.py                 # /login /logout /lang /theme
│   │   ├── signup.py               # / /signup (public)
│   │   ├── setup.py                # /setup wizard
│   │   ├── queue.py                # /queue + state-transition actions
│   │   ├── booking.py              # /bookings/new /bookings
│   │   ├── search.py               # /search /bookings/{id}
│   │   ├── reports.py              # /reports /reports/{date}
│   │   ├── settings.py             # /settings + user management
│   │   └── cron.py                 # /api/cron/tick (Bearer-secret protected)
│   ├── services/
│   │   ├── auth.py                 # bcrypt + JWT helpers
│   │   ├── queue_service.py        # Queue state machine + board VM
│   │   ├── booking_service.py      # Slot allocation, token assignment
│   │   ├── subtoken_service.py     # Family sub-token CRUD
│   │   ├── search_service.py
│   │   ├── reports_service.py
│   │   ├── settings_service.py
│   │   ├── signup_service.py       # Self-serve tenant creation
│   │   ├── notifications.py        # MSG91 WhatsApp dispatch
│   │   ├── cron_jobs.py            # No-show sweep + auto-close + GC
│   │   ├── day_close.py            # End-of-day summary + lock
│   │   ├── rate_limit.py           # DB-backed fixed-window limiter
│   │   ├── turnstile.py            # Cloudflare bot verify
│   │   └── cred_ledger.py          # ⚠ plaintext password log (MVP debt)
│   └── templates/
│       ├── layouts/                # base.html, app.html
│       ├── pages/                  # login, queue, signup, setup, settings…
│       └── partials/               # queue_board, queue_row, search_*, etc.
├── static/css/app.css              # Design tokens — light + dark themes
├── scripts/
│   ├── create_user.py              # Out-of-band user provisioning
│   └── make_late.py                # Backdate a booking for no-show testing
├── migrations/
│   ├── env.py                      # Alembic env
│   └── versions/                   # 3 migrations: init, tenant_type, rate_limit
├── frontend/                       # Next.js marketing landing
│   ├── app/                        # App Router pages
│   │   ├── layout.tsx              # Fonts + ThemeProvider
│   │   ├── page.tsx                # Landing page composition
│   │   └── globals.css             # Design tokens — mirror app.css
│   ├── components/
│   │   ├── ui/button.tsx           # shadcn Button + 'glow' variant
│   │   ├── sections/               # Hero, DashboardPreview, Verticals, etc.
│   │   ├── icons/tooth.tsx         # Custom tooth glyph
│   │   ├── site-header.tsx
│   │   ├── site-footer.tsx
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx
│   ├── lib/utils.ts                # cn() helper
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── vercel.json                 # {"framework":"nextjs"} — pin
│   └── .env.example                # NEXT_PUBLIC_APP_URL
├── docker-compose.yml              # All-in-one dev: app + Postgres
├── Dockerfile
├── docker/entrypoint.sh            # Runs alembic upgrade head then uvicorn
├── start-baari.command             # macOS one-click launcher
├── start-baari.bat                 # Windows one-click launcher
├── .github/workflows/cron-tick.yml # Hits /api/cron/tick every 5 min
├── vercel.json                     # Python project routing
├── requirements.txt
├── pyproject.toml
├── alembic.ini
└── README.md
```

---

## 4. Stack & versions

**Backend (root):**
- Python 3.12
- FastAPI 0.115.6
- SQLModel 0.0.22 (Pydantic 2.x + SQLAlchemy 2.x)
- Jinja2 3.1.4 templates
- HTMX 2.0.4 + Alpine.js 3 for interactivity (no React/build step)
- Postgres via psycopg 3.2.3
- Alembic 1.14 migrations
- passlib + bcrypt for password hashing
- PyJWT 2.10.1 for session tokens
- httpx 0.28.1 for outbound (MSG91, Turnstile)
- pydantic-settings 2.7 for env

**Frontend (`frontend/`):**
- Next.js 15.x (App Router) on React 19
- TypeScript strict
- Tailwind CSS 3.4 + shadcn token convention
- `motion` (Framer Motion successor) 11.x for animations
- `next-themes` 0.4.x for OS-aware light/dark
- `lucide-react` for icons (+ custom `Tooth` SVG)
- Inter + Noto Sans Devanagari from `next/font/google`

**Infra:**
- Vercel Hobby (free) for both projects
- Neon Postgres free tier, `ap-southeast-1` (Singapore)
- GitHub Actions for cron (Hobby Vercel Cron is daily-only, too coarse)
- MSG91 (WhatsApp Business API) — keys empty in dev → no-op dispatch
- Cloudflare Turnstile (optional) — both env vars empty → widget hidden

---

## 5. Data model

All tables have `clinic_id` from day 1 (multi-tenant ready). All
timestamps `TIMESTAMP` (naive UTC currently — see "tz debt" below).

| Table | Purpose |
|---|---|
| `clinics` | Tenant workspaces. `tenant_type` (clinic / salon / spa / dental / vet / other) drives vocab. `opening_hours` JSON with morning/evening shifts. `slot_length_min`, `no_show_threshold_min`. `setup_complete` gates the wizard. `retention_days` (730 default — sweep not implemented yet). |
| `users` | Doctor + receptionist accounts. Composite-unique on (clinic_id, mobile). `password_hash` is bcrypt. `role` enum: doctor or receptionist. |
| `patients` | Per-tenant patient records. Unique on (clinic_id, mobile). `is_new` flips false after first done. `whatsapp_opt_out` suppresses all notifications. `anonymized_at` for DPDP support (UI not built). `no_show_count`. |
| `bookings` | One row per appointment. Composite-unique on (clinic_id, date, token). Holds full lifecycle timestamps: checked_in_at, started_at, completed_at, cancelled_at, no_show_at, restored_at. `wait_estimate_min` reserved for future live recalc. |
| `sub_tokens` | Family members under a parent booking. Composite-unique on (booking_id, suffix). Up to 5 per parent (PRD §5). Independent status machine. |
| `notifications` | Every WhatsApp dispatch attempt. Fields: trigger, channel, status (queued/sent/failed), provider_message_id, template_name, payload JSON, failure_reason, sent_at. |
| `audit_log` | Designed for state-change events. **Currently empty — nothing writes to it.** |
| `daily_summaries` | One row per (clinic_id, date) after day-close. Aggregated metrics. |
| `rate_limit_buckets` | Fixed-window counters. `bucket_key` is composite `scope:identifier:windowEpoch`. GC'd by cron. |
| `alembic_version` | Single row tracking migration head. |

**Enums:**
- `UserRole`: doctor, receptionist
- `TenantType`: clinic, salon, spa, dental, vet, other
- `BookingStatus`: booked, checked_in, in_consult, done, no_show, cancelled
- `SubTokenStatus`: booked, checked_in, in_consult, done, cancelled, no_show
- `NotificationTrigger`: booking_confirmed, youre_next, slot_changed, wait_changed, cancelled, no_show, restored
- `NotificationStatus`: queued, sent, failed

---

## 6. Auth & multi-tenancy

**Auth:**
- Mobile + bcrypt password (no email, no OTP, no signup verification)
- JWT in HTTP-only Secure SameSite=Lax cookie called `baari_session`
- Expiry: 7 days for doctor, 30 days for receptionist
- Provisioning: self-serve via `/signup` (most users) OR
  `scripts/create_user.py` (operator override)
- No password-reset-by-self — doctor resets receptionist from Settings;
  operator resets doctor via the seed script

**Multi-tenancy:**
- Every query filters by `clinic_id`. Tenant A literally cannot see B's
  data through the app.
- App-enforced isolation, NOT Postgres row-level security. A future
  bug forgetting the filter could leak. Add RLS before scaling beyond
  a few vendors.

**Roles:**
- `doctor` — admin. Mark done, reports, settings, close day.
- `receptionist` — staff. Queue + bookings + check-in. No reports/settings.

**Cron auth:**
- `/api/cron/tick` requires `Authorization: Bearer <CRON_SECRET>`.
  Without it: 401. GitHub Actions sends the header.

---

## 7. The queue state machine (the core logic to never break)

This is the heart of the product. Read `app/services/queue_service.py` if
touching anything that affects it.

```
                      ┌─────────────┐
        new booking → │   booked    │ ← can reschedule / cancel
                      └──────┬──────┘
                  check_in() │
                      ┌──────▼──────┐
                      │ checked_in  │
                      └──────┬──────┘
       auto-promote  │      OR
       when idle     │  ┌───┴──────────┐
                      ▼ │  no_show     │ ← cron sweep (slot + 45min past)
                ┌─────────▼────────┐  │
   mark_done()  │   in_consult     │ ┌▼───────────┐
                └─────────┬────────┘ │  restore   │ → back to checked_in
                  ┌───────▼────────┐ │  (end of   │   at end of queue
                  │      done      │ │  queue)    │
                  └───────┬────────┘ └────────────┘
                          │
                       30s undo window
                          │
                       restored ↔ in_consult
```

**Auto-promotion rules** (`_try_promote_next_booking` and `_try_promote_within_group`):

1. When a booking is marked done, look for the FIRST pending sub-token
   in the same parent group. If found → promote that sub-token to
   `in_consult`. (Family flow: T5 done → T5.1 in_consult, not T6.)
2. If no pending sub-tokens in the group, look for the next
   checked-in booking. Lowest token first, BUT restored patients sort
   to the end (PRD §10.5).
3. Auto-promote only fires if NO booking AND NO sub-token is currently
   in_consult.

**The 30-second undo window** (PRD §3.6):
- `mark_done` records `completed_at = now`. The board's view-model marks
  rows `is_undoable = True` while `now - completed_at < 30s`.
- `undo_done` reverses status and (if auto-promote already moved on)
  pushes the promoted booking back to checked_in.

**Family sub-tokens** (PRD §5):
- Max 5 per parent. Added via `/queue/{booking_id}/sub-tokens`.
- Can be added at booking time OR mid-consult (parent already in_consult).
- Cancel a sub-token independently with `/queue/sub-tokens/{id}/cancel`.

**Lateness display:**
- Pure view-model concern (`is_late` flag on `QueueRowVM`).
- Not a status transition — patient can still check in normally.
- Triggers when `now - slot_time >= 15 min` AND status in (booked, checked_in).

**No-show transition:**
- Cron-only. App code never sets `no_show` directly.
- Sweep: `slot_time + clinic.no_show_threshold_min < now` AND status in
  (booked, checked_in) → set `no_show`, increment patient counter,
  fire WhatsApp.

**Datetime quirk** ⚠
- DB columns are `TIMESTAMP` (naive, no tz). `now_utc()` returns aware.
- All comparison sites strip tz: `now_utc().replace(tzinfo=None)`.
- Form-submitted slot_times (aware IST) are converted to naive UTC at the
  route boundary before storage. See `routes/booking.py:_normalize_slot`.
- This is tech debt — proper fix is migrating columns to `TIMESTAMPTZ`.
  Don't add new comparisons that mix aware/naive without normalizing first.

---

## 8. Background jobs

`/api/cron/tick` fires every 5 minutes via GitHub Actions workflow
`.github/workflows/cron-tick.yml`. Triggered by:

```bash
curl -X POST "$APP_URL/api/cron/tick" -H "Authorization: Bearer $CRON_SECRET"
```

Each tick walks every clinic and runs:

1. **`sweep_no_shows(clinic)`** — `cron_jobs.py`. Transitions overdue
   bookings to `no_show` and fires the WhatsApp notification per patient.
2. **`maybe_auto_close(clinic)`** — closes the day at `≥ 23:55 IST` if
   not already closed. Idempotent — running every 5 min is fine.
3. **`gc_old_buckets(db)`** — `rate_limit.py`. Deletes
   `rate_limit_buckets` rows older than 2 hours.

GitHub Actions can drift by up to ~10 min on the free tier — acceptable
for these jobs.

---

## 9. WhatsApp notifications (MSG91)

`app/services/notifications.py` handles all 6 PRD triggers:

| Trigger | Fired by | Template params |
|---|---|---|
| `booking_confirmed` | `routes/booking.py` after create | token, slot, clinic |
| `youre_next` | `routes/queue.py` after auto-promotion | token, clinic |
| `slot_changed` | `routes/search.py` reschedule | token, old, new, clinic |
| `cancelled` | `routes/search.py` cancel | token, clinic |
| `no_show` | `cron_jobs.sweep_no_shows` | token, clinic |
| `restored` | `routes/queue.py` restore | token, clinic |

Templates are pre-approved on MSG91 with these exact names. Bilingual
(English + Hindi) per PRD §4.7 — single concatenated message.

**Dev-mode skip:** if `MSG91_AUTH_KEY` is empty, `_send_via_msg91`
returns `(False, None, "dev-mode-skip")` immediately and the
notification row is recorded as `status=failed,
failure_reason="dev-mode-skip"`. No HTTP call. App keeps working.

**Patient opt-out:** if `patient.whatsapp_opt_out` is true, dispatch
records `status=failed, failure_reason="patient_opt_out"`. Never sends.

---

## 10. Theme & design tokens (light + dark)

Both `static/css/app.css` (Python) and `frontend/app/globals.css`
(Next.js) hold the **same palette** — recently unified to a modern
aesthetic:

| Token | Light | Dark |
|---|---|---|
| `--bg-canvas` | `#fcfcfc` (off-white) | `#08080b` (near-pure black) |
| `--bg-primary` | `#ffffff` (card) | `#0f0f12` (card) |
| `--accent-blue` | `#6366f1` (indigo-500) | `#8b8cf6` (indigo-300) |
| `--text-primary` | `#101013` (deep neutral) | `#fafafa` (white) |

The variable is named `--accent-blue` for historical reasons but now
holds **indigo**. Don't rename — too much downstream churn.

Status colors map to standard Tailwind hues: emerald for success, amber
for warning, red for danger, indigo for info.

**Brand exceptions** that stay static across themes:
- `.btn.success` "Mark done" button — semantic green `#5b9d20`. Don't
  parametrize. Green = complete is cross-cultural.
- White text on indigo primary buttons (`color: #fff`) — always.

**Theme switching:**
- Both apps respect `prefers-color-scheme` when no cookie/preference set.
- Python: `baari_theme` cookie (`light` or `dark`, empty for OS auto).
  Read in `app/templating.py` and stamped onto `<html data-theme>`.
- Next.js: `next-themes` library handles it (localStorage-backed).
- Both have a client-side `syncThemeUI()` so first-click correctness on
  OS-auto users isn't broken (don't remove this).

---

## 11. i18n — English + Hindi (Devanagari)

`app/i18n.py` has bilingual strings keyed by dotted paths
(`nav.queue`, `queue.title`, etc.). Templates pull via `t("key")`.
Inject point is `templating._i18n_processor`.

**Current state:**
- **Chrome translated:** top nav, queue counters, status pills, empty
  states, buttons.
- **Page bodies NOT translated:** "Search bookings", "Reports", booking
  detail labels, etc. Mechanical pass to do later.

**Next.js landing:** zero i18n yet (it's marketing copy, can be
localized when needed).

Patient/customer names and reasons accept BOTH scripts at input — fonts
(Inter + Noto Sans Devanagari) are loaded so either renders cleanly.

---

## 12. Per-tenant vocabulary (multi-vertical)

`app/vocab.py` maps `tenant_type` → label dict.

Example for `salon`:
```
provider: stylist, entity_singular: customer,
session: service, reason_label: "Service requested"
```

The `vocab` global is injected into every authenticated template render
via `_vocab_processor`. **However**, most templates still use the literal
clinic words ("Patient name", "Reason for visit"). Pass-through to vocab
is a mechanical refactor pending — until then, a salon signup sees the
correct landing/signup labels but the dashboard still says "Patient."

---

## 13. Running locally

### Backend (Python)

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill: DATABASE_URL (Neon), JWT_SECRET, CRON_SECRET

alembic upgrade head     # apply migrations
python -m uvicorn api.index:app --reload --port 8000
```

Open `http://localhost:8000`. Use a freshly created tenant via `/signup`.

**Conda gotcha on macOS:** `conda deactivate` if `(base)` is active. The
PATH from conda's base env shadows the venv's `uvicorn` binary and makes
the wrong Python interpreter run.

### Frontend (Next.js)

```bash
cd frontend
cp .env.example .env.local      # set NEXT_PUBLIC_APP_URL=http://localhost:8000
npm install
npm run dev                      # http://localhost:3000
```

### All-in-one (Docker — non-technical testers)

Double-click `start-baari.command` (macOS) or `start-baari.bat` (Windows).
Requires Docker Desktop. Bundles its own Postgres so there's nothing to
configure. The Python app runs on `:8000` inside the container; access at
`http://localhost:8000`.

---

## 14. Database migrations

```bash
# Generate a new migration after model changes:
alembic revision --autogenerate -m "what changed"

# Apply to whatever DATABASE_URL points at (often prod Neon):
alembic upgrade head

# Roll back one step:
alembic downgrade -1
```

⚠ Your local `.env` points at the production Neon DB. Any
`alembic upgrade head` you run from your laptop hits prod. Before a real
team forms, set up a separate dev Neon project.

**Current migrations on `main`:**

```
cfec55c85bb4  init
800af70b2198  tenant_type on clinics
c7a2e1b35d9f  rate_limit_buckets
```

---

## 15. Deployment

Two Vercel Hobby projects, both pointed at this GitHub repo:

| Project | URL | Root Directory | Framework |
|---|---|---|---|
| `baariprod` | `baariprod.vercel.app` | (root) | Other (Python) |
| `baari-web` | `baari-web-lac.vercel.app` | `frontend` | Next.js |

The Next.js project is pinned via `frontend/vercel.json` (`{"framework":
"nextjs"}`) because Vercel's auto-detect sometimes picks "Other" and
then looks for `public/` instead of `.next/`. Don't remove that file.

**Vercel cron is daily-only on Hobby** — our `/api/cron/tick` needs to
fire every 5 min, so it's driven by GitHub Actions instead (see
`.github/workflows/cron-tick.yml`).

Custom domain plan (when bought):
- Point apex `baari.in` → `baari-web` project (the marketing landing)
- Point `app.baari.in` → `baariprod` project (the actual app)
- Update `NEXT_PUBLIC_APP_URL` env var in `baari-web` to `https://app.baari.in`

---

## 16. End-to-end test flows (run after non-trivial changes)

**Critical paths to manually validate** — for either prod or local.

### A. Signup → setup → first booking

1. Open landing → click **Start for free**.
2. Signup form: pick a vertical (try `salon` to test multi-vertical
   defaults), name, mobile (use any 10-digit number for testing —
   not your real one), password (must contain letter+digit, ≥8 chars).
3. Submit → auto-logged-in → land on `/setup` wizard.
4. Wizard renders defaults, click **Save** → land on `/queue`.
5. Click **+ New booking**, fill out the form, pick a slot.
6. Verify the booking appears in **Waiting** with token T1.

### B. Queue flow + family sub-tokens

7. Click **Check in** on T1 → it auto-promotes to **Now consulting**.
8. Open the **Add family member** disclosure → add "Ravi" → submit.
9. Verify T1.1 pill appears under the patient name.
10. Click **Mark done** on T1 → verify T1.1 auto-promotes to in_consult.
11. Mark T1.1 done → queue idle, T1 + T1.1 both shown in **Done today**.

### C. Search + reschedule + cancel

12. Go to **Search** → type partial name → verify result under "Today".
13. Click the result → booking detail page renders.
14. (Only if status is booked or checked_in) reschedule to a new slot.
15. Cancel a different booking → verify it shows "Cancelled" pill.

### D. Theme + language toggles

16. Click the moon/sun icon in the topbar → page flips to opposite theme.
17. Click the **हिन्दी / English** button → top nav + counters switch
    scripts. Verify both fonts (Inter + Noto Sans Devanagari) render
    cleanly without baseline drift.

### E. Settings (doctor only)

18. Edit slot length or no-show threshold → save.
19. Add a receptionist account → verify one-time password appears in a
    yellow card. Sign out and sign in as the new receptionist → verify
    they CANNOT see Reports or Settings.
20. Sign back in as doctor → reset receptionist password → verify the
    new password works.

### F. Reports

21. Close the day (top right button on `/queue`).
22. Go to **Reports** → verify the day shows up with metrics.
23. Click the day → verify metrics grid + hourly bar chart + patient
    timeline all render. Numbers should match what you did.

### G. No-show automation (without waiting 45 min)

24. Create a booking.
25. Run `python scripts/make_late.py --booking-id N --minutes 50` from
    a terminal pointed at the same DB.
26. Trigger cron: `curl -X POST .../api/cron/tick -H "Authorization: Bearer $CRON_SECRET"`
27. Refresh `/queue` → verify the booking is marked **No show**.
28. Click **Restore** → verify it goes back to end of the waiting queue
    with token retained.

### H. Security (Tier 1)

29. Try signing up with a weak password (e.g. `11111111`) → expect 400
    with error "Password must be at least 8 characters and contain both
    letters and numbers."
30. Hit `/signup` 6+ times rapidly from the same IP → expect 429 "Too
    many signups from your network."
31. Open dev tools, add a `<input name="company" value="bot">` to the
    form, submit → expect silent 303 to `/` with no account created.

### I. Multi-tenant isolation

32. Sign up as Tenant A. Create some bookings.
33. Sign up as Tenant B in a different browser/incognito. Create a
    booking with mobile that matches a Tenant A patient.
34. Verify: Tenant B does NOT see Tenant A's bookings. Tenant A's
    `no_show_count` for that mobile is unaffected by Tenant B's actions.

### J. WhatsApp dispatch (dev mode, no real send)

35. Create a booking. Check the `notifications` table in Neon:
    ```sql
    SELECT trigger, status, failure_reason, created_at
    FROM notifications
    WHERE clinic_id = <yours>
    ORDER BY created_at DESC LIMIT 10;
    ```
36. Expect rows for `booking_confirmed`, `youre_next` (after check-in),
    all with `status='failed', failure_reason='dev-mode-skip'`. The
    audit trail is there even though no message went out.

### K. Cron health

37. GitHub repo → **Actions** tab → `cron-tick` workflow → verify a
    green run every ~5 min.
38. Recent failure? Click into it; the curl step's exit code shows.

### L. Landing (Next.js)

39. Open the Next.js URL → verify hero, dashboard mockup, 6 verticals
    with correct icons (especially the **tooth** for Dental — not a bone),
    feature grid, closing CTA, footer.
40. Click **Start for free** → routes to backend `/signup`.
41. Click **Sign in** in header → routes to backend `/login`.
42. Toggle dark/light — both should look polished (no white flashes).

---

## 17. Known gaps & tech debt (prioritized)

**Ship-stopping before real users:**
1. **`cred_ledger.py` writes plaintext passwords.** Local-only (gitignored
   `data/`); ephemeral on Vercel `/tmp`. Delete the writer module before
   any production-grade launch. The bcrypt hash in `users.password_hash`
   is the real source of truth.
2. **No CSRF tokens** on state-changing forms. SameSite=Lax helps but
   isn't airtight.
3. **No mobile/email verification** at signup — anyone can sign up as
   `9999999999`.

**Friction items (medium):**
4. **Datetime columns are naive `TIMESTAMP`, not `TIMESTAMPTZ`.** Every
   comparison site has to strip tz manually. Fragile. Migration would
   touch many files — left for a dedicated session.
5. **Per-tenant vocabulary wired but not applied** to most templates. A
   salon owner sees "Patient name" in the booking form. Mechanical fix.
6. **Page-body i18n incomplete** — only chrome translated. Salon/clinic
   users on हिन्दी see half-translated pages.
7. **"No slots available today" dead-end** if a user signs up after their
   evening shift ends. Walk-in slot would fix it.
8. **HTMX 1 extension (`response-targets`) loaded with HTMX 2** — console
   warning, no functional impact. Swap the CDN URL.

**Quality of life:**
9. **Audit log writes** — table exists, nothing writes to it. Wire on
   state changes.
10. **Wait-time live recalc + `wait_changed` notification** (PRD §4.4).
    Schema field exists; logic doesn't.
11. **PDF export of daily summaries** (PRD §8). Use WeasyPrint.
12. **Closed-days UI** — model field exists, no settings UI exposes it.
13. **Data retention sweep** — `clinics.retention_days` defaults to 730
    but no cron job honors it. Required for DPDP compliance at scale.
14. **No automated tests.** Pytest the queue state machine first.

**Operational:**
15. Vercel Hobby allows 100K function invocations/month; one open queue
    page polling every 10s = ~130K/month. Move to Pro ($20/mo) or
    Railway when paying customers exist. Or bump polling to 30s.

---

## 18. Security posture

**Live now (Tier 1):**
- Bcrypt password hashing
- JWT in HTTP-only Secure SameSite=Lax cookie
- Multi-tenant isolation via app-enforced `clinic_id` filter
- `/api/cron/tick` Bearer-secret auth
- HTTPS enforced by Vercel
- Rate limit `/signup` (5/IP/hour) + `/login` (10/mobile/15-min) — DB
  fails open on any error
- Honeypot field on `/signup` (silent 303 to `/` if filled)
- Password strength enforced on signup (≥8 chars, letters AND digits)
- Cloudflare Turnstile widget — wired but inactive until env vars set

**Missing (Tier 2+):**
- CSRF tokens
- Mobile/email verification
- 2FA on doctor accounts
- Postgres row-level security
- WAF in front of Vercel
- Audit log writes
- DPDP Act 2023 retention sweep

---

## 19. Environment variables

### Backend (Vercel `baariprod` + local `.env`)

```
DATABASE_URL                       postgresql+psycopg://...        REQUIRED
JWT_SECRET                         random 48+ chars                REQUIRED
CRON_SECRET                        random 48+ chars                REQUIRED
APP_ENV                            production | dev                default: dev
CLINIC_TZ                          Asia/Kolkata                    default: Asia/Kolkata
MSG91_AUTH_KEY                     (blank = dev-mode skip)         optional
MSG91_WHATSAPP_INTEGRATED_NUMBER   (blank = dev-mode skip)         optional
MSG91_WHATSAPP_NAMESPACE           (blank = dev-mode skip)         optional
TURNSTILE_SITE_KEY                 (blank = widget hidden)         optional
TURNSTILE_SECRET_KEY               (blank = verify returns True)   optional
```

### Frontend (Vercel `baari-web` + local `frontend/.env.local`)

```
NEXT_PUBLIC_APP_URL                URL of the Python backend       REQUIRED
                                   (e.g. https://baariprod.vercel.app)
```

### GitHub Actions secrets (for cron)

```
APP_URL                            https://baariprod.vercel.app
CRON_SECRET                        same value as the backend env var
```

---

## 20. Common pitfalls

- **Don't mix aware and naive datetimes.** Strip tz at comparison sites.
  See `queue_service.py:build_board` for the pattern.
- **Don't query without `clinic_id`.** Multi-tenant leakage will be
  silent and your test data won't catch it.
- **Don't add a new template without confirming it uses CSS variables.**
  Hardcoding `#185fa5` instead of `var(--accent-blue)` will break the
  theme toggle.
- **Don't commit `data/credentials.jsonl`.** It's gitignored — verify
  before pushing.
- **Don't change variable names in `app.css` / `globals.css`.** Templates
  reference `--accent-blue`, `--bg-canvas`, etc. by name everywhere.
- **Don't break the `htmx-request` opacity rule** by re-adding the
  `#board.htmx-request` dimming — it sticks under some swap timings and
  makes the dashboard look broken between polls. Button spinners are
  enough feedback.
- **Don't `git push --force` to main.** Even when you're solo. The repo's
  history is small and reversible-on-paper but a force-push during a
  Vercel deploy can put prod and `origin/main` out of sync.

---

## 21. When asked to add a new feature, default sequence

1. Read the PRD section if it relates to an existing requirement
   (find it in the source folder).
2. Find the right service file under `app/services/` — most logic lives
   there, routes are thin orchestrators.
3. If schema changes: edit `app/models.py`, then
   `alembic revision --autogenerate -m "..."`. Inspect the generated
   migration before `alembic upgrade head`.
4. If a new template: extend `layouts/app.html`, use `{{ t("...") }}` for
   labels, never hardcode colors.
5. If a new route: register it in `api/index.py`.
6. Verify with the relevant test flows in section 16.
7. Run `python -m py_compile` on touched .py files, `npm run build`
   on frontend, and commit only after both are clean.

---

*This file is meant to be read by AI coding agents picking up unfamiliar
work in this repo. If you change architectural assumptions, update this
file in the same commit.*
