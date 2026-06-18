# redesign-nextjs-full — status

A complete Next.js full-stack port of the Baari dashboard. **No Python.**
The Next.js app talks straight to Neon Postgres via Drizzle ORM, owns auth
(JWT in HttpOnly cookies), and runs the queue state machine, WhatsApp
dispatch, and cron tick all in TypeScript.

This branch is for your morning evaluation. Nothing is merged to main.

## How to run

```bash
cd frontend
cp .env.example .env.local       # fill in DATABASE_URL + SECRET_KEY
npm install                       # (already done if you keep this checkout)
npm run db:push                   # creates the schema in your Neon branch
npm run dev                       # http://localhost:3000
```

**Important:** point `DATABASE_URL` at a **separate Neon branch** from the
Python stack. Neon's `Branches → Create branch` button gives you a fresh
URL in ~2 seconds. The schema is identical to the Python stack (same
table + column names) so swapping later is just an env flip — but while
you're evaluating, keep the data sets independent.

The first user you create via `/signup` becomes the workspace owner
(`doctor` role). Then `/setup` walks you through opening hours.

## What's wired and clickable

| Page                  | Real DB | Real auth | Polished UI | Notes                                                                |
| --------------------- | :-----: | :-------: | :---------: | -------------------------------------------------------------------- |
| `/` (landing)         |   —    |    —     |     ✅      | The existing marketing landing, now linking to local /login & /signup |
| `/login`              |   ✅   |    ✅    |     ✅      | Rate-limited per-IP + per-mobile, fails open on DB error             |
| `/signup`             |   ✅   |    ✅    |     ✅      | Honeypot + password strength + rate-limit + vertical chips           |
| `/setup`              |   ✅   |    ✅    |     ✅      | Day-of-week opening hours editor                                     |
| `/queue`              |   ✅   |    ✅    |     ✅      | Full state machine: check-in → start → done → undo; restore no-show. Live counters. |
| `/book`               |   ✅   |    ✅    |     ✅      | Today-only slot picker, no double-book guard, WhatsApp confirm fires |
| `/search`             |   ✅   |    ✅    |     ✅      | Name or 10-digit mobile, ILIKE patient + booking join                |
| `/settings`           |   ✅   |    ✅    |     ✅      | Workspace name + tenant type + slot length + no-show threshold       |
| `/reports`            |   ✅   |    ✅    |     ✅      | Rolling-30-day totals from live `bookings`. **Per-day summary table is stubbed** — see below. |
| `/api/cron/tick`      |   ✅   |  Bearer  |     —      | Sweeps no-shows, GCs rate-limit buckets. `Authorization: Bearer <CRON_SECRET>` |

## What's intentionally NOT wired tonight

These are real gaps you should know about before merging this branch.

1. **Sub-tokens (family members)** — schema is there, board reads them,
   but the dispatch buttons for "add family member" and "mark sub done"
   are NOT in the UI. The Python stack has a full sub-token UX
   (`partials/queue_row.html` + `app/services/subtoken_service.py`).
   ~2–3 hours of focused work to port.
2. **Day-close + daily summaries** — `dailySummaries` table is in the
   schema, but no "Close day" button. The Python `day_close.py` writes
   summaries and flips `bookings.status=booked → no_show` for anything
   left over. The cron tick (`/api/cron/tick`) already does the no-show
   sweep, so the gap is only the explicit close button + summary
   computation.
3. **Reschedule / cancel from a row** — server actions don't exist yet.
   The Python `booking_service.reschedule_booking + cancel_booking` are
   straightforward to port (~30 min).
4. **Theme cookie + Hindi/English language toggle** — `next-themes`
   already handles light/dark beautifully (top-right toggle in app
   layout). Language switching is missing; the Python `app/i18n.py` has
   ~80 keys to port if you want bilingual UI in this branch.
5. **Cloudflare Turnstile** — env vars are in `.env.example` but the
   widget isn't rendered on signup. The Python `app/services/turnstile.py`
   is a 50-line port.
6. **Booking detail page (`/book/[id]`)** — not built. Python has it for
   reschedule / cancel from a single page. Add when porting (3).
7. **MSG91 WhatsApp** — the dispatch lib (`lib/whatsapp.ts`) is fully
   ported including dev-mode no-op + audit-log row. But the *trigger
   surface* is only wired into `bookAction` (`booking_confirmed`). The
   other triggers (`youre_next`, `wait_changed`, `no_show`, `restored`)
   aren't fired yet from the queue actions. ~30 min to wire each.
8. **Cron infrastructure** — `/api/cron/tick` is built and authenticated.
   But there's no GitHub Actions workflow yet (Python stack uses
   `.github/workflows/cron.yml` to hit the FastAPI endpoint every 5
   minutes). Mirror that workflow but point at this endpoint with
   `Authorization: Bearer ${{ secrets.CRON_SECRET }}`.

## Architecture choices

- **`app/(app)/` route group** for everything dashboard-shaped — shared
  layout, sticky topbar, signed-in only. Middleware redirects
  unauthenticated requests to `/login?next=...`.
- **Drizzle ORM, Neon HTTP driver** — works on both Node and Edge
  runtimes. Serverless-friendly so cold starts are cheap.
- **Auth split:** `lib/auth.ts` is Edge-safe (jose only); `lib/password.ts`
  is Node-only (bcryptjs). Middleware only imports the Edge-safe half.
- **Server actions** for every mutation — no JSON API surface needed.
  `revalidatePath` after a queue action gives the same "instant board
  update" feel HTMX gives you, but without the roundtrip flash.
- **View Transitions API** (`@view-transition { navigation: auto }` +
  `viewTransitionName` on each queue row) makes navigation and state
  changes cross-fade smoothly. Same approach the cheap branch uses.
- **Glassmorphism + indigo glow** ported directly from the landing's
  visual language — same `--primary` HSL token, same `.glow-primary`,
  same `.orb` class, same snap-in easing.

## Build status

```
✓ npm run build → all 11 routes compile, no warnings
✓ tsc --noEmit → no type errors
✓ middleware bundle 39.5 kB (Edge-safe)
```

## Branch

`redesign-nextjs-full`, off `main` at commit 443927b. Not merged.
