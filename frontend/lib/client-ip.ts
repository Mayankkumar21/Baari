// Real client IP extraction.
//
// Order of trust:
//   1. CF-Connecting-IP  — Cloudflare's authoritative real-IP. Set on
//      every request that came through the Cloudflare proxy;
//      unspoofable when traffic is forced through Cloudflare (i.e.
//      Railway origin is restricted to Cloudflare IPs at the edge).
//   2. X-Forwarded-For (leftmost) — Railway/generic proxy hint. Can
//      be spoofed by a direct hit that bypasses Cloudflare, but that's
//      a Railway-network-level concern not fixable in app code.
//   3. X-Real-IP — some proxies use this.
//   4. Fallback "0.0.0.0" — keeps the rate-limit key stable rather
//      than throwing when no header is present (local dev).
//
// Callers previously read x-forwarded-for directly with .split(",")[0].
// That still works for the leftmost-IP case, but doesn't prefer the
// Cloudflare header when both are present.

export function getClientIp(req: Request): string;
export function getClientIp(headers: Headers): string;
export function getClientIp(input: Request | Headers): string {
  const h = "headers" in input ? input.headers : input;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}
