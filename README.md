# Baari — ClinicQueue

A queue-management dashboard for single-doctor homeopathy clinics in India.
FastAPI + HTMX + Postgres, deployed serverlessly on Vercel.

See `PRD-ClinicQueue.md` (in the source folder) for the full product spec, and
`/Users/mayankkumar/.claude/plans/go-through-each-file-happy-kay.md` for the tech-stack rationale.

## Stack

- **Backend**: FastAPI (Python 3.12), SQLModel ORM, Alembic migrations
- **Frontend**: HTMX 2 + Alpine.js + hand-rolled CSS with the mockup design tokens
- **Database**: Postgres (Neon recommended — Singapore region for India latency)
- **Auth**: Self-hosted (bcrypt + JWT cookie). Credentials provisioned out-of-band via `scripts/create_user.py`.
- **Notifications**: WhatsApp only, via MSG91 (not yet wired)
- **Hosting**: Vercel serverless (`api/index.py` is the entrypoint)

## First-time local setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env:
#   - DATABASE_URL  (Neon connection string — sslmode=require)
#   - JWT_SECRET    (python -c "import secrets; print(secrets.token_urlsafe(48))")
#   - CRON_SECRET   (same)

# Create the initial schema
alembic revision --autogenerate -m "init"
alembic upgrade head

# Provision the first doctor account (creates the clinic too)
python scripts/create_user.py \
    --role doctor \
    --mobile 9812345678 \
    --name "Dr. Sharma" \
    --clinic "Sharma Homeopathy"
# Prints the generated password — save it.
```

## Run locally

```bash
uvicorn api.index:app --reload --port 8000
```

Open <http://localhost:8000> → redirects to `/login`. Use the mobile + password from the seed script.

## Project layout

```
api/index.py                FastAPI app entrypoint (Vercel target)
app/
  config.py                 Env-driven settings (pydantic-settings)
  db.py                     SQLModel engine + per-request session
  deps.py                   Auth dependencies (current_user, require_doctor)
  models.py                 All tables
  time_utils.py             IST display helpers — storage is UTC
  templating.py             Jinja2 environment with filters
  routes/
    auth.py                 /login, /logout
    queue.py                /queue, /queue/board, /queue/{id}/{check-in,done,undo-done}
    booking.py              /bookings/new, /bookings
  services/
    auth.py                 bcrypt + JWT
    queue_service.py        Board view-model + state transitions
    booking_service.py      Slot allocation, patient upsert, token assignment
  templates/
    layouts/                base.html, app.html
    pages/                  login, queue, new_booking
    partials/               queue_board, queue_row  (HTMX swap targets)
static/css/app.css          Design tokens lifted from the mockups
scripts/create_user.py      Out-of-band account provisioning
migrations/                 Alembic (versions/ empty until first revision)
vercel.json                 Routing + cron schedule
```

## Auth model (deviation from PRD §9)

The PRD describes a mobile-OTP signup flow. We've explicitly replaced that with
out-of-band provisioning — there is no signup page. To onboard a new clinic:

```bash
python scripts/create_user.py --role doctor --mobile … --name "…" --clinic "…"
```

Receptionists are created by the doctor from `/settings` (once that page lands).
Password resets use `--reset --mobile …` on the same script for the doctor; the
doctor can reset receptionist passwords from Settings.

## What works today

**Auth & onboarding**
- Sign in / sign out (mobile + bcrypt password, JWT in HTTP-only cookie)
- Out-of-band provisioning via `scripts/create_user.py`
- First-time setup wizard for the doctor (post-login, single page)

**Queue dashboard** (live, HTMX-polled every 10 s)
- New booking with auto-assigned token (T1, T2, …) and slot selection from clinic hours
- Check-in → auto-promote next patient when the doctor is idle
- Mark done → auto-advance (sub-token within the family, or next booking)
- 30-second undo on Mark Done
- Restore a no-show patient to the **end** of the queue (token retained)

**Family sub-tokens** — add T5.1, T5.2, … mid-consult; auto-promote down the chain on parent finish; cancel individually

**Search & reschedule** — live search by name/mobile/last-4/token, booking detail drawer, same-day reschedule, soft-delete cancel

**No-show automation** — `POST /api/cron/tick` (Vercel Cron every 5 min):
- Marks slot+45 min past as no-show, increments patient counter, fires WhatsApp
- Auto-closes the day at 23:55 IST (idempotent)

**End-of-day** — manual `Close day` button or auto-close → generates a daily summary (totals, avg wait, avg consult, peak hour, first/last) and locks the board read-only

**Reports** (doctor only)
- Past-30-day list with completion %
- Day detail: metrics grid + hourly consult chart + patient timeline

**Settings** (doctor only)
- Clinic name, slot length, no-show threshold, morning/evening hours
- Add receptionist accounts (one-time generated password shown once)
- Reset receptionist password, deactivate

**WhatsApp notifications** via MSG91
- Booking confirmed / you're next / slot changed / cancelled / no-show / restored
- Honors `whatsapp_opt_out` on patients
- Dev-mode (`MSG91_AUTH_KEY=""`) records sends as `failed: dev-mode-skip` without an HTTP call

**Bilingual UI** — English + Hindi Devanagari, single click to switch (cookie-backed)

## Known gaps (deliberately deferred)

- Live wait-time recalculation + the ≥5-min change notification (PRD §4.4). The schema column is there (`bookings.wait_estimate_min`); the recalculator isn't.
- Audit log writes — `audit_log` table exists but nothing writes to it yet.
- PDF export of the daily summary (PRD §8).
- Closed days configuration (model has the field; UI is not exposed).
- Slot-uniqueness DB constraint — two simultaneous bookings on the same slot can race past the app-level check. Single-receptionist v1 is fine; add `UNIQUE (clinic_id, slot_time) WHERE status != 'cancelled'` before scaling.
- Automated tests.
