# AGENTS.md — Baari

Context for AI coding agents working on this repo. Read top-to-bottom once.
Everything you need to make safe, in-style changes is here.

> **2026-06-19 rewrite.** The shipped product is the **Next.js full-stack
> app under `frontend/`**. The Python FastAPI tree at the repo root
> (`app/`, `api/index.py`, `migrations/`) is **legacy — no longer
> deployed and no longer maintained**. New work happens in `frontend/`.
> The old code is kept around as a reference until it's cleaned out in a
> dedicated commit. Don't touch the Python tree unless explicitly asked.

---

## 🆕 Recent updates (through 2026-07-03)

Substantial delta since the 2026-06-19 rewrite. Anything below overrides
older sections when they conflict — the audit sections (§19) are
snapshots from a specific date and are not being kept in sync.

### Hosting is now Vercel + Railway (parallel run)

- **Vercel** (`baari-tech.vercel.app`) — still prod, still auto-deploys `main`.
- **Railway** (`baari-production.up.railway.app`) — new staging, also auto-deploys `main`. Singapore region, persistent Node.js container, no cold starts. `frontend/railway.toml` pins Nixpacks + healthcheck. Cutover to Railway is planned once `baari.tech` / `mybaari.in` are registered and DNS lands.
- Same Neon DB behind both — no data divergence during parallel run.
- **Neon warm-keep cron** at `.github/workflows/neon-warm.yml` pings `/api/health?db=1` every 4 min so Neon compute never idles into scale-to-zero. Needs repo secret `NEON_WARM_URL`.
- **`/api/health`** returns fast 200 (no DB by default); `?db=1` executes `select 1`. Excluded from middleware auth via both matcher and `PUBLIC_PREFIXES` list.
- `drizzle.config.ts` reads `DIRECT_URL ?? DATABASE_URL` — pooled URLs on Railway/Neon can't run migrations, so `DIRECT_URL` is used for `db:push` while `DATABASE_URL` (pooled) serves the app.

### Customer-facing mobile app is real

The sibling repo `Baari-app` (Expo React Native) now backs the Baari mobile app. All customer-app endpoints live at `/api/v1/*` on this backend. Two auth modes:

- **Customer bearer JWT** — `verifyCustomerJwt` in `lib/customer-auth.ts`. `type: "customer"` claim, 60-day expiry.
- **Owner bearer JWT** (new, 2026-07-03) — `verifyOwnerJwt` in `lib/owner-auth.ts`. `type: "owner"` claim, 30-day expiry. Separate token spaces — a customer token can never satisfy an owner endpoint and vice versa.

### New API v1 endpoints

Under `frontend/app/api/v1/`:

- **Clinics (public):**
  - `GET /clinics/featured` — landing rail; filters `acceptAppBookings=true`
  - `GET /clinics/search?q=&type=` — same filters
  - `GET /clinics/recent` — customer's booked-before clinics (auth)
  - `GET /clinics/:slug` — full detail. Now returns:
    - `services` filtered by `bookableServices` allowlist (if set)
    - `waitingNow` + `estWaitMinutes` (live queue snapshot)
    - `closesAtIso` / `nextOpenIso` (dynamic status copy)
    - `nextSlotIso` (drives "Next slot 10:30" card row)
    - `isReturning` (patient row exists for auth customer at this clinic)
    - `acceptAppBookings` (safety-valve toggle)
    - `vocab` (backend-derived per-tenant-type labels — mobile app single source of truth)
- **Bookings (customer):**
  - `POST /bookings` — customer creates. Now accepts `guestName` + `guestMobile` for third-party bookings; validates via `^[6-9]\d{9}$`. Rejects when `clinic.acceptAppBookings=false` or `reason` not in `bookableServices`. Tags with `source: "app"`.
  - `GET /bookings` → `{active, past}` split by status
  - `GET /bookings/:id` (single) + `POST /bookings/:id/cancel` + `GET /bookings/:id/status` (polled live status)
- **Auth (customer):**
  - `POST /auth/google` — verify Google ID token → issue customer JWT
- **Me (customer):**
  - `GET /me` / `PATCH /me` / `POST /me/mobile` (mobile-change flow)
- **Owner (new 2026-07-03):**
  - `POST /owner/login` — mobile + password against `users` table. Reuses `login_per_ip` + `login_per_mobile` rate-limit buckets. Returns 30-day bearer JWT.
  - `GET /owner/me` — authed user + clinic details.
  - `GET /owner/queue` — today's queue via `buildBoard()`, reshaped for mobile. Read-only for first draft; check-in / start / done actions land in a follow-up.
- **Health:**
  - `GET /api/health` — Railway healthcheck + Neon-warm target.

### Schema additions

Recent DB columns (all via `db:push`, no migration files):

- `bookings.guest_name` (varchar 100, nullable)
- `bookings.guest_mobile` (varchar 15, nullable)
- `bookings.source` (enum `app | frontdesk | walkin`, default `frontdesk`)
- `clinics.accept_app_bookings` (bool, default true)
- `clinics.bookable_services` (jsonb array, nullable — null = all allowed)

New enum: `booking_source` — used for the "Bookings by source" strip on Reports.

### Dashboard updates

- **Settings → App bookings** (new page at `/settings/bookings`): toggle for `acceptAppBookings` + checkbox list for `bookableServices`. Owner-facing safety valves for the mobile-app booking flow. Navigated via new item in `settings-nav.tsx`.
- **Reports → Bookings by source** strip up top; new **Source** column in the bookings table.
- **Hamburger menu** at `md:hidden` on the receptionist dashboard (`components/app/app-nav.tsx`) — dashboard is now usable on a phone browser. Body-scroll lock while open, closes on route change / ESC / backdrop.
- **Theme toggle icons-only** — `Light`/`Dark` labels removed from the pill, sun + moon icons kept.
- **Header logo** (dashboard + landing) is the mobile app's rounded-square "b" mark. Same file lands at `app/icon.png` for browser-tab favicon.
- **PWA** — `public/manifest.webmanifest` + `viewport` + `themeColor` metadata on the root layout. Dashboard installs to home screen on iOS + Android with standalone display.
- **Landing** — new "Your customers can book themselves" section (`components/sections/customer-app.tsx`) between MoreFeatures and CtaClosing. Footer WhatsApp is the real number now (`+91 98931 27527`).

### Cron

- `.github/workflows/cron-tick.yml` — existing, unchanged (no-show sweeps + day-close every 5 min).
- `.github/workflows/neon-warm.yml` — new (2026-07-03), 4-min interval, hits `/api/health?db=1` to keep Neon compute node warm.

### Env vars (delta)

Add to `frontend/.env.local` / Vercel / Railway:

- `DIRECT_URL` — direct (non-pooled) Neon URL, used only by `drizzle-kit push`. Optional if `DATABASE_URL` is already direct.
- `NEXT_PUBLIC_APP_URL` — public base URL. Currently `baari-tech.vercel.app` on Vercel; will move to `baari.tech` / `mybaari.in` on cutover.

Add as GitHub repo secret:

- `NEON_WARM_URL` — full URL the warm cron pings (e.g. `https://baari-production.up.railway.app/api/health?db=1`).

### What's NOT in yet (open work)

- Owner-side write actions on mobile (check-in, start, mark-done, walk-in creation).
- Google Sign-in on the dashboard (link-first flow — task tracked).
- Rate-limit wrapper on public discovery endpoints (infra exists in `lib/rate-limit.ts`, not yet applied).
- Slug → clinicId lookup optimisation in `/bookings/:id/status`.
- DB uniqueness constraints for the documented 2-active-cap + slot-time races.
- Composite index on `bookings(clinicId, date, status)` for Reports.
- Distance / "Near you" ranking on Discover (needs clinic lat/lng capture first).

---

## 1. What Baari is

A multi-tenant SaaS that replaces the **paper register** at the front desk
of any appointment-based business — clinics, salons, dental practices,
spas, vets, and a generic "other." Each tenant signs up to their own
isolated workspace.

**Core problem solved:** a receptionist running a 100-customer/day clinic
keeps track of arrivals, tokens, family groups, no-shows, and (optionally)
WhatsApp notifications, all in real time on one screen. The doctor /
stylist / therapist sees who's next and clicks "Mark done." No paper, no
app installs, no per-seat licence.

**Target market:** Tier 2/3 cities in India. Free during early access.

**Live:** [`baari-tech.vercel.app`](https://baari-tech.vercel.app).

---

## 2. Architecture at a glance

```
                                    baari-tech.vercel.app
                                              │
                                  ┌───────────▼───────────┐
                                  │  Next.js 15.5 app     │
                                  │  (App Router, React 19) │
                                  │                       │
                                  │  • marketing landing  │
                                  │  • auth (JWT cookie)  │
                                  │  • queue + booking    │
                                  │  • search + reports   │
                                  │  • settings           │
                                  │  • /api/cron/tick     │
                                  └───────────┬───────────┘
                                              │ Drizzle ORM
                                              │ postgres-js driver
                                  ┌───────────▼───────────┐
                                  │  Neon Postgres        │
                                  │  ap-southeast-1       │
                                  └───────────────────────┘
                                              ▲
                                  ┌───────────┴───────────┐
                                  │  GitHub Actions       │
                                  │  cron tick / 5 min    │
                                  └───────────────────────┘
```

**One Vercel project, one Next.js app, one DB.** Server components +
server actions speak directly to Postgres via Drizzle. No separate API
layer.

---

## 3. Repo layout

```
Baari/
├── frontend/                              ← the actual product
│   ├── app/
│   │   ├── layout.tsx                     # Fonts (Inter + Noto Devanagari) + ThemeProvider
│   │   ├── globals.css                    # Design tokens (light + dark)
│   │   ├── page.tsx                       # Marketing landing composition
│   │   ├── login/
│   │   │   ├── page.tsx + login-form.tsx
│   │   │   └── actions.ts                 # loginAction, logoutAction
│   │   ├── signup/
│   │   │   ├── page.tsx + signup-form.tsx
│   │   │   └── actions.ts                 # signupAction (vertical chips, +91 prefix, dup-mobile UX)
│   │   ├── setup/
│   │   │   ├── page.tsx + setup-form.tsx
│   │   │   ├── actions.ts                 # setupAction (hours + slot length)
│   │   │   └── done/page.tsx              # "Your workspace is live." landing
│   │   ├── workspace-deleted/page.tsx     # Public post-deletion confirmation
│   │   ├── api/cron/tick/route.ts         # Bearer-auth cron endpoint
│   │   └── (app)/                         # Authed shell — middleware-gated
│   │       ├── layout.tsx                 # Top nav + theme + logout
│   │       ├── queue/
│   │       │   ├── page.tsx               # Board (waiting / now / done)
│   │       │   └── actions.ts             # check-in, mark-done, walk-in, close day, …
│   │       ├── book/
│   │       │   ├── page.tsx + book-form.tsx
│   │       │   └── actions.ts             # bookAction (+ Save & add another)
│   │       ├── search/
│   │       │   ├── page.tsx               # Search bar + recent guests
│   │       │   ├── add-guest-button.tsx
│   │       │   ├── actions.ts             # addGuestAction
│   │       │   └── [mobile]/page.tsx      # Customer profile (stats + history)
│   │       ├── reports/
│   │       │   ├── page.tsx               # KPIs + charts + sortable table
│   │       │   ├── bookings-table.tsx
│   │       │   ├── charts.tsx
│   │       │   └── range-selector.tsx
│   │       └── settings/
│   │           ├── layout.tsx             # Left sub-nav (Workspace / Hours / Staff / Account)
│   │           ├── settings-nav.tsx
│   │           ├── actions.ts             # saveWorkspace, saveHours, changePassword, deleteWorkspace
│   │           ├── workspace/             # workspace-form.tsx (name/type/slot/no-show/address)
│   │           ├── hours/                 # hours-form.tsx (per-day + breaks + copy)
│   │           ├── staff/                 # user list (stub for multi-staff)
│   │           └── account/               # change-password + logout + delete
│   ├── components/
│   │   ├── ui/                            # shadcn-style primitives (Button, Input, Card, Label)
│   │   ├── app/queue-board.tsx            # The big interactive board
│   │   ├── sections/                      # Landing sections (hero, features, …)
│   │   ├── icons/tooth.tsx                # Custom tooth glyph for Dental
│   │   ├── site-header.tsx                # Marketing header
│   │   ├── site-footer.tsx                # 3-column footer
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx               # Pill (Light · Dark) — NOT a bare icon
│   ├── lib/
│   │   ├── auth.ts                        # Edge-safe: JWT sign/verify + normalizeMobile
│   │   ├── password.ts                    # Node-only: bcryptjs + strength rules
│   │   ├── session.ts                     # requireSession / requireDoctor / requireSetup
│   │   ├── rate-limit.ts                  # DB-backed fixed-window limiter
│   │   ├── time.ts                        # IST helpers (clinicToday, fmtTime, …)
│   │   ├── vocab.ts                       # Per-tenant-type label dictionary
│   │   ├── reports-range.ts               # computeRange (today/7d/30d/custom + prev period)
│   │   ├── whatsapp.ts                    # MSG91 dispatch (env-gated dev no-op)
│   │   ├── utils.ts                       # cn()
│   │   ├── db/
│   │   │   ├── client.ts                  # Drizzle client (postgres-js for transactions)
│   │   │   └── schema.ts                  # ALL tables in one file
│   │   └── services/                      # Domain logic — keep routes/actions thin
│   │       ├── booking.ts                 # createBooking, walkIn, slot enumeration
│   │       ├── queue.ts                   # state machine + buildBoard VM
│   │       ├── sub-token.ts               # Family sub-tokens (add / start / done / cancel)
│   │       ├── patients.ts                # getRecentGuests, addGuest, getCustomerProfile
│   │       ├── reports.ts                 # loadReports + loadReportsHeadline
│   │       ├── service-types.ts           # Per-tenant service catalog
│   │       └── day-close.ts               # getSummary + closeDay
│   ├── middleware.ts                      # Edge: redirects /queue etc. → /login when no cookie
│   ├── drizzle.config.ts
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── package.json
│   └── vercel.json                        # framework pin
├── .github/workflows/cron-tick.yml        # Hits /api/cron/tick every 5 min
├── AGENTS.md                              # this file
├── README.md
├── STATUS.md                              # Historical snapshot of the cutover
├── WALKTHROUGH.md
│
└── [legacy — DO NOT EDIT unless cleaning out]
    ├── api/index.py                       # ← old Python entry
    ├── app/                               # ← old FastAPI tree
    ├── migrations/                        # ← Alembic (Drizzle now owns schema)
    ├── static/                            # ← old templates' CSS
    ├── docker/                            # ← old all-in-one Docker
    ├── vercel.json (root)                 # ← legacy Python project config (unused)
    ├── requirements.txt, pyproject.toml, alembic.ini
    └── scripts/{create_user,make_late}.py
```

---

## 4. Stack & versions

**All runtime code is TypeScript on Next.js 15.5 / React 19.**

| Layer | What | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.19 |
| Runtime | React | 19.0.0 |
| Language | TypeScript strict | 5.x |
| DB driver | postgres-js (transactions) + @neondatabase/serverless | 3.4 / 0.10 |
| ORM | Drizzle ORM + drizzle-kit (`db:push`) | 0.36 / 0.28 |
| Auth (Edge) | jose (JWT sign/verify) | 5.9 |
| Auth (Node) | bcryptjs | 2.4 |
| Validation | zod | 3.23 |
| Cache | swr (client-side, sparing) | 2.2 |
| Styling | Tailwind 3.4 + tailwindcss-animate + shadcn token convention | 3.4 |
| Animation | motion (Framer Motion successor) | 11.13 |
| Theme | next-themes | 0.4 |
| Icons | lucide-react (+ custom `Tooth` SVG) | 0.456 |
| Fonts | Inter + Noto Sans Devanagari (via `next/font/google`) | — |
| Hosting | Vercel Hobby (project: `baari-tech`) | — |
| DB | Neon Postgres (free tier, `ap-southeast-1` Singapore) | — |
| Cron | GitHub Actions (Vercel Hobby Cron is daily-only) | — |
| WhatsApp | MSG91 Business API — env-gated, dev no-op | — |

The repo also still contains the **deprecated** Python stack (FastAPI
0.115 + Jinja + HTMX + SQLModel + Alembic). It is no longer deployed.
Treat it as documentation only.

---

## 5. Data model

All tables have `clinic_id` from day 1 (multi-tenant ready). All
timestamps are proper `TIMESTAMPTZ` (Drizzle: `timestamp(..., { withTimezone: true })`).
The aware-vs-naive timezone debt from the Python stack is gone.

| Table | Purpose |
|---|---|
| `clinics` | Tenant workspaces. `tenantType` (clinic / salon / spa / dental / vet / other) drives vocab + service catalog defaults. `openingHours` JSON keyed by `mon`/`tue`/…/`sun` with optional `open2`/`close2` for midday breaks. `slotLengthMin`, `noShowThresholdMin`, optional `address`. `setupComplete` gates the wizard. |
| `users` | Owner + receptionist accounts. Composite-unique on (`clinicId`, `mobile`). `passwordHash` is bcrypt. `role` enum: `doctor` (= owner) or `receptionist`. `lastLoginAt` populated on login. |
| `patients` | Per-tenant guest/customer/patient records. Unique on (`clinicId`, `mobile`). `isNew` flips false once a booking is `done`. `whatsappOptOut` suppresses dispatch. `anonymizedAt` for DPDP support (UI not built). `noShowCount`. |
| `bookings` | One row per appointment. Composite-unique on (`clinicId`, `date`, `token`). Full lifecycle timestamps: `checkedInAt`, `startedAt`, `completedAt`, `cancelledAt`, `noShowAt`, `restoredAt`. `waitEstimateMin` reserved. |
| `subTokens` | Family members under a parent booking. Composite-unique on (`bookingId`, `suffix`). Up to 5 per parent. Independent status machine. |
| `notifications` | Every WhatsApp dispatch attempt. `trigger`, `status` (queued/sent/failed), `providerMessageId`, `templateName`, `payload` JSON, `failureReason`, `sentAt`. |
| `auditLog` | State-change events. Currently written by `reopenBooking` only — wider coverage TBD. |
| `dailySummaries` | One row per (`clinicId`, `date`) after day-close. Aggregated metrics. |
| `rateLimitBuckets` | Fixed-window counters. `bucketKey` is composite `scope:identifier:windowEpoch`. GC'd by cron. |

**Enums** (lowercase string unions in `schema.ts`):

- `userRole`: `doctor`, `receptionist`
- `tenantType`: `clinic`, `salon`, `spa`, `dental`, `vet`, `other`
- `bookingStatus`: `booked`, `checked_in`, `in_consult`, `done`, `no_show`, `cancelled`
- `subTokenStatus`: same as bookingStatus minus `no_show` (sub-tokens never auto-no-show)
- `notificationTrigger`: `booking_confirmed`, `youre_next`, `slot_changed`, `wait_changed`, `cancelled`, `no_show`, `restored`
- `notificationStatus`: `queued`, `sent`, `failed`

Schema changes go through Drizzle: edit `frontend/lib/db/schema.ts`, then
`npm run db:push` (no Alembic). For destructive migrations review the
generated SQL before applying.

---

## 6. Auth & multi-tenancy

**Auth:**
- Mobile + bcrypt password. No email, no OTP, no verification.
- JWT in HTTP-only Secure SameSite=Lax cookie called `baari_session`.
- Expiry: 7 days for doctor, 30 days for receptionist.
- Two-bin split for Edge safety: `lib/auth.ts` (Edge — jose only,
  used by middleware) vs `lib/password.ts` (Node — bcryptjs). Don't
  cross the streams.
- Provisioning: self-serve via `/signup` (anyone can create a workspace).
  Receptionist provisioning UI is stubbed at `/settings/staff`.
- No password-reset-by-self yet — doctor resets receptionist password
  (not wired); owner resets via `/settings/account`.

**Mobile validation:** Indian mobile only. `normalizeMobile` in
`lib/auth.ts` enforces `^(?:\+?91|0)?([6-9]\d{9})$` — 10 digits whose
first digit is 6/7/8/9 (TRAI rule). `+91` and leading `0` prefixes are
stripped. The validation error consistently reads: *"Enter a valid Indian
mobile (10 digits, starting with 6, 7, 8 or 9)."*

**Multi-tenancy:**
- Every query filters by `clinicId`. Tenant A literally cannot see B.
- App-enforced isolation, **not** Postgres RLS. A future bug forgetting
  the filter would leak silently. Add RLS before scaling beyond a few
  vendors.

**Roles:**
- `doctor` — owner / admin. Mark done, reports, settings, close day,
  delete workspace.
- `receptionist` — staff. Queue + bookings + check-in. No reports /
  settings.

**Session helpers (`lib/session.ts`):**
- `requireSession()` — any logged-in user (login redirect on fail).
- `requireSetup()` — logged-in AND clinic.setupComplete (else → `/setup`).
- `requireDoctor()` — logged-in AND role doctor (else → `/queue`).

**Cron auth:**
- `/api/cron/tick` requires `Authorization: Bearer <CRON_SECRET>`.
  Without it: 401. GitHub Actions sends the header.

---

## 7. The queue state machine

Heart of the product. Read `lib/services/queue.ts` if touching anything
affecting it. The diagram below is the same as the Python stack — the
behaviour ported intact.

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
                      ▼ │  no_show     │ ← cron sweep (slot + threshold past)
                ┌─────────▼────────┐  │     OR manual mark-no-show
   mark_done()  │   in_consult     │ ┌▼───────────┐
                └─────────┬────────┘ │  restore   │ → back to checked_in
                  ┌───────▼────────┐ │  /reopen   │   at end of queue
                  │      done      │ │            │
                  └───────┬────────┘ └────────────┘
                          │
                       30s undo window
                          │
                       restored ↔ in_consult
```

**Auto-promotion rules** (in `markDone` and `promoteAfterSubDone`):
1. When a booking is marked done, look for the FIRST pending sub-token in
   the same parent group → promote that sub-token to `in_consult`.
   (Family flow: T5 done → T5.1 in_consult, not T6.)
2. If no pending sub-tokens, promote the next `checked_in` booking.
   Lowest token first, but `restoredAt`-stamped patients sort to the end.
3. Auto-promote only fires if NO booking AND NO sub-token is currently
   `in_consult`.

**The 30-second undo window:**
- `markDone` records `completedAt = now`. The board's view-model marks
  rows `isUndoable = true` while `now - completedAt < 30s`.
- `undoDone` reverses status and (if auto-promote already moved on) pushes
  the promoted booking back to `checked_in`.

**Family sub-tokens:**
- Max 5 per parent. Added via the queue row's "Add family member" menu or
  the now-card's overflow.
- Can be added at booking time OR mid-consult (parent already in_consult).
- Cancel a sub-token independently.

**Lateness display:**
- Pure view-model concern (`isLate` flag on the row).
- Not a status transition — patient can still check in normally.
- Triggers when `now - slotTime >= 15 min` AND status in (`booked`,
  `checked_in`).

**No-show transition:**
- Cron-driven (or manually triggered via the row 3-dot menu).
- Cron sweep: `slotTime + clinic.noShowThresholdMin < now` AND status in
  (`booked`, `checked_in`) → `no_show`, increment patient counter, fire
  WhatsApp.
- `reopenBooking` (in `lib/services/queue.ts`) handles the manual
  restore-from-no-show path and writes to `auditLog`.

---

## 8. Slot generation (new behaviour — read before touching)

`lib/services/booking.ts:enumerateSlots` returns every slot in today's
opening window with status `open` | `taken` | `past`.

**Past-slot threshold (current):** a slot becomes `past` once its END
time has elapsed (`slotEnd <= now`). This lets the receptionist still
book the slot currently in progress for a late arrival, and keeps
near-future slots clearly open. The earlier "5 minutes after start"
threshold prematurely retired slots that were still useful.

**UI rendering** (`book-form.tsx`):
- `open` → solid border + normal text.
- `taken` → muted background + strikethrough + "Already booked" tooltip.
- `past` → dashed border + strikethrough + opacity 60 + "Past time"
  tooltip. Visually distinct from `taken`.

---

## 9. Background jobs

`/api/cron/tick` fires every 5 minutes via `.github/workflows/cron-tick.yml`:

```bash
curl -X POST "$APP_URL/api/cron/tick" -H "Authorization: Bearer $CRON_SECRET"
```

Each tick walks every clinic and runs:
1. **No-show sweep** — promote overdue bookings (`booked`/`checked_in` past
   `slotTime + noShowThresholdMin`) to `no_show`, increment counter, fire
   WhatsApp.
2. **Auto-close day** — at `≥ 23:55 IST` if not already closed. Idempotent.
3. **GC rate-limit buckets** — delete rows older than 2 hours.

GitHub Actions can drift up to ~10 min on the free tier — fine for these
jobs.

---

## 10. WhatsApp notifications (MSG91)

`lib/whatsapp.ts` handles all 6 PRD triggers (templates pre-approved on
MSG91). Bilingual (English + Hindi) — single concatenated message.

| Trigger | Fired by | Template params |
|---|---|---|
| `booking_confirmed` | `book/actions.ts` after create | token, slot, clinic |
| `youre_next` | queue auto-promotion | token, clinic |
| `slot_changed` | reschedule | token, old, new, clinic |
| `cancelled` | cancel | token, clinic |
| `no_show` | cron + manual mark-no-show | token, clinic |
| `restored` | restore / reopen | token, clinic |

**Dev-mode skip:** if `MSG91_AUTH_KEY` is empty, the dispatcher returns
`(false, null, "dev-mode-skip")` immediately and the notification row is
recorded as `status=failed, failureReason="dev-mode-skip"`. No HTTP call.
App keeps working.

**Patient opt-out:** if `patient.whatsappOptOut` is true, dispatch records
`status=failed, failureReason="patient_opt_out"`. Never sends. (The
booking-form / add-guest UI for setting this was removed; the column
remains for future re-introduction.)

---

## 11. Theme & design tokens

`frontend/app/globals.css` holds the **only** palette. Tailwind 3.4
consumes the CSS variables via the `colors.*` map in `tailwind.config.ts`.

| Token | Light | Dark | Used as |
|---|---|---|---|
| `--background` | near-white | near-black | page surface |
| `--foreground` | near-black | near-white | body text |
| `--card` | white | `#0f0f12` | panel surfaces |
| `--primary` | indigo-500 | indigo-300 | brand |
| `--secondary` | warm grey | warm dark | chips, inputs |
| `--border` | warm grey | warm dark | dividers |
| `--ring` | indigo | indigo | focus ring |

**Status colour map (consistent across queue / reports / search):**
- `in_consult` → emerald 15% (active session, brand green)
- `done` → emerald 10% (lower-contrast, the rest state)
- `no_show` → rose 15%
- `cancelled` → grey + line-through
- `checked_in` → primary 15% (waiting state — brand purple)
- `booked` → primary 10%
- late (display only) → amber 15%

**Theme switching:**
- `next-themes` library handles light/dark with localStorage persistence
  + `prefers-color-scheme` fallback.
- The toggle (`components/theme-toggle.tsx`) is a two-position pill
  (Light · Dark) with a sliding thumb and `role="switch"` —
  **deliberately not a bare icon button** so it reads as an interactive
  control at a glance.

---

## 12. i18n — current state

- **Patient/customer names and reasons** accept both Latin and Devanagari
  scripts at input. Fonts (Inter + Noto Sans Devanagari from
  `next/font/google`) render both cleanly without baseline drift.
- **Language preference on customer profile** is *inferred* from the
  name's script — Devanagari → "हिन्दी", else "English". No DB column for
  preference yet.
- **App chrome and pages are English-only** for now. The Python stack's
  i18n key dictionary did not port; bilingual UI is a follow-up.

---

## 13. Per-tenant vocabulary (`lib/vocab.ts`)

`vocabFor(tenantType)` returns a label dictionary used across the app to
keep copy correct per vertical. Most surfaces consume this — settings
headers, queue board (`NOW IN SESSION` vs `IN CHAIR` vs `IN CONSULT`),
customer profile ("Book session" vs "Book appointment"), etc.

| Field | clinic | dental | salon | spa | vet | other |
|---|---|---|---|---|---|---|
| `entitySingular` | patient | patient | customer | guest | pet | customer |
| `provider` | doctor | dentist | stylist | therapist | vet | owner |
| `session` | consult | appointment | service | session | visit | appointment |
| `sessionProgress` | in consult | in chair | in chair | in session | in consult | in session |
| `reasonLabel` | Reason for visit | Procedure | Service requested | Service requested | Reason for visit | Notes |

The `sessionProgress` map matches the cross-vertical UX spec: clinic +
vet share "in consult"; dental + salon share "in chair"; spa + other
share "in session." Set automatically from `tenantType` — no manual
override in Settings (yet).

---

## 14. Service catalog defaults (`lib/services/service-types.ts`)

`servicesFor(tenantType)` returns the dropdown options for the booking
form's *Service requested* field. Defaults per vertical:

| Vertical | Defaults |
|---|---|
| Clinic | Consultation, Follow-up, Vaccination, Lab review, Other |
| Dental | Check-up, Cleaning, Filling, Root canal, Extraction, Whitening, Other |
| Salon | Haircut, Colour, Styling, Beard trim, Treatment, Other |
| Spa | Massage, Facial, Body scrub, Aromatherapy, Other |
| Vet | Consultation, Vaccination, Grooming, Surgery follow-up, Other |
| Other | Appointment, Follow-up, Other |

The booking form also accepts a free-text custom service via "+ Add
custom…" — useful when the catalog doesn't fit.

---

## 15. Server actions (the API surface)

Server actions are the only mutation entrypoints. They live next to the
route that hosts them (`actions.ts` per directory). Each is `"use
server"`, takes either a typed-state previous value + `FormData` (for
useActionState forms) or positional args (for `formAction`-less
buttons). Always validate via the relevant service in `lib/services/`.

| Action | File | Purpose |
|---|---|---|
| `signupAction` | `app/signup/actions.ts` | Create clinic + owner user, login |
| `loginAction` / `logoutAction` | `app/login/actions.ts` | Issue/clear session cookie |
| `setupAction` | `app/setup/actions.ts` | Save opening hours, mark setup complete |
| `bookAction` | `app/(app)/book/actions.ts` | Create booking (+ save & add another) |
| `addGuestAction` | `app/(app)/search/actions.ts` | Create patient without booking |
| `checkInAction` … `walkInAction` | `app/(app)/queue/actions.ts` | Queue state-machine transitions (16 actions in this file) |
| `closeDayAction` | `app/(app)/queue/actions.ts` | End-of-day rollup |
| `saveWorkspace`/`saveHours`/`changePassword`/`deleteWorkspace` | `app/(app)/settings/actions.ts` | Settings |

`deleteWorkspace` hard-deletes the clinic + every dependent row in
FK-reverse order inside a transaction, clears the cookie, then
`redirect("/workspace-deleted")` (a static public page). Bouncing to
`/login` instead crashes the app because the next layout render still
tries to re-read the deleted clinic via `requireDoctor`.

---

## 16. Running locally

```bash
cd frontend
cp .env.example .env.local
# Fill: DATABASE_URL (Neon — separate branch from prod!),
#       JWT_SECRET (>= 32 chars),
#       CRON_SECRET (>= 32 chars)

npm install
npm run db:push        # apply schema to whatever DATABASE_URL points at
npm run dev            # http://localhost:3000
```

If port 3000 is busy, Next will auto-bump to 3001. Watch the dev banner.

**No Alembic, no Docker, no FastAPI venv.** The whole product is one
`npm run dev` away.

---

## 17. Deployment

One Vercel Hobby project (`baari-tech`) pointed at this GitHub repo with
**Root Directory = `frontend`**. Push to `main` → Vercel builds Next.js →
prod. The `frontend/vercel.json` (`{"framework":"nextjs"}`) pins the
detection.

**Vercel cron is daily-only on Hobby** — `/api/cron/tick` needs to fire
every 5 min, so it's driven by GitHub Actions (`cron-tick.yml`).

The root-level `vercel.json` (which points at `api/index.py`) is **stale
legacy** — left in the repo for now but not in the active deployment
path. Don't ship a new deploy from it.

---

## 18. Environment variables

### Vercel project (`baari-tech`) + local `frontend/.env.local`

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon Postgres connection string (postgres-js compatible) |
| `JWT_SECRET` | ✅ | ≥ 32 chars. Edge runtime throws otherwise |
| `CRON_SECRET` | ✅ | ≥ 32 chars. Bearer for `/api/cron/tick` |
| `APP_ENV` | — | `production` or `dev`. Default `dev` |
| `CLINIC_TZ` | — | Default `Asia/Kolkata` |
| `MSG91_AUTH_KEY` | — | Blank → dev-mode skip (no real send) |
| `MSG91_WHATSAPP_INTEGRATED_NUMBER` | — | Blank → skip |
| `MSG91_WHATSAPP_NAMESPACE` | — | Blank → skip |

### GitHub Actions secrets (for cron)

| Var | Notes |
|---|---|
| `APP_URL` | `https://baari-tech.vercel.app` |
| `CRON_SECRET` | Same value as the Vercel env var |

---

## 19. End-to-end audit (2026-06-19)

Tested on `localhost:3001` with a fresh `Audit Spa` workspace, dark mode.

### A. Marketing landing — ✅ works
- 8-section flow renders cleanly: header with pill theme toggle + solid
  Sign-in / hero with embedded tilted queue preview / Who Baari is for
  (eyebrow + scenario per vertical) / How it works (3-step) / 3
  alternating feature blocks with inline UI snippets / 3-icon band /
  closing CTA / 3-column footer + India baseline.
- All `motion` animations fire on first paint and on scroll.
- Dark mode pill toggle slides correctly between Light/Dark.

### B. Signup — ✅ works (with one UX wart)
- Vertical chips select; business name placeholder updates by vertical
  (e.g. Spa → "Tranquil Day Spa").
- +91 prefix renders with a flag, mobile field accepts only 10 digits.
- **Mobile validation:** `0909090922` is correctly rejected with the new
  message "Enter a valid Indian mobile (10 digits, starting with 6, 7, 8
  or 9)." ✅
- Password meter (8+ chars, has letter, has number) ticks live.
- ⚠ **Wart:** when the action returns an error, the form resets fields
  (business name, your name, mobile) to empty rather than preserving the
  user's input. React 19 `useActionState` doesn't preserve form values
  by default — needs explicit `defaultValue` plumbing. Not blocking but
  it's a real friction point. (See § 21 #1.)

### C. Setup wizard — ✅ works
- Slot length dropdown (15/20/30/45/60).
- Per-day open/close + "Copy Monday to weekdays" + "Leave both blank to
  close the day."
- Submit → `/setup/done`. The "Invite a teammate · Coming soon" item is
  gone — list now shows only "Make your first <session>" and "Tweak
  settings any time." ✅

### D. Queue board — ✅ works
- Empty state: "Quiet for now." with a mug glyph; right card "No active
  session." with user-x glyph.
- Top nav uses vocab — "Auditor · Therapist" for the Spa workspace ✅.
- Summary strip: Today · Waiting · In session · Running late · Next free.
- "Walk in" + "New booking" CTAs visible; "Close day" too.
- Tested: New booking side-panel opens, fields are correct vocab
  ("Guest name" for Spa).
- "Don't send WhatsApp" checkbox is gone from the booking form ✅.

### E. Booking slot picker — ✅ works
- Slot grid rendered; past slots are dashed + strikethrough + low
  opacity, clearly inert ✅.
- "0 of 30 slots free today" — at 20:12 IST with hours 9–19, every slot
  is correctly past (their end time has elapsed). The new end-of-slot
  threshold is exercising correctly.

### F. Search → customer profile — ✅ works
- Empty state polished: "No guests on file yet. Add one with the button
  above — this list fills in as bookings come through."
- Add-guest popover: name + 10-digit mobile, NO WhatsApp checkbox ✅.
- Devanagari name (`अमित शर्मा`) renders correctly.
- After add: "Recent guests" appears with "first visit" badge (was "new"
  before) ✅.
- "Open profile →" link (was "View history →") ✅.
- `/search/9876543201` → full customer profile renders:
  - Header: name in Devanagari, "first visit" pill, +91 mobile, "Book
    session" CTA (vocab — Spa).
  - Stats grid: TOTAL VISITS (0) · COMPLETED (0) · NO-SHOWS (0) ·
    **LANGUAGE: हिन्दी** ← Devanagari name → Hindi inferred ✅.
  - Booking history: empty state "On file but no bookings yet. Try Book
    session above."
- "Back to search" link returns cleanly.

### G. Reports — ✅ works
- Range selector: Today · Last 7 days · Last 30 days · Custom.
- 6 KPI cards (Total bookings · Completed · No-show rate · Cancelled ·
  Avg wait · Avg session) all render.
- KPI delta labels are clear: "no data" / "no change" / "+N (new)" /
  "+12% vs prev" — never the bare "new" or "0pp" ✅.
- Hourly distribution chart shows hour labels 00–21 + empty state line.
- Busiest days bar chart with weekdays.
- Top sessions card uses vocab ("Top sessions" for Spa) with empty state
  "Pick a service the next time you book…"
- Bookings table with "Showing 0".

### H. Settings — ✅ works
- Left sub-nav: Workspace · Opening hours · Staff · Account.
- **Workspace:** name + 6 business types radio + slot length + no-show
  threshold + address. Helper text below address now reads
  "Shown on booking confirmations." (no more "when you wire WhatsApp") ✅.
- **Account:** Change password panel + Sign out + DANGER ZONE with
  type-name-to-confirm. Destructive button stays disabled until the
  confirmation matches.

### I. Workspace deletion → /workspace-deleted — ✅ works
- Public static page. Site header (pill toggle + Sign in) + emerald
  check icon + "Workspace deleted." headline + body + "Start a new
  workspace →" (glow) + "Back to home" (ghost) + footer.
- No auth gate, no clinic read — the app cannot crash here.

### J. Theme toggle — ✅ works
- Two-position pill (Light · Dark) visible in BOTH the marketing site
  header AND the authed app layout. Slides correctly on click.

### K. Cron endpoint — ✅ works (code path)
- `app/api/cron/tick/route.ts` enforces `Authorization: Bearer
  <CRON_SECRET>`. Without it: 401. With it: sweeps no-shows, runs
  day-close if past 23:55, GCs rate-limit buckets.

### Known issues / friction points

| # | Where | Symptom | Severity |
|---|---|---|---|
| 1 | Signup, login, book form | On server-action error, form fields reset to empty (`useActionState` doesn't preserve `defaultValue` of inputs). | UX wart |
| 2 | Signup mobile input | Was typing into the wrong field once when the layout shifted between renders — investigating; might be a focus/ref race | low |
| 3 | Receptionist provisioning | `/settings/staff` shows the current user list + "Invite teammate (v2)" stub. No actual invite flow yet. | feature gap |
| 4 | Booking prefill from profile | `Book session` button on the profile passes `?prefill_mobile=…&prefill_name=…` but the booking form doesn't yet read them. | wiring TODO |
| 5 | Per-tenant override of vocab | `sessionProgress` is auto-set from `tenantType`. No Settings field to override it (e.g. salon owner who calls it "in service" not "in chair"). | future |
| 6 | Language preference column | Currently *inferred* from name script (Devanagari → हिन्दी). A real `patients.language` column with a picker is a small follow-up. | minor |
| 7 | i18n on app chrome | App is English-only. The Python stack's bilingual key dictionary did not port. | feature gap |
| 8 | Audit log writes | Only `reopenBooking` writes to `auditLog`. Wider coverage (state changes, settings edits, etc.) TBD. | quality |
| 9 | DPDP retention sweep | No automated patient anonymization after `retentionDays`. | compliance debt |
| 10 | Tests | No automated tests. The queue state machine is the most important thing to cover first. | quality |

---

## 20. Security posture

**Live now (Tier 1):**
- Bcrypt password hashing (cost 10).
- JWT in HTTP-only Secure SameSite=Lax cookie.
- Multi-tenant isolation via app-enforced `clinicId` filter.
- `/api/cron/tick` Bearer-secret auth.
- HTTPS enforced by Vercel.
- Rate limit `/signup` and `/login` (per IP + per mobile).
- Password strength enforced on signup (≥8 chars, letters AND digits).
- Indian mobile validation rejects non-TRAI numbers.

**Missing (Tier 2+):**
- CSRF tokens on state-changing forms. SameSite=Lax helps but isn't
  airtight against cross-site POST.
- Mobile/email verification at signup.
- 2FA on doctor accounts.
- Postgres row-level security.
- WAF in front of Vercel.
- Audit log coverage (currently sparse).
- DPDP Act 2023 retention sweep.

---

## 21. Common pitfalls

- **Don't mix Edge and Node imports.** `lib/auth.ts` is Edge-safe (jose
  only). `lib/password.ts` pulls bcryptjs (Node only). Middleware imports
  `lib/auth.ts`; if you accidentally import bcrypt-using code there, the
  Edge bundle blows up at deploy time.
- **Don't query without `clinicId`.** Tenant leakage will be silent and
  your test data won't catch it. Always join from `requireSession()` /
  `requireDoctor()` and pass `clinicId` to every service.
- **Don't hardcode colours.** Use Tailwind classes that resolve to the
  `--*` variables. A literal `#185fa5` will break light/dark.
- **Don't break the "past slot" rule.** `enumerateSlots` retires a slot
  only after its END time has elapsed. Changing the threshold without a
  spec discussion will surprise users mid-booking.
- **Don't remove `whatsappOptOut` from the schema** even though the UI is
  gone. The column is still in use server-side and likely returns to the
  UI later.
- **Don't put DB calls in the middleware.** It runs on Edge per request.
  Keep middleware to `decodeSession` + redirect logic only.
- **Don't add a route under `(app)/` that doesn't expect a logged-in user.**
  The layout calls `requireSession` — public pages go to `frontend/app/`
  (e.g. `workspace-deleted`, `login`, `signup`).
- **Don't `git push --force` to `main`.** Even when solo. A force-push
  during a Vercel deploy can put prod and `origin/main` out of sync.
- **Don't touch the Python `app/`, `api/`, `migrations/` trees** unless
  explicitly cleaning them out. They're not deployed and any change adds
  noise to the diff.

---

## 22. When asked to add a new feature, default sequence

1. Find or write the service function in `lib/services/<domain>.ts`.
   Routes/actions are thin orchestrators; logic lives in services.
2. If schema changes: edit `lib/db/schema.ts`, then `npm run db:push`.
   Inspect generated SQL before applying to anything other than your
   dev branch.
3. If a new route: add a `page.tsx` under `app/` (public) or
   `app/(app)/` (authed). Add an `actions.ts` sibling for mutations.
4. Use `useActionState<State, FormData>` for forms with progressive
   enhancement. If you need fields to survive errors, plumb explicit
   `defaultValue` — `useActionState` won't do it for you.
5. Status pills, late chips, and empty states must follow the unified
   colour map (§ 11) and the established empty-state voice
   ("Quiet for now." / "No data in this range yet." style).
6. `npm run build` locally before committing. The Edge-vs-Node split
   sometimes blows up at build time even if `dev` was happy.
7. After committing, push to `main` — Vercel auto-deploys. Verify on
   `baari-tech.vercel.app`.

---

*This file is meant to be read by AI coding agents picking up unfamiliar
work in this repo. If you change architectural assumptions, update this
file in the same commit.*
