// Sentry init for server-side requests (route handlers, server
// components, server actions). Runs in the Node.js runtime.
//
// Sample rates and PII scrubbing live here and in the client/edge
// twins — see lib/sentry-shared for the shared hardening.
import * as Sentry from "@sentry/nextjs";
import { beforeSend, DENY_URLS, IGNORE_ERRORS } from "@/lib/sentry-shared";

Sentry.init({
  dsn: "https://ce1f11391b32cc4f899ddfbfb6c3d6ab@o4511786397204480.ingest.de.sentry.io/4511786406379600",

  // 10% traces sampling — enough to spot p95/p99 problems without
  // burning the free tier. Bump when we're actually diagnosing perf.
  tracesSampleRate: 0.1,

  // Tag events with the environment so prod alerts don't mix with
  // preview/staging noise. RAILWAY_ENVIRONMENT is auto-set by Railway.
  environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || "development",

  // Don't attach IP addresses or session-user data to events.
  sendDefaultPii: false,

  dataCollection: {
    // Never ship the request body — Baari POSTs patient names +
    // mobiles constantly and one leaked crash could dump dozens
    // of records.
    httpBodies: [],
  },

  ignoreErrors: IGNORE_ERRORS,
  denyUrls: DENY_URLS,
  beforeSend,
});
