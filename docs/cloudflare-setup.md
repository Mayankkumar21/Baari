# Putting Cloudflare in front of getbaari.in

10-minute setup. All done in the Cloudflare and Railway dashboards —
no code changes on your side beyond what's already shipped
(`getClientIp()` prefers `CF-Connecting-IP` now, so rate limits stay
accurate even after Cloudflare rewrites `X-Forwarded-For`).

## Step 1 — Add the site to Cloudflare

1. Sign up (or sign in) at https://dash.cloudflare.com.
2. Click **Add a site** → enter `getbaari.in` → select **Free plan**.
3. Cloudflare scans your existing DNS records. You'll see whatever
   records point at Railway (likely a CNAME on `@` and `www` pointing
   at `baari-production.up.railway.app` or a CNAME target Railway gave
   you).
4. Cloudflare gives you **two nameservers** — something like
   `ada.ns.cloudflare.com` and `noah.ns.cloudflare.com`. Copy them.

## Step 2 — Change nameservers at your registrar

Log in wherever you bought `getbaari.in` (GoDaddy / Namecheap /
Google Domains / etc.) and swap the nameservers to the two Cloudflare
gave you.

Propagation can take 5 minutes to a few hours. Cloudflare emails you
when it's active.

## Step 3 — Confirm records are proxied

Back in the Cloudflare dashboard → DNS → **Records**. For each record
pointing at Railway, click the little cloud icon so it goes **orange
(proxied)**, not grey (DNS only). Both `@` and `www` should be orange.

That's it — traffic now goes:

```
visitor  →  Cloudflare (edge)  →  Railway (origin)
```

## Step 4 — Cache Rules (biggest single win)

Cloudflare → Rules → **Cache Rules** → **Create rule**.

**Rule 1 — Cache the marketing pages:**
- If: URL Path is one of `/`, `/pricing`, `/legal/privacy`, `/legal/terms`, `/workspace-deleted`
- Then:
  - Cache eligibility → **Eligible for cache**
  - Edge TTL → **Override origin** → 5 minutes
  - Browser TTL → **Override origin** → 60 seconds
  - Respect strong ETags → on

**Rule 2 — Cache static assets forever:**
- If: URL Path starts with `/_next/static/`
- Then:
  - Cache eligibility → **Eligible for cache**
  - Edge TTL → **Override origin** → 1 year
  - Browser TTL → **Override origin** → 1 year

**Rule 3 — Bypass cache for the app itself:**
- If: URL Path starts with any of `/queue`, `/reports`, `/search`,
  `/settings`, `/admin`, `/api`, `/setup`, `/login`, `/signup`, `/forgot`, `/b/`
- Then:
  - Cache eligibility → **Bypass cache**

The order matters — put Rule 3 above Rules 1 & 2 so it wins for
authenticated / API paths. Cloudflare processes top-down.

## Step 5 — Security defaults worth flipping on

Cloudflare → Security:

- **Bot Fight Mode**: ON (Free plan). Filters obvious scrapers.
- **Security level**: Medium.
- **Under Attack Mode**: leave OFF unless you're actively being
  attacked (it interstitial-challenges every visitor).

Cloudflare → SSL/TLS:
- **Encryption mode**: **Full (strict)**. Railway serves valid TLS
  on its `*.up.railway.app` cert, so strict verification works.
- **Always Use HTTPS**: ON.
- **HTTP Strict Transport Security (HSTS)**: turn ON with 6-month
  max-age. (Note: only turn on if you're committed — removing it
  later is painful.)

## Step 6 — Lock down direct Railway access (optional but recommended)

Right now `baari-production.up.railway.app` still answers directly.
That means an attacker can bypass Cloudflare's rate limits, WAF, and
IP restrictions by hitting the origin URL. Two ways to fix:

- **Easy:** Add a small middleware or `next.config` header check that
  requires a shared secret Cloudflare adds (via Cloudflare
  Transform Rules) on every proxied request. Reject requests missing
  it with 403.
- **Pro Cloudflare feature:** Cloudflare Tunnel (a lightweight daemon
  on your origin). Overkill for now.

If you want the middleware version, ask me — it's ~20 lines of code.

## Step 7 — Verify everything works

Once nameservers propagate:

```bash
# Check Cloudflare is proxying
curl -sI https://getbaari.in | grep -i "cf-\|server"
# Expected: server: cloudflare, plus a cf-ray header

# Check cache is hitting for /pricing
curl -sI https://getbaari.in/pricing | grep -i "cf-cache"
# First hit: cf-cache-status: MISS
# Second hit within 5 min: cf-cache-status: HIT

# Check the app still works end-to-end
open https://getbaari.in
```

If `/queue` or `/reports` are returning stale content, Rule 3 isn't
matching — double-check the "Bypass cache" rule is above the "Cache
marketing" rule.

## Numbers to expect

- Anonymous `/` and `/pricing` requests will overwhelmingly serve
  from Cloudflare's edge (near-zero latency for cached hits, no
  Railway load).
- Rate limits keep working correctly because the app now reads
  `CF-Connecting-IP` for the real client IP (not the Cloudflare edge
  IP that would otherwise show up in `X-Forwarded-For`).
- Bot Fight Mode drops obvious scrapers before they hit Railway.
- Under a real spike, `/queue`, `/reports`, and all `/api/*` still
  go straight to Railway — but they only serve authenticated
  workspace owners, who are the small fraction of visitors that
  bother to sign up. That's fine.
