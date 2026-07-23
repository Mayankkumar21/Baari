// Sentry init for the edge runtime (middleware.ts, edge route
// handlers). Kept in lockstep with sentry.server.config — same
// sample rate, same scrubbing.
import * as Sentry from "@sentry/nextjs";
import { beforeSend, DENY_URLS, IGNORE_ERRORS } from "@/lib/sentry-shared";

Sentry.init({
  dsn: "https://ce1f11391b32cc4f899ddfbfb6c3d6ab@o4511786397204480.ingest.de.sentry.io/4511786406379600",

  tracesSampleRate: 0.1,
  environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || "development",
  sendDefaultPii: false,

  dataCollection: {
    httpBodies: [],
  },

  ignoreErrors: IGNORE_ERRORS,
  denyUrls: DENY_URLS,
  beforeSend,
});
