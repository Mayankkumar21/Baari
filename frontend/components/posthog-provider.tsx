"use client";

// PostHog init + user identity. Client-only — PostHog's Node SDK is not
// used here because our surface is thin (only interactive dashboard
// pages need it) and doing everything from the browser gets session
// recording + autocapture for free.
//
// Identity contract:
//   - Signed-in owners identify as `owner:<user.id>` (namespaced so it
//     can't collide with the customer app's `customer:<id>`).
//   - Signed-out visitors are anonymous — PostHog assigns its own UUID
//     which we merge into the identified profile on next login.

import { useEffect } from "react";
import posthog from "posthog-js";

type Props = {
  identity: {
    userId: number;
    clinicId: number;
    role: string;
    name: string;
    mobile: string;
  } | null;
  children: React.ReactNode;
};

let initialized = false;
function ensureInit() {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return;
  posthog.init(key, {
    api_host: host,
    // EU cloud handles GDPR/DPDP scope for us. Owner + customer PII
    // stays in-region.
    capture_pageview: true,
    // Pair with pageleave so PostHog can calculate accurate bounce
    // rate and session duration. Without pageleave, sessions look
    // artificially short.
    capture_pageleave: true,
    autocapture: true,
    // Session recordings are ON per pilot decision. When we onboard
    // real customers in the app we'll switch input masking on for the
    // customer side; the dashboard is operator-only so no PII risk.
    session_recording: {
      maskAllInputs: false,
    },
    persistence: "localStorage+cookie",
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        // Dev flag prevents recordings from local coding sessions
        // showing up in the pilot recordings dashboard.
        ph.opt_out_capturing();
      }
    },
  });
  initialized = true;
}

export function PostHogProvider({ identity, children }: Props) {
  useEffect(() => {
    ensureInit();
    if (!initialized) return;
    if (!identity) {
      // If the caller was previously identified and is now signed out,
      // reset so the next signed-in user gets a fresh anonymous → alias
      // merge instead of being tangled with the previous identity.
      posthog.reset();
      return;
    }
    posthog.identify(`owner:${identity.userId}`, {
      role: identity.role,
      name: identity.name,
      mobile: identity.mobile,
      clinic_id: identity.clinicId,
    });
    posthog.group("workspace", `clinic:${identity.clinicId}`);
  }, [
    identity?.userId,
    identity?.clinicId,
    identity?.role,
    identity?.name,
    identity?.mobile,
  ]);

  return <>{children}</>;
}

// Convenience for one-off event captures anywhere in the client tree.
// Silent no-op if PostHog isn't initialized (dev without env, opt-out,
// etc). Use over posthog.capture() directly so consumers don't need
// to import from posthog-js and worry about init order.
export function capture(event: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, props);
}
