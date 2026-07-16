# Baari — Product & Engineering Handoff

A self-contained context document. Hand this to any developer or AI assistant joining the project and they should be able to navigate, debug, and ship from the current state.

---

## 0. What's changed since this doc was frozen (2026-07-15 addendum)

This handoff was last audited on 2026-06-30. Skim the highlights below
before reading the body — several sections point at things that have
since moved.

- **Hosting**: Railway is production now, on the custom domain
  **getbaari.in**. Any mention of `baari-tech.vercel.app` or "Vercel
  auto-deploys" below is stale. Deploy target = Railway; healthcheck
  `/api/health`.
- **Billing plans**: Free / Growth / Pro tier system with a 60-day Pro
  trial on signup is live. Resolver in `frontend/lib/plans.ts`; gates
  wired into Reports, booking creation quotas, CSV export, LTV. Header
  pill shows current plan. `/admin/workspaces` can grant plans. Payment
  plumbing (Razorpay/Stripe) is NOT wired yet — plans are display + gate
  only right now.
- **International**: E.164 mobile validation, country-code picker on
  every mobile input, region-detected pricing (INR for India, USD
  everywhere else), landing copy internationalised. Legacy Indian
  mobile numbers still work via `normalizeMobile()` backward compat.
- **Mobile app**: owner-side queue write actions (check-in, start,
  mark-done, walk-in, cancel, no-show, restore) all shipped under
  `/api/v1/owner/queue/*`. Owner login uses the country picker + E.164.
- **Schema drift**: since the schema section below was written,
  `clinics` gained `plan/plan_trial_ends_at/plan_source/plan_granted_by`
  + earlier `public_listing/slug/phone/city/accept_app_bookings/
  bookable_services`; `bookings` gained `guest_name/guest_mobile/source/
  amount_paid_inr/category/party_size`; sub-tokens table was dropped
  end-to-end. Source of truth is `frontend/lib/db/schema.ts`.

The full 2026-07-14→15 change log lives in AGENTS.md's "Recent updates
(through 2026-07-15)" section — read that first if you're an agent.

---

## 1. The product in one paragraph

**Baari** is a multi-tenant SaaS that replaces paper appointment registers at small/medium service businesses in Tier 2/3 India — clinics, dental practices, salons, spas, vets, and similar single-location SMEs. Two surfaces share one backend:

1. **Receptionist Dashboard** (web) at https://baari-tech.vercel.app — desk staff log in, manage today's queue, create bookings, mark people checked-in / in-session / done, view reports.
2. **Customer Mobile App** (React Native / Expo, Android first) — customers Google-sign-in, discover nearby businesses, book a slot, watch live queue position.

Live in production. End-to-end tested with one real clinic (Pratiksha). One unique user (the founder) bookings against it.

---

## 2. Repositories

| Repo | Path | What it is |
|---|---|---|
| **Baari** | `~/Documents/GitHub/Baari/` | The backend + receptionist dashboard. Single Next.js app. Source of truth for the DB schema. Hosted on Vercel. |
| **Baari-app** | `~/Documents/GitHub/Baari-app/` | The customer mobile app. Expo / React Native. Builds installable APKs via EAS Build. Talks to the Baari backend's `/api/v1/*` over HTTPS. |

`AGENTS.md` exists at the root of each repo with repo-specific guidance.

---

## 3. Tech stack

**Backend (Baari repo)**:
- Next.js 15.5 (App Router, Server Components, Server Actions)
- React 19, TypeScript strict
- Drizzle ORM 0.36.x
- **postgres-js** driver (NOT @neondatabase/serverless — see Gotchas)
- Neon Postgres (unpooled URL — see Gotchas)
- jose for JWT
- google-auth-library for verifying customer ID tokens
- Tailwind v3 + shadcn UI components for the dashboard
- Vercel deployment, auto-deploy on push to `main`

**Mobile app (Baari-app repo)**:
- Expo SDK 54, React Native 0.81, TypeScript strict
- Expo Router 6 (file-based routing)
- React Query 5 for server state (polling cadence 15s / 30s)
- StyleSheet (no NativeWind) with a ThemeContext for light/dark
- @react-native-google-signin for real Google auth (gated by `EXPO_PUBLIC_AUTH_MODE`)
- expo-notifications for local push (works in Expo Go)
- expo-secure-store for JWT, AsyncStorage for cached customer + theme
- EAS Build for native binaries (APK now, AAB for Play Store later)

---

## 4. Database schema

All tables live in `frontend/lib/db/schema.ts` (Baari repo). Migrated to Neon directly via `drizzle-kit push` or one-off scripts in `frontend/scripts/`.

| Table | Purpose | Key columns |
|---|---|---|
| `clinics` | One row per workspace (= tenant) | `id, name, tenantType, slug, publicListing, phone, city, address, openingHours JSON, slotLengthMin, noShowThresholdMin` |
| `users` | Staff who log in to the dashboard | `id, clinicId, role (doctor/receptionist), mobile, passwordHash, name` |
| `patients` | Per-clinic customer record | `id, clinicId, name, mobile, isNew, anonymizedAt, customer_id FK → customers.id` (the link is new) |
| `bookings` | Every appointment, full state machine | `id, clinicId, patientId, date, token, slotTime, status (booked/checked_in/in_consult/done/no_show/cancelled), source, partySize, createdByUserId, timestamps for every transition` |
| `sub_tokens` | Companions on one booking (T5.1, T5.2) | `id, bookingId, suffix, name, status` |
| `customers` | **Baari-wide** customer-app accounts | `id, googleId UNIQUE, email, name, photoUrl, mobile UNIQUE-WHEN-ACTIVE, language, notifyTurn, deletedAt, mobileChangedAt` |
| `booking_requests` | Short-lived tokens for /b/[token] missed-call SMS flow | `linkToken (18 byte URL-safe), expiresAt, usedAt` |
| `closed_days` | One-off closures (Diwali, owner vacation) | `clinicId, date, reason` |
| `notifications` | Queued/sent dispatch records | `bookingId, channel, trigger, status` |
| `daily_summaries` | Pre-computed per-clinic-per-day aggregates | totals, avg wait, avg consult, peak hour |
| `audit_log` | Staff actions for the dashboard's audit trail | `clinicId, userId, eventType, entity, changes JSON` |
| `rate_limit_buckets` | Simple per-key counter for limits | `bucketKey, count` |

**Cross-table identity glue**:
- `bookings.patientId` → `patients.id`. Patients are per-clinic.
- `patients.customer_id` (nullable) → `customers.id`. Adds Baari-wide identity. Backfilled via mobile match.
- A customer changing their mobile cascades to `patients.mobile` for every clinic they've booked at, except when it would collide with an existing patient.

---

## 5. Backend surface

### 5.1. Dashboard (server actions)

The dashboard is in `frontend/app/(app)/...` and uses Next.js Server Actions for mutations (not API routes). Session is a JWT in an HttpOnly cookie, set on login.

Key directories:
- `app/(app)/queue/` — the live queue board (most-used screen)
- `app/(app)/search/` — patient lookup
- `app/(app)/booking/` — new booking + booking detail
- `app/(app)/reports/` — date-range KPIs + charts
- `app/(app)/settings/` — workspace, hours, staff, account

Services (the business logic) live in `frontend/lib/services/`:
- `booking.ts` — slot enumeration, taken/available, next-token
- `queue.ts` — buildBoard (the queue page's main view-model)
- `booking-request.ts` — /b/[token] short-link flow + closed-day check
- `customer-bookings.ts` — bookings created from the customer mobile app
- `public-clinics.ts` — what the customer app's discover sees
- `reschedule.ts`, `cancel.ts`, `day-close.ts`, `sub-tokens.ts` — receptionist actions

### 5.2. Customer API — `/api/v1/*`

Every route under `frontend/app/api/v1/`. Auth is **Bearer JWT** (different scheme from the dashboard's cookie). Customer JWT carries `{cuid, type:"customer"}` and is minted via `lib/customer-auth.ts`.

| Route | Method | What |
|---|---|---|
| `/auth/google` | POST | Verify a Google ID token (or `mock:<id>` in dev), upsert a customer, return JWT |
| `/auth/dev` | POST | Mock-only sign in (gated by `DEV_AUTH_ENABLED` env). Used during development. |
| `/me` | GET / PATCH / DELETE | Profile read / update / soft-delete |
| `/me/mobile` | POST | First-time mobile capture; same duplicate + cooldown checks as PATCH /me |
| `/clinics/featured` | GET | Public listing of publicly-listed clinics with `nextSlotIso` |
| `/clinics/search` | GET (`?q=`, `?type=`) | Search by name + filter by tenant type |
| `/clinics/recent` | GET (Auth) | Past clinics this customer has booked at |
| `/clinics/:slug` | GET | Detail with hours, services, dynamic status (`closesAtIso`, `nextOpenIso`, `waitingNow`, `estWaitMinutes`) |
| `/clinics/:slug/slots?date=YYYY-MM-DD` | GET | Open slots for that date |
| `/bookings` | POST | Create a booking for the customer. Caps active at 2 per (mobile, clinic). |
| `/bookings` | GET (Auth) | `{active, past}` lists |
| `/bookings/:id` | GET (Auth) | Single booking detail with nested clinic |
| `/bookings/:id/status` | GET (Auth) | Polled every 15s — queue position + wait estimate |
| `/bookings/:id/cancel` | POST (Auth) | Customer-initiated cancel |

`lib/api-helpers.ts` standardizes response shape: success returns `{ok: true, ...payload}`, failure returns `{ok: false, error, code}`. Mobile app branches on `code`.

### 5.3. Error codes the mobile app branches on

| Code | When | App copy |
|---|---|---|
| `SLOT_TAKEN` | Two users booked same slot first | "Just taken — pick another time." |
| `CAP_REACHED` | Customer already has 2 active bookings here | "You already have 2 active bookings at this clinic. Cancel one before booking another." |
| `MOBILE_TAKEN` | Mobile owned by another active customer | "Another account is already using this number." |
| `MOBILE_LOCKED` | Tried to change mobile within 30 days | Server-rendered "You can change your mobile again in X days." |
| `UNAUTHORIZED` | 401 from any endpoint | Centralized handler in `_layout.tsx` clears session + routes to login. Toast: "Please sign in again." |
| `PRECONDITION` / `VALIDATION` | Server-thrown human messages | Verbatim |
| `RATE_LIMITED` | (not currently fired but reserved) | "Slow down a little and try again." |

---

## 6. Mobile app surface

### 6.1. Screens

File path → purpose:

- `app/index.tsx` — boot router. Reads token + cached customer + active-booking state, then routes to login, onboard, my-bookings, or discover.
- `app/(auth)/login.tsx` — Google sign-in. Mock-mode shows the 3-persona picker (anjali/rohan/priya); google-mode opens the real Google chooser.
- `app/onboard/mobile.tsx` — first-time mobile capture + language pick.
- `app/(main)/discover.tsx` — main browse screen. Has "YOUR PLACES" (past bookings), search, tenant filter chips, "NEAR YOU" featured.
- `app/(main)/my-bookings.tsx` — Active / Past tabs.
- `app/(main)/profile.tsx` — identity card, mobile edit, theme toggle (system/light/dark), language toggle (Hindi disabled), notify-turn switch, account actions (delete, logout).
- `app/clinic/[slug].tsx` — business profile with dynamic status, queue chip, hours, services, sticky CTA.
- `app/clinic/[slug]/book.tsx` — slot picker + confirm sheet.
- `app/booking/[id].tsx` — post-book confirmation.
- `app/booking/[id]/status.tsx` — live queue position (15s poll). Fires OS notifications on "your turn" / "you're next".

`app/_layout.tsx` is the root — wraps in ThemeProvider, QueryClient, SafeAreaProvider, registers the 401-handler.

### 6.2. Auth model

| Identity | Auth | Storage | Notes |
|---|---|---|---|
| Staff (dashboard) | Email + password → JWT in HttpOnly cookie | server cookie | Set on `/login` server action |
| Customer (mobile app) | Google ID token → backend JWT (Bearer) | `baari_token` in SecureStore | Customer record cached in AsyncStorage under `baari_customer` |

A staff JWT and a customer JWT can NEVER unlock each other — they carry mutually-exclusive claims (`uid+cid+role` vs `cuid+type:"customer"`).

### 6.3. Theming

- `lib/theme.ts` exports `lightColors`, `darkColors`, plus static `spacing`, `radius`, `font`, `weight`, `shadow`.
- `lib/theme-context.tsx` exposes `useTheme()` returning `{ mode, resolved, colors, setMode }`. Default mode "system".
- Every component uses the `makeStyles(colors)` factory pattern with `useMemo(() => makeStyles(colors), [colors])`. Theme toggle triggers a re-render across the app.
- Dark palette matches the receptionist dashboard's `--primary` exactly (`hsl(245 80% 66%)` = `#7378f0`).

### 6.4. Two build paths

| Profile | Output | Use |
|---|---|---|
| `development` | APK with dev-client baked in | Loads JS from `npx expo start` Metro on your laptop. Hot reload. Same as Expo Go but with custom native modules (Google Sign-In). |
| `preview` | APK with JS bundled in | Runs anywhere with internet. Used for sharing with pilot clinics. |
| `production` | AAB (Play Store format) | Submitted to Play Store. Not built yet. |

Env vars per profile live in `frontend/eas.json` `env:` blocks. EAS Build's cloud cannot read your local `.env` — must be in eas.json.

---

## 7. Deployment

### Backend
- Push to `main` → Vercel auto-deploys (~1-2 min).
- DB migrations run manually before push (via `npm run db:push` or one-off scripts in `frontend/scripts/`).
- Env vars in Vercel project settings: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_WEB_CLIENT_ID`, `DEV_AUTH_ENABLED` (should be unset/false in prod).
- Local env is in `frontend/.env.local` (Next.js convention).

### Mobile app
- `eas build --profile preview --platform android` → ~15-20 min cloud build → APK URL.
- Share the APK URL or QR with testers; they install the APK directly.
- For JS-only fixes after install, EAS Update wires up `expo-updates` and ships in 30 sec without rebuild. (Not yet enabled in this project — planned.)
- iOS deferred (would require Apple Developer account ₹8,300/yr).

---

## 8. Current state — what works end-to-end

✅ Customer signs in with real Google account → backend creates customer row  
✅ Customer enters mobile (TRAI-validated, unique across customers, 30d cooldown on changes)  
✅ Discover: featured list, search, filter, YOUR PLACES section (past bookings), skeleton loaders  
✅ Clinic page: dynamic status (`Open · Closes 19:00` / `Closed · Opens Mon 09:00`), queue chip (`3 waiting · ~45 min`), hours, services, dynamic CTA (`Book an appointment` / `Book for tomorrow`)  
✅ Slot picker with today/tomorrow, taken slots greyed, confirm sheet  
✅ Booking confirmation with token, share-to-WhatsApp, calendar, directions  
✅ Live status with 15s polling, OS notifications on "your turn"  
✅ My Bookings: active + past, cancel from list, pull-to-refresh  
✅ Profile: edit mobile, theme toggle, language toggle (Hindi disabled), notify switch, logout, delete account  
✅ Receptionist dashboard: queue management, search, booking, reports, settings — all functional  
✅ Backend: customer identity tightened (unique mobile, cooldown, customer↔patient FK)  
✅ Dark theme matching landing page across every screen  
✅ Real branding (Baari logomark, splash, login)  
✅ Production-shaped APK installable on phone, runs independently of laptop  

---

## 9. Known deferred / pending

| Item | Why deferred | When to revisit |
|---|---|---|
| **Distance ranking on Discover** | Requires clinic lat/lng. Will be captured during clinic onboarding screen. | Once clinic onboarding ships + 20+ clinics in 2+ cities. |
| **Full Hindi i18n pass** | Mechanical work (~90 min). Need a Hindi-first pilot clinic to validate. | Anytime — purely additive |
| **EAS Update wiring** | Quick (30 min) but no rush — current commits ship via rebuild | Next session if many small fixes coming |
| **iOS / TestFlight** | Apple Developer fee ₹8,300/yr, no signal yet | When pilot data shows iPhone demand |
| **Rate limiting on customer endpoints** | None right now. Vercel doesn't have built-in. Use Upstash + ratelimit before posting on Reddit. | Before public-stranger testing |
| **Privacy + Terms pages** | Profile links to /privacy + /terms which 404 | Before Play Store submission |
| **Demo clinics + auto-progress** | Strangers shouldn't book at Pratiksha for real | Before public-stranger testing |
| **Short Baari codes** for the "Have a Baari code?" entry | No `clinics.short_code` column yet | When physical materials are printed |
| **Play Store submission** | Needs the above + ₹2,100 fee | After successful pilot |

---

## 10. Gotchas / things that bit us

1. **postgres-js, NOT neon-http.** The neon-http driver doesn't support transactions and throws inside any `db.transaction(...)`. Even though postgres-js is installed, you must ALSO use the **unpooled** `DATABASE_URL` from Neon — the pooler runs in pgbouncer transaction mode which kills BEGIN/COMMIT. Currently `frontend/lib/db/client.ts` uses postgres-js with `prepare: false, ssl: "require", max: 1`.

2. **No `db.transaction(...)` anywhere.** Even with postgres-js + unpooled URL, transactions hung mysteriously on Vercel serverless. Refactored every multi-step write to use ON CONFLICT (for upsert) + retry loops (for token collisions). `customer-bookings.ts` is the canonical example.

3. **Drizzle-kit push is interactive.** It prompts Y/N before applying DDL. Background or non-TTY invocations exit at the prompt. For automation, write a one-off script using postgres-js directly (see `frontend/scripts/migrate-customer-identity.mjs`).

4. **`.env.local` not `.env`.** Next.js convention. The migration script needs to explicitly load `.env.local` first.

5. **EAS Build doesn't see your local `.env`.** Set env vars in `frontend/eas.json` `env:` blocks per profile. The dev build hit `.env` because it loaded JS from local Metro; preview/production builds bundle on EAS Cloud and need eas.json.

6. **expo-router deprecation warning** (`Passing an object as the argument to 'navigate' is deprecated`) is from inside expo-router itself, not our code. Cosmetic. Goes away in SDK 55+.

7. **EAS Build needs `.npmrc` with `legacy-peer-deps=true`** at `frontend/.npmrc` — React Navigation peer-dep drift Emergent shipped.

8. **expo-dev-client must be installed manually** before the first development build: `npm install expo-dev-client --legacy-peer-deps`. EAS CLI auto-install hits the same peer-dep issue.

9. **Mobile app's auth gating.** Customer JWT and staff JWT have mutually exclusive claims. A customer hitting a server-action route gets bounced; a staff cookie hitting `/api/v1/*` gets rejected. Don't try to merge — leave them separate.

10. **Time zones.** Backend treats all "today" calculations in IST (`Asia/Kolkata`). Day-of-week derivation uses noon IST as anchor (`new Date(\`${dateStr}T12:00:00+05:30\`)`). Don't use bare `new Date()` for clinic-day math.

11. **Mock auth in production = backdoor.** `DEV_AUTH_ENABLED` env on Vercel must be unset/false. If true, any stranger can sign in as anjali/rohan/priya by POSTing `{mockId}` to `/auth/dev`.

---

## 11. For Claude reading this

If you're a Claude instance picking this up:

- **Read `AGENTS.md` in each repo first** — they have repo-specific conventions and pointers.
- **Don't edit anything in `../Baari/` from a Baari-app session, or vice versa.** Different repos, different concerns. Surface backend asks back to the user; they'll switch sessions.
- **Don't run `db:push` or migrations without explicit user confirmation** — they affect prod DB.
- **Always TypeScript-check before committing** with `npx tsc --noEmit`. Both repos are strict TS.
- **Match the existing `makeStyles(colors)` factory pattern** in the mobile app. Don't reach for inline styles or `StyleSheet.create` at module scope when colors are involved.
- **Always handle the case where a new backend field is missing on the client** — there's a ~30-sec deploy gap on every backend push. See `buildStatus` in `ClinicCard` and `buildOpenStatus` in `app/clinic/[slug].tsx` for the pattern.
- **Don't introduce `db.transaction(...)` anywhere.** Use ON CONFLICT or retry loops. The transactional path is broken on this Neon+Vercel setup.
- **Treat product feature requests with a feasibility lens** — the user often has a non-technical cofounder feeding ideas. Flag what's already built (cofounder might be on an old screenshot), what's quick, what needs prerequisites.

---

## 12. Quick-reference paths

| What | Where |
|---|---|
| DB schema | `frontend/lib/db/schema.ts` (in Baari repo) |
| Customer API routes | `frontend/app/api/v1/` (in Baari repo) |
| Backend services | `frontend/lib/services/` (in Baari repo) |
| Dashboard screens | `frontend/app/(app)/` (in Baari repo) |
| Mobile app screens | `frontend/app/` (in Baari-app repo) |
| Mobile theme tokens | `frontend/lib/theme.ts` + `frontend/lib/theme-context.tsx` (in Baari-app repo) |
| Mobile components | `frontend/components/` (in Baari-app repo) |
| Migration scripts | `frontend/scripts/` (in Baari repo) |
| Env config for EAS | `frontend/eas.json` (in Baari-app repo) |

---

*This document was generated from the live state of both repos at the time of writing. It reflects what's actually deployed and what's pending. Update it when major architectural decisions change.*
