# AGENTS.md — Next.js full port

Authoritative tech context for the `redesign-nextjs-full` branch. The
existing root [AGENTS.md](../AGENTS.md) covers the Python/FastAPI stack;
this file covers the Next.js rewrite that lives entirely in `frontend/`.

Both branches were created on 2026-06-18 from `main @ 443927b`. They are
**not merged**. Pick one — don't try to run both production deployments
against the same Neon branch at once (schema diverges, see "Schema notes"
below).

---

## 0. Product brief (one paragraph)

Baari is a multi-tenant SaaS that replaces paper registers at appointment-
based businesses in Tier 2/3 India — clinics, dental practices, salons,
spas, vets. Each tenant gets a workspace with: live queue board, today-only
booking with slot picker, customer search by name/mobile, WhatsApp
notifications (booking confirmed, you're next, no-show, restored), and
basic reports. The queue state machine is the heart: `booked → checked_in
→ in_consult → done` with `no_show` and `cancelled` terminal states, an
undo window after `done`, and auto-promotion of the next checked-in
booking when the current consult finishes.

This branch keeps every functional requirement from the Python stack and
delivers them on Next.js + Drizzle + Neon with zero Python at runtime.

---

## 1. Architecture at a glance

```
                    Browser
                       │
                       │ HTTPS (one origin, no Python in path)
                       ▼
        ┌──────────────────────────────────┐
        │  Vercel — Next.js (App Router)   │
        │                                  │
        │  • /  /signup /login /setup     ←┼─── middleware.ts gates /(app)/*
        │  • /(app)/* — dashboard          │
        │      queue, book, search,        │
        │      settings, reports           │
        │  • /api/cron/tick — no-show GC   │
        │                                  │
        │  Server actions for every        │
        │  mutation — no JSON REST surface │
        └────────────────┬─────────────────┘
                         │ Drizzle (neon-http driver, Edge-safe)
                         ▼
                   Neon Postgres
                  (ap-southeast-1)
```

**Key shifts from the Python stack:**

| Concern         | Python stack             | This branch                          |
| --------------- | ------------------------ | ------------------------------------ |
| Templating      | Jinja2 + HTMX            | React Server Components              |
| State sync      | HTMX `hx-get` 10s poll   | `revalidatePath` after server action |
| Mutations       | POST → render partial    | Server actions, no JSON API          |
| Auth            | JWT cookie, FastAPI deps | JWT cookie, Next middleware + `getSession()` |
| Background jobs | GH Actions → FastAPI     | GH Actions → `/api/cron/tick`        |
| DB              | SQLModel + Alembic       | Drizzle + `drizzle-kit push`         |
| Smoothness      | Server roundtrip / swap  | Client transitions (`useTransition`) |

---

## 2. Stack versions

```
Next.js          15.5.19   (App Router, Server Actions, View Transitions)
React            19.0.0
TypeScript       5.x
Tailwind         3.4.15    (shadcn token system)
Drizzle ORM      0.36.4    (neon-http driver)
Drizzle Kit      0.28.1    (db:push only — no migration files)
@neondatabase/serverless  0.10.4
jose             5.9.6     (Edge-compatible JWT)
bcryptjs         2.4.3     (Node-only — split out of auth.ts)
Motion           11.13.5   (Framer Motion successor)
Lucide React     0.456.0   + custom tooth icon
next-themes      0.4.4     (light/dark/system)
zod              3.23.8    (form validation helpers — unused right now,
                            kept for the porting work in STATUS.md gap #3)
```

---

## 3. Repo layout (Next.js relevant)

```
frontend/
├── app/
│   ├── (marketing)/         ─ existing landing — page.tsx + layout.tsx
│   ├── (app)/               ─ DASHBOARD ROUTE GROUP — shared topbar
│   │   ├── layout.tsx       ─ requires session, fetches user/clinic/vocab
│   │   ├── queue/           ─ live queue board + state machine actions
│   │   ├── book/            ─ today-only booking with slot picker
│   │   ├── search/          ─ patient + booking lookup
│   │   ├── settings/        ─ workspace config (doctor only)
│   │   └── reports/         ─ rolling 30-day totals (doctor only)
│   ├── login/               ─ public; redirects to /queue if session valid
│   ├── signup/              ─ public; vertical chips + honeypot + RL
│   ├── setup/               ─ post-signup; opening-hours editor
│   ├── api/cron/tick/       ─ Bearer-authed cron endpoint
│   ├── globals.css          ─ shadcn tokens + .glow-primary + .orb + .glass
│   └── layout.tsx           ─ root html/body, ThemeProvider
│
├── components/
│   ├── app/                 ─ Dashboard-only: queue-board, app-nav, logout
│   ├── icons/tooth.tsx      ─ Custom dental icon (Lucide shape)
│   ├── sections/            ─ Marketing landing sections (hero, etc.)
│   ├── ui/                  ─ shadcn-style primitives: button, card,
│   │                          input, label
│   ├── site-header.tsx      ─ Marketing topbar
│   ├── theme-provider.tsx   ─ next-themes wrapper
│   └── theme-toggle.tsx
│
├── lib/
│   ├── db/
│   │   ├── client.ts        ─ Drizzle client (neon-http)
│   │   └── schema.ts        ─ THE SCHEMA — direct port of app/models.py
│   ├── services/
│   │   ├── queue.ts         ─ State machine + buildBoard view-model
│   │   └── booking.ts       ─ Slot generation + createBooking
│   ├── auth.ts              ─ Edge-safe JWT (jose) + normalizeMobile
│   ├── password.ts          ─ Node-only bcrypt + passwordStrength
│   ├── session.ts           ─ getSession / requireSession / requireDoctor
│   ├── rate-limit.ts        ─ DB-backed fixed-window (fails open on DB err)
│   ├── whatsapp.ts          ─ MSG91 dispatch (env-gated dev no-op)
│   ├── time.ts              ─ IST formatters + slot-combine helpers
│   ├── vocab.ts             ─ Per-tenant-type label dictionary
│   └── utils.ts             ─ cn() — clsx + twMerge
│
├── middleware.ts            ─ Gates /(app)/* via decoded JWT cookie
├── drizzle.config.ts        ─ Auto-loads .env.local with override:true
├── tailwind.config.ts
├── vercel.json              ─ {"framework":"nextjs"} — pins detection
└── .env.example             ─ Required vars + dev-mode notes
```

The repo also still contains `app/`, `api/`, `static/`, `migrations/`,
`alembic.ini`, `requirements.txt` from the Python stack. These are NOT
referenced by the Next.js build — they're dormant but kept so the
`redesign-cheap` branch keeps working. When this branch is shipped as
production, delete them.

---

## 4. Data model

Tables (all defined in [lib/db/schema.ts](lib/db/schema.ts)):

| Table                | Purpose                                    | Tenancy column |
| -------------------- | ------------------------------------------ | -------------- |
| `clinics`            | Tenant workspace + config                  | `id`           |
| `users`              | Auth subject; one user-per-mobile-per-clinic | `clinic_id`  |
| `patients`           | Customer record (called "patient" but vocab varies) | `clinic_id` |
| `bookings`           | Today's queue entries; one token per slot  | `clinic_id`   |
| `sub_tokens`         | Family members under a parent booking      | via `booking_id` |
| `notifications`      | WhatsApp audit trail + delivery status     | `clinic_id`   |
| `audit_log`          | Action-level history (admin diagnostics)   | `clinic_id`   |
| `rate_limit_buckets` | Fixed-window counters for signup/login     | n/a (key encodes) |
| `daily_summaries`    | Day-closed aggregates (not yet wired)      | `clinic_id`   |

Column types + names mirror `app/models.py` exactly — see "Schema notes"
below for the one diff (enum naming).

---

## 5. Queue state machine (the heart of the product)

```
            ┌─────────┐
            │ booked  │  ← createBooking(): today only, future slot only
            └────┬────┘
                 │ checkIn()
                 ▼
           ┌──────────┐
           │ checked_in│ ← also entered via restoreNoShow()
           └────┬─────┘
                │ startConsult()  (or auto-promote via tryPromoteNextBooking)
                ▼
           ┌──────────┐
           │ in_consult│  ◀───────┐
           └────┬─────┘            │
                │ markDone()       │ undoDone() within 30s window
                ▼                  │
           ┌──────────┐            │
           │   done   │────────────┘
           └──────────┘
                ▲
                │ noShowAt (cron tick when slot < now - threshold)
           ┌────┴─────┐
           │ no_show  │
           └──────────┘

       cancelled — set only by future cancelBooking() (TODO, see STATUS.md)
```

**Invariants enforced by the service layer:**

- At most one booking in `in_consult` per clinic per day. `anyoneInConsult`
  is checked before any auto-promotion.
- `restoreNoShow` sets `restored_at` and sorts the booking to the END of
  the waiting list (PRD §10.5).
- `undoDone` only succeeds within 30s of `completed_at`. It also reverses
  any auto-promotion that happened in that window (the freshly-promoted
  in_consult booking flips back to checked_in).
- Today-only booking: `createBooking` rejects any slot whose date ≠
  `clinicToday()` (Asia/Kolkata).
- Slot uniqueness: `takenSlots()` is checked before insert. Race-safe via
  the DB unique constraint on `(clinic_id, date, token)` would be tighter
  but we currently rely on the application check.

Implementation: [lib/services/queue.ts](lib/services/queue.ts).
Server actions thin-wrap these and call `revalidatePath("/queue")`:
[app/(app)/queue/actions.ts](app/(app)/queue/actions.ts).

---

## 6. Auth

| Component               | Where                                  |
| ----------------------- | -------------------------------------- |
| Sign session JWT        | `lib/auth.ts → issueSession()`         |
| Decode session JWT      | `lib/auth.ts → decodeSession()`        |
| Hash / verify password  | `lib/password.ts` (bcryptjs)           |
| Validate password rules | `lib/password.ts → passwordStrength()` |
| Normalize Indian mobile | `lib/auth.ts → normalizeMobile()`      |
| Read session from RSC   | `lib/session.ts → getSession()`        |
| Require session in page | `lib/session.ts → requireSession()`    |
| Require doctor role     | `lib/session.ts → requireDoctor()`     |
| Gate routes             | `middleware.ts` (Edge)                 |
| Set / clear cookie      | `app/login/actions.ts`                 |

**Why the split into `auth.ts` (Edge-safe) and `password.ts` (Node-only):**
middleware runs on the Edge runtime, which doesn't support `setImmediate`
or `process.nextTick`. bcryptjs uses both. By keeping bcrypt out of
auth.ts, middleware can `import "@/lib/auth"` for `decodeSession` without
pulling bcryptjs into the Edge bundle. Build log confirms: middleware
bundle is 39.5 kB. If it crosses 1 MB, you've broken this split.

Session payload (`SessionPayload`): `{ uid, cid, role }`. Trust the
`role` for permission checks in middleware-safe code; for fresh DB reads
of user/clinic, go through `getSession()` / `requireSession()`.

Cookie: `baari_session`, HttpOnly, SameSite=Lax, Secure in production.
TTL: doctor 7d, receptionist 30d.

---

## 7. Routes inventory

| Path                | Auth                | Method           | Notes                              |
| ------------------- | ------------------- | ---------------- | ---------------------------------- |
| `/`                 | Public              | GET              | Marketing landing                  |
| `/login`            | Public              | GET, POST action | Rate-limited; bounces authed users |
| `/signup`           | Public              | GET, POST action | Honeypot + RL + password strength  |
| `/setup`            | Authed              | GET, POST action | Bounces if `setup_complete=true`   |
| `/queue`            | Authed + setup-done | GET              | Build board server-side, no poll   |
| `/queue/*` actions  | Authed + setup-done | server actions   | checkIn, startConsult, markDone, undoDone, restoreNoShow |
| `/book`             | Authed + setup-done | GET, POST action | Today's slots; dispatches WhatsApp |
| `/search?q=...`     | Authed + setup-done | GET              | ILIKE on patient name + mobile     |
| `/settings`         | Doctor only         | GET, POST action | Workspace name + type + slot/no-show |
| `/reports`          | Doctor only         | GET              | Rolling 30d totals + recent rows   |
| `/api/cron/tick`    | Bearer (CRON_SECRET)| GET              | No-show sweep + RL bucket GC       |

---

## 8. Environment variables

| Variable        | Required | Default       | Notes                              |
| --------------- | :------: | ------------- | ---------------------------------- |
| `DATABASE_URL`  | yes      | —             | Neon pooled URL (with `-pooler`)   |
| `JWT_SECRET`    | yes      | —             | ≥32 chars; `SECRET_KEY` accepted as alias |
| `CRON_SECRET`   | no       | —             | Cron endpoint blocked if missing AND not "change-me" |
| `CLINIC_TZ`     | no       | Asia/Kolkata  | Affects `clinicToday`, `fmtTime`, slot generation |
| `MSG91_AUTH_KEY` etc. | no | —             | If any are blank, whatsapp.ts no-ops + logs |
| `NODE_ENV`      | auto     | development   | Production sets `secure: true` on cookie |

See [.env.example](.env.example) for the full list with the comments.

---

## 9. Running locally

```bash
cd frontend
cp .env.example .env.local      # fill DATABASE_URL + JWT_SECRET
npm install
npm run db:push                  # creates the schema in your Neon branch
npm run dev                      # http://localhost:3000
```

**Important:** `DATABASE_URL` must point at a Neon branch that does NOT
already have the Python schema in it. The enum names differ (see Schema
notes) so `db:push` against the Python schema will prompt to rename
enums, which would break the Python stack. The safe move is to create a
fresh empty Neon branch (or a new Neon project) and point this app there.

**First-run flow locally:**
1. Visit `/` → click **Start for free**.
2. On `/signup`, pick a vertical chip (Clinic / Dental / Salon / Spa /
   Vet / Other), fill business name, your name, mobile (10 digits),
   password (8+ chars, letters + digits).
3. You land on `/setup`. Default opening hours are pre-filled. Adjust
   slot length / no-show threshold / hours, click **Finish setup**.
4. You're on `/queue`. Empty board. Click **New booking** to create the
   first entry.

---

## 10. Deployment (Vercel)

The `frontend/` directory is its own Vercel project — root directory set
to `frontend/`. The repo also has a separate Python Vercel project rooted
at the repo root; the two coexist. `frontend/vercel.json` pins
`{"framework":"nextjs"}` so Vercel's UI doesn't fall through to the
"No Output Directory named 'public'" auto-detect bug.

To deploy this branch as a preview:
1. `git push origin redesign-nextjs-full`
2. Vercel auto-builds. First build fails without env vars.
3. In Vercel project settings → Environment Variables, scope = **Preview**:
   `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `CLINIC_TZ`.
4. Redeploy from the Deployments tab.

Production deploy (once you commit to this branch): merge to `main` and
duplicate the env vars at **Production** scope. Point `DATABASE_URL` at
the real prod Neon branch — and run `npm run db:push` against it ONCE,
before the first production traffic hits.

Cron tick: not auto-scheduled. The Python stack uses
`.github/workflows/cron.yml` to hit FastAPI every 5 min. Mirror that
file to hit `https://<your-domain>/api/cron/tick` with
`Authorization: Bearer ${{ secrets.CRON_SECRET }}`.

---

## 11. Schema notes (the one gotcha)

Drizzle declares pgEnums with snake_case names: `booking_status`,
`user_role`, `sub_token_status`, `notification_trigger`,
`notification_status`, `tenant_type`. SQLAlchemy (Python stack) creates
the same enums but spells them lowercase no-underscore:
`bookingstatus`, `userrole`, etc. The column data is identical; only the
type name differs.

**Consequence:** if you point both stacks at the same Neon branch and
run `drizzle-kit push`, it will prompt to rename the existing enums to
the Drizzle names. Accepting destroys the Python stack's reads. Aborting
leaves duplicate types. Either:
- Keep the two stacks on separate Neon branches (current setup), or
- Rename the Drizzle enums to match SQLAlchemy's convention. The minimal
  change is dropping the underscores in the `pgEnum("name", ...)` first
  argument inside [lib/db/schema.ts](lib/db/schema.ts). The column
  declarations don't need to change.

---

## 12. Common pitfalls (read before debugging)

- **Edge runtime warnings.** If you see "A Node.js API is used …
  setImmediate" during build, you've imported something Node-only into
  the Edge-safe path. Most likely cause: someone imported a function
  from `lib/auth.ts` that internally imports from `lib/password.ts`,
  OR re-exported password helpers from `lib/auth.ts`. Don't merge them.
- **`db:push` prompts to rename.** See Schema notes — your DB is not
  empty. Either wipe the public schema first
  (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` against ONLY the
  eval branch) or point at an empty branch.
- **dotenv loads 0 vars from `.env.local`.** Either the typo is on the
  variable name (`ATABASE_URL` vs `DATABASE_URL`) or your shell has
  pre-set the same names to empty strings. `drizzle.config.ts` already
  uses `override: true` so the shell-empty case is handled.
- **`/queue` redirects to `/setup` forever.** `clinics.setup_complete`
  is `false`. Finish the setup form OR flip the column manually for
  the test row.
- **Slot picker is empty.** Likely the day-of-week block in
  `openingHours` is closed (e.g. Sunday). Either change to a weekday
  in your timezone or edit hours in `/settings` (note: settings page
  doesn't include the hours editor — go through `/setup` again or
  update via SQL).
- **Server action does nothing.** Open Network tab — server actions
  appear as POST to the page path. If you see a 405/redirect, you're
  not authenticated. If 200 but board doesn't update, `revalidatePath`
  didn't fire (check the action's `try/catch` swallowed the error).
- **WhatsApp doesn't actually send.** Expected in dev — leave
  `MSG91_AUTH_KEY` blank. The `notifications` row is still written with
  `status=sent` + `failure_reason="dev-mode skip"`, which is how the
  audit trail stays intact.
- **Drizzle types complain about Date objects.** All `timestamp` columns
  are typed as `Date` on the Drizzle side. When passing dates to the
  client (server component → client component), serialize with
  `.toISOString()`. See `queue/page.tsx` for the pattern.

---

## 13. What's intentionally not wired

Tracked in [../STATUS.md](../STATUS.md). The short list:

- Sub-tokens (family members) UI — schema + read path present, no add/done buttons
- Day-close + daily summaries
- Reschedule / cancel from a queue row
- Hindi/English language toggle (`next-themes` handles dark/light)
- Cloudflare Turnstile widget on signup
- `/book/[id]` booking detail page
- WhatsApp triggers beyond `booking_confirmed`
- GitHub Actions cron workflow file

None of these block evaluation — they block production cutover.

---

## 14. Default sequence when adding a new feature

1. Schema change → edit `lib/db/schema.ts`, run `npm run db:push`.
2. Service function → `lib/services/<thing>.ts`, write the data logic.
3. Server action → wrap with `requireSession()` and `revalidatePath()`.
4. Page → server component fetches via service, passes serialized data
   to client components for interactivity.
5. Use `useTransition` for optimistic feel on user-triggered actions.
6. If the action affects the queue board, call `revalidatePath("/queue")`
   so other tabs see it on next nav.
7. If the change is destructive (DROP, schema rename), DO NOT use
   `db:push` against any branch that has data you care about. Hand-write
   the SQL and run it in the Neon console after backing up.
