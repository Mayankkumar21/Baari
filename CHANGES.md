# redesign-cheap — what changed

The dashboard (Python + Jinja + HTMX) now visually matches the Next.js
landing without touching any business logic, routes, models, or HTMX
behavior. **Nothing was removed; everything is additive.**

## What you should see when you boot it

- **Indigo halo on the primary CTA** ("New booking", "Mark done") — the
  same multi-layer shadow the landing's hero button uses.
- **Glassmorphic cards** — `.card`, `.now-card`, `.auth-card`, `.counter`,
  `.queue-row`, `.toast` all have `backdrop-filter: blur(10px)` and a
  translucent background.
- **Snap-in easing** — every interactive surface uses
  `cubic-bezier(0.16, 1, 0.3, 1)`, the landing's signature curve.
- **Gradient hero text** — `.now-card .token-big`, the `.auth-card h1`
  title, and the topbar "Baari" wordmark fade from foreground → indigo,
  matching the landing's `.text-gradient` utility.
- **Atmospheric backdrop** — a fixed radial gradient sits behind every
  page (`body::before`) with indigo orbs top-left + bottom-right.
- **Auth pages get hero orbs** — `.auth-page::before / ::after` add the
  same blurred indigo blobs the landing's hero has.
- **Topbar is sticky + glass** — `position: sticky; backdrop-filter:
  blur(16px)`, with a subtle indigo-tinted divider.
- **Brand mark glows** — the `B` chip in the topbar now has a soft
  indigo box-shadow.
- **Counter cards have a top accent line** and lift on hover.
- **Queue rows micro-shift right** on hover with an indigo wash shadow.
- **Page enter animation** — `main` fades + lifts in on every navigation.
- **HTMX swap-in** is now `baari-fade-in-snap` (translateY + scale).
- **View Transitions API** is wired globally
  (`htmx.config.globalViewTransitions = true` + `@view-transition
  { navigation: auto; }` + named `view-transition-name` on each queue
  row by booking id), so HTMX swaps and full-page navs both cross-fade.
- **Selection highlight** is now indigo-tinted.
- **Custom scrollbars** styled to the palette.

## What did NOT change

- No router, model, schema, or service code touched.
- No template logic touched — only the queue row got a single inline
  `view-transition-name` style attribute and base.html got one extra
  `htmx.config` line.
- All theme tokens / palette / dark-light variables are unchanged.
- HTMX behavior, polling intervals, swap targets all unchanged.

## Files modified

- `static/css/app.css` — appended a polish layer (everything after the
  `@media (prefers-reduced-motion)` block).
- `app/templates/layouts/base.html` — one line:
  `htmx.config.globalViewTransitions = true`.
- `app/templates/partials/queue_row.html` — one inline style:
  `view-transition-name: row-{id}`.

## Smoke-tested

- `find app -name '*.py' -exec python -m py_compile {} +` → exit 0
- `app.main` (via `api/index.py`) boots with `TestClient`
- `GET /` returns 200, CSS loads, view-transitions flag present in HTML
- All 13 templates parse (the `fmt_time / fmt_datetime` errors from the
  bare Jinja env are false positives — those filters are registered at
  app boot, see `app/templating.py`).

## Branch

`redesign-cheap`, off `main` at commit 443927b. Not merged.
