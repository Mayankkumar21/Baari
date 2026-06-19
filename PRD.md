# Baari — Product Requirements Document

**Version:** 1.0 (2026-06-19)
**Status:** Living document. Update in the same commit as anything that
changes product behaviour or scope.
**Owner:** @Mayankkumar21
**Live product:** [baari-tech.vercel.app](https://baari-tech.vercel.app)

> This PRD is the single source of truth for *what* Baari is and *why*.
> The implementation companion is [AGENTS.md](./AGENTS.md). When the two
> disagree, this file describes the intent; AGENTS.md describes the
> code.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Problem & opportunity](#2-problem--opportunity)
3. [Vision & positioning](#3-vision--positioning)
4. [Target market & personas](#4-target-market--personas)
5. [Verticals supported](#5-verticals-supported)
6. [Core user journeys](#6-core-user-journeys)
7. [Functional requirements](#7-functional-requirements)
8. [Notifications strategy (the WhatsApp question)](#8-notifications-strategy-the-whatsapp-question)
9. [UX principles](#9-ux-principles)
10. [Multi-tenancy & per-vertical vocabulary](#10-multi-tenancy--per-vertical-vocabulary)
11. [Data model summary](#11-data-model-summary)
12. [Technical architecture](#12-technical-architecture)
13. [Non-functional requirements](#13-non-functional-requirements)
14. [Internationalisation](#14-internationalisation)
15. [Security & compliance](#15-security--compliance)
16. [Pricing & business model](#16-pricing--business-model)
17. [Success metrics](#17-success-metrics)
18. [Roadmap](#18-roadmap)
19. [Open questions & risks](#19-open-questions--risks)
20. [Glossary](#20-glossary)

---

## 1. Executive summary

Baari is a **live-queue and booking dashboard** for any appointment-based
business where customers wait their turn — clinics, dental practices,
salons, spas, vets, and similar. It replaces the **paper register** that
front-desk staff in Tier 2 / Tier 3 cities in India still use to track
arrivals, tokens, family groups, no-shows, and walk-ins.

The pitch is a single sentence: **"Your front desk, on one screen."**

The product is built as a multi-tenant SaaS — each business signs up to
its own isolated workspace via `baari-tech.vercel.app/signup`. Free
during early access. No installs, no per-seat licences, no training. Two
quick screens (business name + opening hours) and the receptionist is
running the queue from any browser.

**What's shipped today (v1):**
- Self-serve workspace creation
- Per-vertical vocabulary and service catalogues (six verticals)
- Live queue board with check-in / mark-done / walk-in / undo
- Family sub-tokens (up to 5 under one parent booking)
- Booking flow with slot grid + greyed-out unavailable slots
- Customer profile (`/search/[mobile]`) with stats, language inference,
  and full visit history
- Owner reports — KPIs with vs-previous-period deltas, hourly / weekday
  / service charts, sortable bookings table
- Settings — workspace config, per-day opening hours with breaks,
  password change, workspace deletion
- Light / dark theme via a tactile pill toggle
- Cron-driven no-show automation (every 5 min via GitHub Actions)

**What's intentionally NOT in v1:**
- Automated WhatsApp / SMS dispatch wired into the UI (see § 8)
- Multi-staff invites (single-owner workspaces only)
- Payments
- Multi-location / multi-branch
- Mobile-first app (it's a responsive web app — phone works, but the
  receptionist UX is tuned for a laptop or tablet)

---

## 2. Problem & opportunity

### 2.1 The paper register

Walk into a 100-customer/day clinic in Lucknow, Indore, Surat, or
Coimbatore and there is, with near-certainty, **a paper register on the
front desk**. Format varies — sometimes a printed booklet, sometimes a
spiral notebook with hand-drawn columns — but the rows are always the
same:

```
Token | Name        | Mobile      | Reason         | In | Out | Status
 7    | Anjali V.   | 9876543210  | Headache       | ✓  | ✓   | Done
 8    | Ravi K. + 1 | 9988776655  | Family, kids   |    |     | Waiting
 8.1  | Priya K.    |             |                |    |     | Waiting
 9    | Sneha I.    | 9871234567  | Followup       |    |     | Late?
```

This works. The receptionist is fluent in it. The doctor knows to look
for an upward tick in the "In" column to call the next patient. Until:

- The phone rings — "Has my husband's token come yet?" — and the
  receptionist scans 50 rows to find them.
- A walk-in arrives mid-day. Receptionist has to renumber.
- Someone forgets to mark "Out." The next day's report is wrong.
- Two staff write at the same time and one row gets overwritten.
- A patient claims they were there at 11 and were never seen.
- Anything that happens after 8pm closing depends on physically having
  the register in front of you.

### 2.2 Why existing software hasn't solved it

There are dozens of clinic-management products in India — most are sold
to hospital chains or to upmarket private clinics in Tier 1 cities.
They're priced ₹2,000-₹15,000 per month, require training, want a
dedicated computer at reception, and don't speak Hindi. A neighbourhood
homeopath, a dental practice in a strip-mall, or a salon owner running
two chairs **looks at that price and goes back to the register**.

The opportunity is the **long tail of single-doctor, single-clinic,
single-salon businesses** who would adopt good software at the right
price point with the right onboarding shape (zero installs, free until
you're getting real value, vernacular by default).

### 2.3 Why now

- Smartphone + 4G penetration in Tier 2/3 means staff already know how
  to operate a touch UI.
- UPI normalised the idea of business owners using software they didn't
  buy through a sales rep.
- WhatsApp ubiquity changes customer expectations — they want a ping
  saying *"you're next."* Even if we can't ship automated WhatsApp on
  day one (§ 8), there's a path.

---

## 3. Vision & positioning

### 3.1 Product vision

**The default front-desk tool for every appointment-based business in
India**, regardless of vertical or city.

Three years out, the success state is: a salon owner in Indore tells
another salon owner — "stop using the diary, just download Baari" —
and the second owner is operating it within 10 minutes.

### 3.2 Positioning statement

> For **front-desk staff at appointment-based small businesses in India**
> who today rely on a **paper register**, **Baari** is a **browser-based
> live queue and booking dashboard** that **replaces the register with
> one screen they can run from any device.** Unlike clinic-management
> suites built for hospital chains, Baari is free to start, takes two
> screens to set up, and speaks the words your vertical uses.

### 3.3 Design tenets

1. **Receptionist-first.** Every action the receptionist does 30 times
   a day must be one click away from the queue board.
2. **No installs, ever.** Sign in from any browser and start working.
   Phone, tablet, the family laptop — same UI.
3. **Vernacular by default.** Hindi script and per-vertical wording
   (the dentist's chair, the stylist's chair, the doctor's consult)
   are not afterthoughts.
4. **Free until they're getting value.** Early-access tier covers the
   entire single-clinic, single-receptionist workflow at zero cost.
5. **Honest about what's automated.** If we can't reliably ping the
   customer for a clinic without 5 days of WhatsApp setup, don't
   promise we can. Make the receptionist's manual ping one click
   instead.

---

## 4. Target market & personas

### 4.1 Geography

- **Primary:** Tier 2 / Tier 3 cities in India. Roughly: Lucknow,
  Indore, Jaipur, Coimbatore, Surat, Nagpur, Vadodara, Patna, Bhopal,
  Visakhapatnam, Mysuru, Ranchi, Madurai, Tiruchirappalli, etc.
- **Secondary (later):** Tier 1 budget clinics, peri-urban areas, and
  the long tail of single-chair salons / single-room dental practices
  in metros.
- **Excluded for now:** Hospital chains (different buying motion),
  international markets (vocab + payments + regulations all change),
  enterprise (we're not selling top-down).

### 4.2 Primary personas

#### Persona A — The owner-operator clinician
**"Dr. Anjali Sharma."** Runs a 1-2 doctor homeopathy / GP / paediatric
/ dental practice. Sees 30-80 patients a day. Cares about not losing
patients to no-shows, and about being able to look at *yesterday's
numbers* without flipping pages. Buys the software (or doesn't), but
doesn't operate it day-to-day.

- **What success means for them:** "I can see at a glance how many
  came today, and the receptionist isn't bothering me with whose turn
  is next."
- **Primary screens:** Reports, Settings, occasional Queue.
- **Buying triggers:** Free trial works → owner sees clean reports →
  decides to keep using.

#### Persona B — The receptionist
**"Priya."** Runs the front desk. Aged 20-40. Lives in the same city.
Operates the product 8-10 hours a day. Speaks Hindi + English fluently;
some clinics, only Hindi. Already runs the paper register expertly.

- **What success means for them:** "I don't have to flip back through
  the register, I don't have to write the same name twice for family,
  I don't get yelled at because someone's turn was skipped."
- **Primary screens:** Queue (the entire day), Search, Booking.
- **Adoption blockers:** Anything that makes one of her 30 daily
  actions slower than the register would kill the product instantly.

#### Persona C — The salon/spa owner-operator
**"Ravi."** Owns a 2-3 chair salon. Often cuts hair himself; his wife
or brother runs the front desk. Sees ~25-40 customers a day across
chairs. Same purchase motion as Persona A, but cares about *who's in
which chair* more than about clinical follow-ups.

- **Vocab differs:** "stylist," "service," "in chair." Already covered
  by the per-vertical vocab system (§ 10).
- **Notable difference vs clinic:** Walk-ins are much more common, slot
  bookings less so. Family bookings (mother + kids, couple coming in
  together) frequent.

### 4.3 Secondary personas

- **The customer** (Anjali Verma in the screenshots). Doesn't use
  Baari directly today. Future: scans a QR at the front desk to join
  the queue and watch their position from their phone (§ 8.2).
- **The doctor** (separate from the owner — in larger clinics). Uses
  the queue to see "who's next" and click Mark Done. Currently shares
  the receptionist's session.

### 4.4 Anti-personas (explicitly not for)

- 100-doctor hospitals with billing departments.
- Service businesses where bookings come from a marketplace (Urban
  Company, Practo). They have their own queue.
- Restaurants. Different vocabulary, different turnover, different
  payments. Out of scope.

---

## 5. Verticals supported

Each tenant picks a `tenantType` at signup. This drives:

- Vocabulary (entity name, provider name, session name, the
  "in <X>" status label, the reason-for-visit field label).
- Default service catalogue (the dropdown on the booking form).
- Default no-show threshold (homeopath = 45 min, salon = 30 min).
- Defaults for slot length (most start at 20 min).

| Vertical | `tenantType` | Entity | Provider | "In session" reads | Reason label |
|---|---|---|---|---|---|
| Clinic (homeopath / GP / paeds / physio) | `clinic` | patient | doctor | "in consult" | Reason for visit |
| Dental | `dental` | patient | dentist | "in chair" | Procedure |
| Salon | `salon` | customer | stylist | "in chair" | Service requested |
| Spa | `spa` | guest | therapist | "in session" | Service requested |
| Vet | `vet` | pet | vet | "in consult" | Reason for visit |
| Other | `other` | customer | owner | "in session" | Notes |

Choosing `Other` is the explicit "I don't fit your map" escape hatch —
notary, lawyer, coaching, anything else.

**Out of scope verticals:** restaurants (different model), retail (no
turn-based service), education (term-based, not appointment-based),
fitness classes (group, not individual). Each could plausibly be added
later but not without rethinking some primitives.

---

## 6. Core user journeys

### 6.1 Owner-operator first-time setup (PRD §6.1)

1. Owner lands on `baari-tech.vercel.app` from a Google search or a
   word-of-mouth recommendation.
2. Reads the landing copy — "Your front desk, on one screen" — sees
   a screenshot of the queue board.
3. Clicks **Start free**.
4. Picks a vertical, types business name (smart placeholder
   pre-fills, e.g. "Tranquil Day Spa" for Spa), name, mobile,
   password.
5. Form rejects bad mobile inputs with TRAI-rule validation (must
   start with 6/7/8/9).
6. Signup succeeds → auto-login → `/setup` wizard.
7. Picks slot length, sets opening hours per day. "Copy Monday to
   weekdays" cuts repetitive entry.
8. Finishes setup → `/setup/done` shows their workspace URL with a
   "Bookmark this" hint + "Open dashboard" CTA.
9. **Success criterion:** time from clicking *Start free* to landing
   on `/queue` ≤ 3 minutes for a Hindi-comfortable user.

### 6.2 Receptionist daily operation (PRD §6.2)

Most of the working day is spent on `/queue`. The page must answer
five questions at a glance:

1. Who's currently with the doctor / stylist / therapist?
2. Who's next?
3. Anyone running late?
4. Did we lose anyone to a no-show?
5. What's our day total so far?

Receptionist actions, ranked by frequency:

| Action | How often | Where it lives |
|---|---|---|
| Add a walk-in | 5-20× / day | Walk in button → 2-field flash form |
| Create a booking from a call | 5-15× / day | New booking → side panel |
| Check a patient in | every arrival | Check in button on each waiting row |
| Mark done | every completion | Big green button on the NOW card |
| Look up "is my appointment booked?" | 3-10× / day | Search → name or mobile |
| Add a family member mid-consult | 1-3× / day | 3-dot menu on the row → Add sub-token |
| Mark a no-show manually | 0-3× / day | 3-dot menu → Mark no-show |
| Restore / undo a no-show | 0-2× / day | Reopen from Done strip or row |
| Close the day | 1× / day | Close day button (also auto at 23:55) |

**The full day must be operable without ever needing to navigate away
from `/queue` except for Search.**

### 6.3 Customer arrives unannounced (walk-in)

1. Customer walks in. Tells the receptionist their name + what they're
   here for.
2. Receptionist clicks **Walk in** on the queue.
3. Two-field form (name + mobile). Service is optional, defaults to
   "Walk-in."
4. Submit → booking created at the next open slot, status flipped to
   `checked_in` immediately (walk-ins are physically present, no
   separate check-in needed).
5. Token appears in the waiting list. **From click to token = ≤ 10
   seconds.**

### 6.4 Family group booking

1. T7 (the parent — Mrs. Verma) is at reception or already in consult.
2. Receptionist opens the row's 3-dot menu → **Add family member**.
3. Names the sub-token's holder (e.g. *Anaya, age 6*).
4. Sub-token T7.1 is created under T7.
5. When T7 is marked done, T7.1 auto-promotes to in-consult — *not*
   T8 — so families stay together at the door.
6. Up to 5 sub-tokens per parent.

### 6.5 Owner reviews yesterday

1. Owner opens `/reports` from a phone or laptop in the evening.
2. Picks **Last 7 days** range.
3. Sees:
   - Total bookings vs previous 7 days (with delta tooltip)
   - Completion rate
   - No-show rate (vs previous, in "% pts" not "pp")
   - Avg wait, avg session length
   - Hourly distribution chart (when's the peak?)
   - Busiest day of week
   - Top services / procedures
   - Sortable booking table
4. **Success criterion:** the four numbers an owner cares about (count,
   no-shows, peak hour, top service) are visible without scrolling on
   a phone.

### 6.6 Customer recognises a returning patient

1. Patient arrives. Receptionist isn't sure if they've been before.
2. Goes to `/search`, types name fragment or mobile.
3. Either: matches an existing record → clicks → `/search/[mobile]`
   shows the full profile (total visits, no-show count, last visit
   timestamp, inferred language preference, every prior booking row).
4. Or: no match → clicks **Add guest** → adds them so the next booking
   doesn't create a duplicate.
5. From the profile, **Book session** prefills name + mobile into a
   new booking form.

---

## 7. Functional requirements

Requirements are numbered as `PRD §7.x.y` so commits and issues can
reference them.

### 7.1 Authentication & accounts

- **§7.1.1** Mobile + password sign-in. No email, no OTP.
- **§7.1.2** Mobile must be a valid Indian mobile per TRAI rules: 10
  digits, first digit 6/7/8/9. Optional `+91` or leading `0` prefixes
  are stripped.
- **§7.1.3** Password ≥ 8 chars, must contain at least one letter AND
  one number.
- **§7.1.4** Sessions stored as JWT in HTTP-only Secure SameSite=Lax
  cookie. Expiry: 7 days for `doctor`, 30 days for `receptionist`.
- **§7.1.5** Signup is rate-limited per IP (5/h) and per mobile
  (configurable). Fails open on DB error.
- **§7.1.6** Login is rate-limited per IP and per mobile. Generic
  failure message — does not reveal whether mobile or password was
  wrong.
- **§7.1.7** Owner can change their own password from
  `/settings/account`. Receptionist password reset by owner — UI
  stubbed, full flow is v2.
- **§7.1.8** Owner can delete the workspace from `/settings/account` —
  type-name-to-confirm. Hard-deletes every dependent row in
  FK-reverse order and redirects to a public `/workspace-deleted`
  page (never to `/login`, which would crash trying to re-read the
  now-deleted clinic).

### 7.2 Workspace setup

- **§7.2.1** Workspace creator is the workspace owner (`doctor` role).
- **§7.2.2** Tenant type picked at signup, editable later from
  `/settings/workspace`.
- **§7.2.3** Opening hours stored per day. Each day can be:
  - Single shift (one open + one close), OR
  - Two shifts (open / close + open2 / close2 — midday break), OR
  - Closed (both fields blank).
- **§7.2.4** Slot length pickable from 15 / 20 / 30 / 45 / 60 min.
- **§7.2.5** No-show threshold (minutes past slot time before a
  booking auto-flips to no-show) default = vertical's
  recommendation, editable.
- **§7.2.6** Optional address shown on booking confirmations
  (when notification dispatch is wired).
- **§7.2.7** `setup_complete` gate: until set, every authed page
  redirects to `/setup`.

### 7.3 Queue board

- **§7.3.1** Single page (`/queue`) showing three regions: WAITING,
  NOW IN SESSION, DONE TODAY.
- **§7.3.2** Summary strip at top: Today total · Waiting · In session
  · Running late · Next free slot.
- **§7.3.3** Booking has status enum: `booked` → `checked_in` →
  `in_consult` → `done`. Or branches to `no_show` or `cancelled`.
- **§7.3.4** Only one booking AND zero sub-tokens may be `in_consult`
  at any given time per workspace.
- **§7.3.5** Auto-promote rules: when a booking / sub-token becomes
  `done` (and nothing else is in-consult), promote the first pending
  sub-token of the same parent. If none, promote the next
  `checked_in` booking by token, with `restoredAt`-stamped patients
  sorted to the end.
- **§7.3.6** Late display: if `now - slotTime ≥ 15 min` and status is
  `booked` or `checked_in`, the row shows an amber "Late" pill.
  Not a status transition.
- **§7.3.7** No-show transition: `slotTime + noShowThresholdMin <
  now` AND status in (`booked`, `checked_in`) → `no_show`. Fired by
  cron every 5 min OR by manual action on the row.
- **§7.3.8** Restore / reopen a no-show: returns to `checked_in` at
  the end of the queue, original token preserved.
- **§7.3.9** Mark done has a **30-second undo window**. The row
  remains visible in the Done strip with an Undo button during that
  window; click → reverse status + push the auto-promoted next
  booking back.
- **§7.3.10** Walk-in flow: 2-field flash form (name + mobile),
  booking created at the next available slot, immediately flipped to
  `checked_in`.
- **§7.3.11** Close day: explicit button or auto at ≥23:55 IST.
  Computes a `dailySummary` row and locks status transitions for
  yesterday's bookings.

### 7.4 Booking

- **§7.4.1** `/book` and the queue-side-panel form share the same
  underlying component.
- **§7.4.2** Slot grid shows every slot in today's opening window.
  Each slot is in one of three states:
  - `open` (clickable, solid border)
  - `taken` (greyed, line-through, "Already booked" tooltip)
  - `past` (dashed border, line-through, opacity 60, "Past time"
    tooltip)
- **§7.4.3** A slot is `past` only once its END time has elapsed,
  not its START time. The slot currently in progress remains
  bookable for late arrivals.
- **§7.4.4** "X of Y slots free today" indicator above the grid.
- **§7.4.5** "Save & add another" submit resets the form fields and
  keeps the panel / page open. Use case: receptionist booking a
  series of patients from one phone call.
- **§7.4.6** Service requested defaults to a per-vertical catalogue
  (Clinic: Consultation, Follow-up, Vaccination, …; Salon: Haircut,
  Colour, Styling, …; etc.). Free-text custom entry available via
  "+ Add custom…".
- **§7.4.7** Party size 1-5. Used for the family-booking hint on the
  queue row.
- **§7.4.8** First-visit checkbox flips `patient.isNew = true`.

### 7.5 Family sub-tokens

- **§7.5.1** A booking can carry up to 5 sub-tokens.
- **§7.5.2** Each sub-token has its own holder name, its own status
  (`booked` → `checked_in` → `in_consult` → `done` → `cancelled`),
  but no independent slot.
- **§7.5.3** Sub-tokens may be added at booking time OR mid-consult
  (parent already `in_consult`).
- **§7.5.4** Cancel a sub-token independently of its parent.

### 7.6 Search & customer profile

- **§7.6.1** `/search` has one input — name fragment OR full 10-digit
  mobile.
- **§7.6.2** Below the input: recent guests list (most recent 12
  customers by last activity).
- **§7.6.3** Search results show one row per matching booking.
- **§7.6.4** Clicking a recent-guest row OR a result opens
  `/search/[mobile]` — the **customer profile**.
- **§7.6.5** Customer profile contents:
  - Name, mobile, "first visit" / "frequent no-show" badges.
  - Stats grid: total visits, completed visits, no-show count
    (amber when > 0), inferred language preference.
  - Booking history table — every booking ever made for this
    customer at this workspace, with date, token, service, status,
    duration.
  - "Book session" CTA (vocab-aware) that takes the receptionist to
    `/book` with name + mobile prefilled.
- **§7.6.6** Add Guest creates a `patient` record without an
  attached booking — for enquiries / family contacts.

### 7.7 Reports

- **§7.7.1** Owner-only. `/reports` is gated by `requireDoctor`.
- **§7.7.2** Range selector: Today · Last 7 days · Last 30 days ·
  Custom (from / to). URL searchParams persist the range.
- **§7.7.3** KPI cards: Total bookings, Completed, No-show rate,
  Cancelled, Avg wait, Avg session. Each shows a delta vs the
  same-length previous period.
- **§7.7.4** Delta labels read in plain English: "no change",
  "+12% vs prev", "+5 (new)", with a hover tooltip explaining the
  underlying values. **Never** bare "new" or "0pp".
- **§7.7.5** Charts: hourly distribution (24 columns), weekday
  distribution (7 rows), top services (horizontal bars). Inline
  CSS bars, no chart library, no client component.
- **§7.7.6** Sortable bookings table at the bottom — all bookings
  in the range with sortable columns.

### 7.8 Settings

- **§7.8.1** Left sub-nav: Workspace · Opening hours · Staff ·
  Account.
- **§7.8.2** Workspace: name, business type, slot length, no-show
  threshold, address.
- **§7.8.3** Opening hours: per-day editor with optional second shift
  for breaks. "Copy Monday to weekdays" macro.
- **§7.8.4** Staff: user list with role + last login. "Invite
  teammate" is a v2 stub.
- **§7.8.5** Account: change password, sign out, danger-zone
  delete-workspace.

### 7.9 Cron-driven background work

- **§7.9.1** `/api/cron/tick` is the single cron endpoint, secured
  with `Authorization: Bearer <CRON_SECRET>`.
- **§7.9.2** Triggered every 5 minutes by GitHub Actions (Vercel
  Hobby cron is daily-only).
- **§7.9.3** Each tick walks every workspace and runs: no-show sweep
  + auto-close day if past 23:55 IST + GC rate-limit buckets.
- **§7.9.4** Drift up to ~10 min is acceptable.

---

## 8. Notifications strategy (the WhatsApp question)

### 8.1 The promise we *cannot* deliver in v1

Pre-v1, the assumption was that automated WhatsApp messages
(`booking_confirmed`, `youre_next`, `no_show`, etc.) would be wired via
MSG91 Business API. The code is in place but the dispatch is **a
no-op** when `MSG91_AUTH_KEY` is empty — which is its actual production
state.

Why we left it in this state:

- Meta Business verification is required (GST + PAN + incorp docs).
  Days to weeks of waiting.
- Every message template must be pre-approved by Meta. Rejection
  patterns are vague and not deterministic.
- BSPs (MSG91, Gupshup, AiSensy) charge ₹500-5,000/month platform fee
  + ₹0.30-0.85 per conversation (utility tier).
- A clinic with 30 bookings/day at ₹0.50 each pays ₹450/month just
  for messages — for a product they're getting free.
- Per-customer opt-in is required by WhatsApp policy before any
  outbound message.

For a Tier 2/3 SME on free tier, **this onboarding kills the funnel
before it starts.** Asking a salon owner to verify with Meta is a
hard no.

### 8.2 The v1 notification strategy: pull, not push

Instead of automated push, **shift the notification burden onto the
customer's own phone via a public queue page + QR code at reception**:

#### 8.2.1 Public per-workspace queue page (planned)

- Every workspace gets a public URL: `baari-tech.vercel.app/q/<slug>`.
- The page polls the queue every 10s and shows:
  - Current "now in session" token
  - List of waiting tokens
  - Estimated wait per token
- No auth — designed to be visible to customers in the waiting area.
- Workspace owner controls whether names are displayed in full,
  initials only, or hidden (privacy setting).

#### 8.2.2 QR code at the front desk (planned)

- Workspace owner downloads a printable QR card from `/settings` that
  encodes their public queue page URL + a join-the-queue form.
- Customer arrives, scans the QR, fills name + mobile + service →
  walk-in booking created → token assigned.
- Customer's own phone shows their token + position in line. They
  watch from the waiting area; no need for a notification.

#### 8.2.3 Click-to-chat WhatsApp link (ship next)

- Every row on the queue board gets a small WhatsApp icon.
- One click opens WhatsApp Web / app pre-filled with:
  > Hi <name>, you're next at <clinic>. Token <T7>.
- The receptionist hits send. The customer gets a real WhatsApp
  message **from the receptionist's own number**, with zero Meta
  verification, zero template approval, zero per-message cost.
- More flexible than templated messages — receptionist can edit.
- Loses: fully automated cron-driven sends. We accept this trade.

### 8.3 The v2 / paid path

For workspaces that grow past the manual-send threshold and want
fully-automated dispatch:

- **SMS via MSG91** (~₹0.20-0.30/msg) for no-show + late notices —
  cheaper and easier than WhatsApp, no Meta verification.
- **WhatsApp Cloud API direct** (skip the BSP markup) for
  `booking_confirmed`, `youre_next`, etc. Cheaper than going through
  MSG91. Setup is more dev work but only done once per workspace.
- Both are offered as **paid upgrades** in the v2 pricing tier — they
  fund the automation rather than the free tier subsidising it.

### 8.4 Public-facing copy correction

Marketing copy must be honest about this:
- ❌ "WhatsApp built in" (the v0 landing said this — misleading).
- ✅ "Customers scan a QR, watch their position from their phone."
- ✅ "One-click WhatsApp ping when they're next."

Already updated on the landing page; double-check before any future
marketing pushes.

---

## 9. UX principles

### 9.1 The 30-action test

Every action the receptionist performs ≥30× per day must be one click
away from `/queue`. If the count of clicks for a routine action
increases by 1 in a release, treat that as a serious regression.

### 9.2 Empty states are content, not warnings

Empty queue isn't broken — it's quiet. Empty reports isn't broken —
there's no data yet. Empty states use a single calm sentence + a
small icon. No exclamation marks, no "Error" tone.

Examples:
- Queue empty: "Quiet for now." + mug glyph
- No active session: "No active session." + user-x glyph
- Reports empty: "No bookings yet in this range. Your queue lights
  up as the first guest checks in."
- Search empty: "No guests on file yet. Add one with the button
  above — this list fills in as bookings come through."

### 9.3 Status colour system (consistent everywhere)

| Status | Treatment | Why |
|---|---|---|
| `in_consult` | emerald 15% bg, emerald 40% border | Active, brand-positive |
| `done` | emerald 10% bg, emerald 30% border | Same hue, lower contrast = settled |
| `no_show` | rose 15% bg, rose 40% border | Negative, but not destructive-red |
| `cancelled` | muted bg + line-through | Out of consideration |
| `checked_in` | primary 15% bg | Waiting, brand-engaged |
| `booked` | primary 10% bg | Waiting, lower engagement |
| late (display) | amber 15% bg | Warning, not failure |

Anywhere a booking status is shown — queue board, reports table,
search results, customer profile — the same map applies. Drift here
is a UX bug.

### 9.4 Latency budgets

| Interaction | Budget |
|---|---|
| Page-to-page navigation | ≤ 800ms |
| Server action (check-in, mark done) | ≤ 500ms end-to-end including revalidation |
| Slot grid render after typing | ≤ 200ms |
| Search results after debounce | ≤ 400ms |

### 9.5 Mobile-vs-laptop posture

The receptionist UX is primarily laptop / tablet. Phone is a
fallback. The owner UX (Reports, Settings) must read well on a phone
because owners check numbers from their phone in the evening.

### 9.6 Animation is for affordance, not decoration

Use motion to communicate state changes that wouldn't otherwise be
visible:
- Status changes flash briefly on the queue row.
- Theme toggle thumb slides with a spring (matches the rest of the
  app's tactility).
- Done card fades out after the 30-second undo window.

Do not animate landing-page sections in / out aggressively — heavy
section animations distract from a B2B sales context.

---

## 10. Multi-tenancy & per-vertical vocabulary

### 10.1 Isolation model

- Every row in every table carries `clinicId` (the workspace ID).
- Every query filters by `clinicId`. Bypassing this filter is a
  multi-tenant leak and is treated as a security bug.
- App-enforced, not Postgres RLS. Migrating to RLS is a hardening
  step for the day there are 100+ workspaces.

### 10.2 Vocabulary system

`lib/vocab.ts` maps `tenantType` → a label dictionary used across
the UI. See § 5 for the full table. The intent is: a salon owner
never sees "patient", a clinic owner never sees "service requested."

### 10.3 Service catalogue defaults

`lib/services/service-types.ts` exposes `servicesFor(tenantType)`
which feeds the booking form's service dropdown. Defaults are
opinionated per vertical (e.g. Spa = Massage / Facial / Body scrub
/ Aromatherapy / Other) with a free-text custom-add escape hatch.

### 10.4 What's NOT per-vertical (yet)

- Booking confirmations / notification templates (when wired) —
  hardcoded English currently.
- Status colour map — universal.
- Cancellation reasons — single free-text field.
- Booking attributes (e.g. "Procedure code" for dental, "Vaccine
  batch" for vet) — these would be vertical-specific structured
  data and they're out of v1 scope.

---

## 11. Data model summary

This is a product-side view. Full schema lives in
`frontend/lib/db/schema.ts`. See [AGENTS.md § 5](./AGENTS.md#5-data-model)
for the engineering view.

| Table | One row per | Notable fields |
|---|---|---|
| `clinics` | Workspace / tenant | `tenantType`, `openingHours` JSON, `slotLengthMin`, `noShowThresholdMin`, `setupComplete` |
| `users` | Login account | `clinicId`, `mobile`, `passwordHash`, `role` (doctor/receptionist), `lastLoginAt` |
| `patients` | Customer / patient / guest record | `clinicId`, `mobile`, `name`, `isNew`, `noShowCount` |
| `bookings` | Single appointment | `clinicId`, `patientId`, `date`, `token`, `slotTime`, `status`, lifecycle timestamps |
| `subTokens` | Family member under a booking | `bookingId`, `suffix`, `name`, `status` |
| `notifications` | One dispatch attempt | `trigger`, `channel`, `status`, `payload` |
| `auditLog` | A state change worth recording | event type + actor + payload (sparse coverage in v1) |
| `dailySummaries` | (clinic, date) after day-close | aggregated metrics |
| `rateLimitBuckets` | Fixed-window counter for a (scope, identifier) pair | `bucketKey`, `count`, `expiresAt` |

Datetime columns use `TIMESTAMPTZ` throughout — no aware/naive
mixing.

---

## 12. Technical architecture

One Vercel project. One Next.js app. One Neon Postgres database. No
separate backend. Server components + server actions speak directly
to the DB.

```
            baari-tech.vercel.app
                     │
       ┌─────────────▼─────────────┐
       │ Next.js 15.5 (App Router) │
       │ React 19, server actions  │
       │                           │
       │  • marketing landing      │
       │  • auth (JWT cookie)      │
       │  • queue + booking        │
       │  • search + profile       │
       │  • reports                │
       │  • settings               │
       │  • /api/cron/tick         │
       └────────────┬──────────────┘
                    │ Drizzle ORM
       ┌────────────▼──────────────┐
       │ Neon Postgres             │
       │ ap-southeast-1 (Singapore)│
       └───────────────────────────┘
                    ▲
       ┌────────────┴──────────────┐
       │ GitHub Actions cron / 5m  │
       └───────────────────────────┘
```

Stack details:
- **Framework:** Next.js 15.5, React 19, TypeScript strict.
- **DB driver:** postgres-js for transactions + @neondatabase/serverless.
- **ORM:** Drizzle (schema in TS, push via `drizzle-kit`).
- **Auth:** jose (JWT) on Edge, bcryptjs (Node) for password hashing.
- **Styling:** Tailwind 3.4, shadcn-style tokens.
- **Animation:** motion (Framer Motion successor).
- **Theme:** next-themes.
- **Hosting:** Vercel Hobby (project: `baari-tech`).
- **Cron:** GitHub Actions (Hobby Vercel cron is daily-only).

---

## 13. Non-functional requirements

### 13.1 Performance

- **§13.1.1** TTFB on `/queue` < 500ms p50, < 1000ms p95.
- **§13.1.2** Queue state-machine transitions return within 300ms
  p50 from action click to UI update.
- **§13.1.3** Initial bundle (First Load JS) for any authed page
  < 200 KB.
- **§13.1.4** Hourly chart, weekday chart, and top services chart
  use inline CSS bars — zero chart-library JS.

### 13.2 Reliability

- **§13.2.1** Postgres queries run inside the request lifecycle.
  Long-running aggregations are server-rendered with a cache
  revalidation TTL (default 60s on `/reports`).
- **§13.2.2** Rate limiter must fail open — a DB error never blocks
  signup or login.
- **§13.2.3** Cron tick is idempotent. Running every 5 minutes
  forever is safe.
- **§13.2.4** Workspace deletion uses a transaction. Partial failure
  must leave the workspace intact, not half-deleted.

### 13.3 Browser support

- Chrome / Edge / Safari current and one previous major.
- Firefox current.
- Mobile Safari, Chrome Android current.
- IE 11: explicitly unsupported.

### 13.4 Accessibility

- All interactive controls reachable via Tab.
- Theme toggle uses `role="switch"` + `aria-checked`.
- Status pills carry the status as text content (not relying on
  colour alone).
- Focus rings visible in both themes.

---

## 14. Internationalisation

### 14.1 Current state (v1)

- **Patient / customer names and reasons accept Latin OR Devanagari**
  at input. Fonts (Inter + Noto Sans Devanagari) load via
  `next/font/google` so both render cleanly without baseline drift.
- **Inferred language preference on customer profile** — Devanagari
  codepoints in the name → "हिन्दी", else "English". No DB column for
  preference yet.
- **App chrome is English-only**. The Python stack's bilingual key
  dictionary did not port.

### 14.2 v2 plan

- Add `patients.language` enum column (`en` / `hi` / `null`) with a
  picker on the customer profile.
- Add language toggle in `/settings/account` or the top nav.
- Re-introduce a translation file (`lib/i18n/<lang>.ts`) keyed by
  dotted paths.
- Translate, in order of priority: queue chrome → booking form →
  reports → settings → marketing landing.

### 14.3 Scope boundaries

- No plans for languages beyond English + Hindi at this stage.
  Tamil / Telugu / Marathi / Kannada are plausible v3 candidates if
  expansion warrants.

---

## 15. Security & compliance

### 15.1 Shipped (Tier 1)

- bcrypt password hashing (cost 10).
- JWT in HTTP-only Secure SameSite=Lax cookie.
- Multi-tenant isolation via app-enforced `clinicId` filter.
- HTTPS enforced by Vercel.
- Rate-limited signup and login (per IP + per mobile).
- Password strength enforced.
- Indian mobile validation (TRAI 6/7/8/9 first-digit).
- `/api/cron/tick` Bearer-secret auth.

### 15.2 Gaps (Tier 2)

- **CSRF tokens** on state-changing forms. SameSite=Lax helps but
  isn't airtight against cross-site POST.
- **Mobile / email verification** at signup. Today anyone can sign
  up as `9999999999`.
- **2FA** on owner accounts.
- **Postgres row-level security**.
- **WAF** in front of Vercel.
- **Audit log coverage** — only `reopenBooking` writes today. Wider
  coverage needed for incident forensics.
- **DPDP retention sweep** — `clinics.retentionDays` defaults to 730
  but no cron job honours it.

### 15.3 DPDP Act 2023 considerations

- Patient data is "personal data" under the DPDP Act.
- `patients.anonymizedAt` column exists for honouring deletion
  requests. UI is not built.
- Retention policy is per-workspace (configurable, not yet
  exposed).
- Consent capture on first booking is a v2 requirement before any
  paid users in regulated verticals (clinics, dental).

---

## 16. Pricing & business model

### 16.1 Tier 0 — Early access (current)

- **Price:** Free. Forever, for early adopters.
- **Limit:** None on bookings, users (single-user workspaces only),
  patients, history.
- **Notification model:** Manual click-to-chat WhatsApp + public
  queue page + QR. No automated dispatch.
- **Support:** Email / WhatsApp (one-to-one with the founder for
  now).

### 16.2 Tier 1 — Standard (planned, ~6 months)

- **Price:** ₹499 / month (target).
- **Adds:**
  - Multi-staff invites (up to 5 staff per workspace).
  - Automated SMS for booking confirmations + no-show notices
    (passthrough cost).
  - Closed-day calendar (block holidays, half-days).
  - Custom service catalogue.
  - Export reports as CSV / PDF.

### 16.3 Tier 2 — Growth (planned, ~12 months)

- **Price:** ₹1499 / month (target).
- **Adds:**
  - Automated WhatsApp dispatch via Cloud API (per-message charged
    separately at cost).
  - Multi-location.
  - API access.
  - Custom domain (e.g. `queue.sharmaclinic.in`).

### 16.4 What we don't do

- **No per-seat pricing.** The whole front desk uses one workspace.
- **No annual lock-in.** Monthly only at launch. Discount tiers for
  prepaid annual once retention is proven.
- **No sales reps.** Self-serve onboarding all the way through.

---

## 17. Success metrics

### 17.1 Acquisition

- Signups / week (track from `clinics.createdAt`).
- Activation rate: % of signups that complete setup
  (`setupComplete = true`).
- Time-to-first-booking: median minutes from signup to first
  booking created.

### 17.2 Engagement

- **DAU per workspace** — fraction of workspaces with at least one
  booking on a given day.
- Median bookings per workspace per day.
- **Walk-in vs scheduled mix** — early signal of how much value the
  product is delivering for walk-in-heavy verticals (salons).

### 17.3 Retention

- W4 retention: % of workspaces still active in the 4th week after
  signup.
- W12 retention.

### 17.4 Product quality

- Action error rate (server action 4xx + 5xx as a fraction of all
  actions).
- p95 latency on queue actions.
- Number of support emails per active workspace per month.

### 17.5 Revenue (post-pricing-launch)

- Conversion rate from Tier 0 → Tier 1.
- Monthly recurring revenue (MRR).
- Net revenue retention (NRR) — should stay > 100% if upgrades
  outpace churn.

---

## 18. Roadmap

### 18.1 Done (v1.0, today)

- Self-serve workspace creation, setup wizard.
- Queue board with full state machine + family sub-tokens.
- Booking flow with slot grid.
- Walk-in 2-field flash form.
- Search + customer profile.
- Owner reports with deltas, charts, sortable table.
- Settings (workspace, hours, staff stub, account).
- Theme toggle (light/dark, pill).
- Cron tick (no-show sweep, day close, GC).
- Marketing landing rewrite (8 sections, per UX spec).
- Workspace deletion with safe confirmation page.

### 18.2 Next (v1.1, target ~4 weeks)

- **Click-to-chat WhatsApp icon** on every queue row.
- **Public queue page** (`/q/<slug>`) with privacy settings.
- **QR-code card printable from `/settings`**.
- **Booking prefill from customer profile** (wire the `?prefill_…`
  params).
- **Form-state preservation on server-action errors** (signup,
  login, book — fix the "fields reset to empty" wart).
- **First v2 stub:** multi-staff invite flow design (still no code).

### 18.3 Then (v1.2, target ~12 weeks)

- Multi-staff invites (real, with role-based access).
- Hindi UI translation for queue + booking + reports.
- Bilingual customer-facing public queue page.
- SMS dispatch for no-show + booking-confirmed (paid tier).
- Closed-days UI exposed in `/settings/hours`.
- Custom service catalogue editor.
- CSV export of bookings + daily summaries.
- Audit log coverage extended to all state transitions.
- DPDP retention sweep cron job.

### 18.4 Later (v2, target ~6 months)

- Pricing tier launch. Tier 1 paid plan.
- WhatsApp Cloud API direct integration.
- Multi-location.
- API + webhooks.
- 2FA for owner accounts.
- Postgres RLS migration.
- Mobile app shell (PWA at minimum, possibly Capacitor wrapper).

### 18.5 Speculative (v3+, no commitment)

- Multi-language beyond Hindi (Tamil, Telugu, Marathi, Kannada).
- Inventory module for retail-attached workspaces (salon products,
  vet pharmacy).
- Patient-facing booking website per workspace (with a real
  booking page customers can share).
- Integration with practice management tools (HMS APIs).

---

## 19. Open questions & risks

### 19.1 Open questions

- **Should the owner be able to override `sessionProgress` vocab?**
  Today it's auto-set from `tenantType`. A salon owner who insists
  on "in chair" vs "in service" can't change it.
- **Receptionist provisioning** — owner-creates-with-temp-password
  vs invite-link-via-WhatsApp. Hand-built password is simpler but
  uglier.
- **Should the customer profile show the patient's *own* history
  across multiple workspaces?** No — multi-tenant isolation
  precludes it, and it would be a real privacy issue. But the
  question gets asked.
- **Booking edits** — today a booking's slot can be rescheduled but
  the form's UI for editing other fields (party size, service,
  notes) is incomplete. Worth scoping properly.

### 19.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Receptionist drops the product because Walk-in flow takes one click too many | medium | high | Continuous 30-action test (§ 9.1); track click-counts per session |
| Owner is angry that WhatsApp isn't fully automated | medium | medium | Honest marketing copy (§ 8.4); shipping click-to-chat as a bridge |
| Neon free tier saturates (compute hours) | low | medium | Move to Neon paid tier ($19/mo) before paying customer launch |
| Vercel function invocations exceed Hobby quota (100k/mo) | medium | medium | Move to Vercel Pro ($20/mo) at first paying customer; bump queue poll to 30s |
| DPDP enforcement action because of un-honoured retention / no consent capture | low | high | Build consent capture + retention sweep into v1.2 hard requirements |
| Brand confusion between this Baari and the Indian retail chain "Baari" | low | low | Trademark search pending; reposition to `Baari Front Desk` if needed |
| A clinic gets compromised because no 2FA + receptionist password leaks | medium | high | 2FA on owner accounts is v2 must-have before paid launch |

---

## 20. Glossary

| Term | Meaning in Baari |
|---|---|
| Workspace | A single business / clinic / salon. Synonymous with "tenant" or "clinic" in the schema. |
| Owner | The workspace creator. Has the `doctor` role in the DB. |
| Receptionist | A staff user at a workspace. Has the `receptionist` role. Currently a v2 stub. |
| Vertical | A `tenantType` — clinic, dental, salon, spa, vet, other. |
| Vocab | The label dictionary mapped per vertical (provider, entity, session, etc.). |
| Booking | A single appointment row. |
| Token | The display-friendly serial number for a booking on its date (T7, T8, …). |
| Sub-token | A family-member booking nested under a parent booking (T7.1, T7.2). |
| Slot | A bookable time window in a day, derived from opening hours + slot length. |
| Slot grid | The visual array of all slots in today's opening window on the booking form. |
| Queue board | The `/queue` page — waiting + now in session + done today. |
| In session | The status `in_consult`. Vocab: "in consult" / "in chair" / "in session" depending on vertical. |
| Late | A display flag (`booked` or `checked_in` past slot time by ≥15 min). Not a status. |
| No-show | Status set by cron when a booking is past `slotTime + noShowThresholdMin`. |
| Walk-in | A booking created on the spot without a prior appointment. Auto-checked-in. |
| Close day | End-of-day action that creates a `dailySummary` and locks status transitions. |
| Day summary | A `dailySummaries` row aggregating one day's metrics for a workspace. |
| Customer profile | The `/search/[mobile]` page with stats + booking history. |
| Public queue page | (Planned) The customer-facing `/q/<slug>` page that customers can view from their phone. |
| Click-to-chat | A `wa.me/…` link opened from the queue board so the receptionist can WhatsApp a customer manually. |

---

*Last updated: 2026-06-19. If you change product behaviour or scope,
update this file in the same commit.*
