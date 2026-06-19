# Walkthrough — comparing the two redesign branches

You have two preview deployments. Spend ~15 minutes going through both
with this list open. Each section is "open this → click that → expect
this." If anything misses the expectation, that's a real bug — note it,
don't gloss over it.

For the deep technical context behind each branch, see:
- Python/Jinja branch (`redesign-cheap`): [AGENTS.md](AGENTS.md) at the repo root
- Next.js branch (`redesign-nextjs-full`): [frontend/AGENTS.md](frontend/AGENTS.md)

---

## Before you start

You should have these URLs ready:

| Branch                  | Vercel preview URL                                          |
| ----------------------- | ----------------------------------------------------------- |
| `redesign-cheap`        | from the **Python** Vercel project (baariprod) preview deployments |
| `redesign-nextjs-full`  | from the **Next.js** Vercel project (baari-web) preview deployments |

If either is showing a build error, the AGENTS.md "Deployment" and
"Common pitfalls" sections tell you what to check.

A note on data:
- `redesign-cheap` shares the **production** Neon branch with your live
  Python site. **Do not delete bookings** while testing — they're real.
- `redesign-nextjs-full` is wired to the empty `nextjs_eval` Neon branch.
  Sign up freely, create bookings, mark them done. None of this touches
  production data.

---

## Part 1 — `redesign-cheap` (Python + Jinja + CSS polish)

The dashboard you already know, with a polish layer that ports the
landing page's visual language.

**What to look for:** does it feel like the same product as the landing,
or like a separate app linked from the landing?

### 1.1 Landing → Login

1. Open the preview URL → it should drop you on `/login` (since you have
   no session in this preview's cookie jar).
2. **Look at:** the auth card. Expect two indigo orb blobs in the corners
   (top-left and bottom-right), card surface looks frosted/translucent,
   the "Welcome back" title has a foreground→indigo gradient.
3. **Sign in** with your real prod credentials (this is the prod DB).

### 1.2 Queue page polish

1. Land on `/queue`. Look at:
   - **Topbar** — sticky, frosted, indigo-tinted bottom border, the "B"
     mark has a soft indigo halo.
   - **Counters** (Booked / Waiting / Done / No-show) — each card has a
     thin indigo gradient bar at top, lifts on hover.
   - **Primary "New booking" CTA** — should have a multi-layer indigo
     glow halo around it. Hover should intensify the glow.
   - **Queue rows** — frosted cards. On hover, each row translates 2px
     right with a soft indigo wash shadow.
2. **Click a row's "Check in" button.** Watch the swap — should
   cross-fade via the View Transitions API instead of flashing. Same
   when clicking "Mark done" on the now-consulting card.
3. **Watch the now-consulting card** — the token number has a
   foreground→indigo gradient text fill, and the card itself has a
   subtle indigo aura around it.

### 1.3 Stress-test the smoothness

1. Click rapidly through Queue → Search → Settings → Reports → Queue.
   The page enter animation should fire each time (~320ms fade-up). The
   topbar stays put (sticky).
2. Open a different patient's booking and mark them done. The board
   re-renders via HTMX (10s background poll OR your action). The
   `view-transition-name` per row means the morphing animation is per
   row, not the whole board flashing.

### 1.4 What this branch CAN'T fix

- Server roundtrip on every action. Even with skeleton loaders and view
  transitions, there's still a 100–300ms window between click and visual
  change. The View Transitions API mitigates the *flash* but not the
  *roundtrip*.
- "Sub-second" SPA feel for sequential rapid actions. HTMX still sends
  one request per action.

If those gaps bother you in real use, the Next.js branch is the answer.

---

## Part 2 — `redesign-nextjs-full` (full rebuild)

A self-contained Next.js app that owns auth, queue, bookings, search,
WhatsApp, cron — no Python at runtime.

**What to look for:** does interaction feel instant compared to part 1?
And: does any feature feel half-baked (an "ah but this Python had…")?

### 2.1 Sign up fresh

1. Open the preview URL. **Click Start for free** (or just visit
   `/signup`).
2. On the signup card, **pick a vertical chip** (Clinic / Dental / Salon
   / Spa / Vet / Other). The selected chip should highlight with an
   indigo ring + tinted background.
3. Fill business name (e.g. "Test Workspace"), your name, mobile
   (any 10 digits), password (8+ chars, letters + digits — `password1`
   works for testing).
4. Click **Create workspace**. You should land on `/setup`.

**If signup fails with "Could not create workspace":** the most common
cause is "mobile number already exists in this Neon branch" (you reused
a number from a prior signup). Try a different 10-digit number.

### 2.2 Finish setup

1. On `/setup`, you see opening-hours pickers per day. The defaults are
   pre-filled (9-19 weekdays, 9-14 Saturday, Sunday closed).
2. Adjust if you want, then **Finish setup**. You land on `/queue`.

### 2.3 The queue page (compare to part 1)

1. **Look at:** same visual vocabulary as the cheap branch — indigo glow
   CTA, glassmorphic cards, atmospheric orb backdrop, gradient text on
   the token number. The polish target is identical between branches.
2. Click **New booking** in the top-right. The transition to `/book`
   should feel instant — no flash, the View Transitions API cross-fades.
3. **Create a booking:** name + mobile + party size, pick a time slot
   chip from today's slots, **Create booking**. You should land back on
   `/queue` with the new entry in the "Waiting" column.
4. **Check in.** Notice it happens with a faint disabled state on the
   button, then the row updates. No full-page flash.
5. **Start** the consult. The booking jumps to the "Now consulting"
   card with the token displayed large + gradient.
6. **Mark done.** The booking moves to "Done today". If there's another
   checked-in booking waiting, it auto-promotes to "Now consulting".
7. **Undo done** (within 30 seconds). The "Undo" button only shows
   inside that window; click it and the booking flips back to in_consult.

### 2.4 The rest of the app

1. **Search** — go to `/search`, type 2+ characters of a name or mobile
   you booked. Should find them with status + slot time.
2. **Settings** (doctor only) — `/settings`. Change the workspace name
   or slot length, **Save**. The change should persist on reload.
3. **Reports** (doctor only) — `/reports`. Rolling 30-day totals based
   on the bookings you've created in this Neon branch. With one
   booking, you'll see Total=1, the rest 0.
4. **Sign out** (top-right logout icon). You go back to `/login`.

### 2.5 What feels different from the Python stack

- Clicks are *instant-er.* No HTMX swap delay. The button shows a
  disabled state, but the visible page updates without a hard refresh
  feeling.
- Page navigation is cross-faded by the browser, not a hard nav.
- The topbar tells you the workspace name with a gradient fill, the
  user's name + role on the right. Sticky + frosted.

### 2.6 What's missing (deliberately — see STATUS.md)

- No "Add family member" sub-token button on rows.
- No "Reschedule" or "Cancel" from a row.
- No "Close day" action — `daily_summaries` table exists but no UI.
- No Cloudflare Turnstile widget on `/signup` (the wiring exists; the
  widget render is the gap).
- No `/book/[id]` detail page.

None of these break the core flow. They're documented in
[STATUS.md](STATUS.md).

---

## Part 3 — make the call

Two questions to answer for yourself:

**1. Does the cheap path's polish close the gap enough for now?**

If yes → ship `redesign-cheap` to production. Keep building features in
the Python stack. The Next.js port becomes a "someday maybe."

If no → continue with the Next.js port. Spend a focused week closing
the STATUS.md gaps before merging, otherwise you ship something that
feels regressive on those missing features even if everything else
feels better.

**2. Is the Next.js port reliable enough to bet the product on?**

Things to weigh:
- All the production-critical paths are wired and clickable on the
  preview. Auth, signup, queue, booking, search, settings, reports.
- The state machine has the same invariants as the Python version
  (one in-consult at a time, restore-to-end, 30s undo window).
- The schema is identical except for enum names (which only matters if
  you try to share a Neon branch between the two stacks).
- The known gaps in STATUS.md are small. Sub-tokens is the only
  user-visible gap that has real product weight — and it's a 2-3 hour
  port.

If both answers point the same way, that's your decision. If they
conflict (e.g. "polish closes the gap" + "Next.js is reliable"), pick
based on how much engineering time you want to spend in the next month.
The Python stack is faster to add new features to *today*; the Next.js
stack will pay back as the UX bar rises.
