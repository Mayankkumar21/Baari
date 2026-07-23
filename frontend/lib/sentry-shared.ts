// Shared Sentry hardening applied to client/server/edge configs.
// Centralized because scrubbing rules MUST stay in sync across runtimes
// — a PII leak on one runtime is still a PII leak.
//
// Baari carries patient names + mobile numbers in nearly every request
// path. If we shipped a bare Sentry setup, one server crash on
// /queue could upload dozens of patient records to a third-party
// service. This module makes that path narrow.

import type { ErrorEvent, EventHint } from "@sentry/nextjs";

// Errors we never want to see in Sentry. Adding to this list is
// EXPLICIT throttling — the crash still happens, we just stop
// paying for the alert. Keep it short; each entry should be
// justified with a note.
export const IGNORE_ERRORS: (string | RegExp)[] = [
  // Benign browser-internal errors from third-party scripts / extensions.
  // ResizeObserver fires this on layout thrash; it's harmless and noisy.
  /ResizeObserver loop/i,
  // The user navigated away before a route transition completed. Not
  // a bug — routers fire this normally.
  "Non-Error promise rejection captured",
  /Loading chunk \d+ failed/i,
  // Browser extension / injected-script noise.
  /Extension context invalidated/i,
  /chrome-extension:\/\//,
  /moz-extension:\/\//,
];

// URLs to ignore reports FROM. Same shape as ignoreErrors but for the
// URL where the crash happened.
export const DENY_URLS: RegExp[] = [
  // The Sentry tunnel itself. If tunneling ever crashes we don't
  // want it re-reporting to itself and creating an infinite loop.
  /\/monitoring(\?|$)/,
  // Browser extensions.
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^safari-extension:\/\//,
];

// Redact 10-15 digit sequences (mobile numbers with or without +
// and country code). Baari stores everything as E.164 (+91...), and
// stack messages sometimes echo the input. Keep the last 4 digits
// visible so on-call can still correlate with a specific patient
// if the owner reports the incident by hand.
const MOBILE_RE = /(\+?\d{6,})(\d{4})/g;

function sanitizeString(s: string): string {
  return s.replace(MOBILE_RE, (_, prefix, last4) => "*".repeat(prefix.length) + last4);
}

// Recursively sanitize objects that Sentry ships in the crash payload.
// Bounded depth so a cyclic ref can't stall the beforeSend hook.
function sanitizeValue(v: unknown, depth = 0): unknown {
  if (depth > 6) return v;
  if (typeof v === "string") return sanitizeString(v);
  if (Array.isArray(v)) return v.map((x) => sanitizeValue(x, depth + 1));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      // Strip fields that carry raw PII by name. `mobile` is Baari's
      // canonical column name; `password` should never appear but
      // belt-and-braces.
      const lower = k.toLowerCase();
      if (
        lower === "mobile" ||
        lower === "phone" ||
        lower === "password" ||
        lower === "passwordhash" ||
        lower === "authorization" ||
        lower === "cookie" ||
        lower === "set-cookie" ||
        lower === "x-baari-session" ||
        lower.includes("token")
      ) {
        out[k] = "[Redacted]";
      } else {
        out[k] = sanitizeValue(val, depth + 1);
      }
    }
    return out;
  }
  return v;
}

export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // Drop everything from local dev — the wizard defaults would spam
  // the free tier every time we save a broken file with npm run dev.
  if (process.env.NODE_ENV !== "production") return null;

  // Strip cookies + auth headers from the request context. These
  // carry the session JWT which is enough to impersonate the user
  // if it lands in an attacker-readable place (support handoff,
  // exported CSV, screenshot in a Loom).
  if (event.request) {
    if (event.request.cookies) event.request.cookies = { redacted: "true" };
    if (event.request.headers) {
      const h = event.request.headers as Record<string, string>;
      for (const key of Object.keys(h)) {
        const k = key.toLowerCase();
        if (k === "cookie" || k === "authorization" || k === "x-baari-session") {
          h[key] = "[Redacted]";
        }
      }
    }
    // Strip URL query strings — they occasionally carry redirect
    // targets or search terms that could be a patient name.
    if (event.request.query_string) event.request.query_string = "[Redacted]";
    // Nuke request body. We opted out of body capture in config too,
    // but redundancy is cheap.
    if (event.request.data) event.request.data = "[Redacted]";
  }

  // Sanitize breadcrumb messages + user-provided data. Breadcrumbs
  // are the biggest PII surface — they collect every fetch URL and
  // console.log leading up to the crash.
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? sanitizeString(b.message) : b.message,
      data: b.data ? (sanitizeValue(b.data) as typeof b.data) : b.data,
    }));
  }

  // Sanitize exception messages themselves.
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = sanitizeString(ex.value);
    }
  }
  if (event.message) event.message = sanitizeString(event.message);

  // Drop the user object entirely. Sentry attaches IP + session-user
  // by default; neither is safe to third-party in a healthcare context.
  event.user = undefined;

  return event;
}
