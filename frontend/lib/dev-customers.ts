// Pre-defined dev/test customer identities for the mock-auth path.
//
// The Replit/Expo stub picks one of these IDs and sends `mock:<id>`
// (or hits /api/v1/auth/dev directly). The backend resolves the ID to
// a stable email/name/mobile triple so multiple sign-ins from the
// stub map to the SAME customer row in the DB (the way Google sign-in
// would), instead of creating duplicates on every tap.
//
// Three personas chosen to exercise different code paths:
//   anjali — fresh customer, no mobile (forces the S2 onboard flow)
//   rohan  — returning customer with mobile (skips onboard, goes
//            straight to Discover, can book immediately)
//   priya  — returning customer with Devanagari name (exercises
//            Hindi font fallback)
//
// These are GLOBAL — multiple devs/testers signing in as the same ID
// share the same customer row. That's fine for a pilot but worth
// flagging when you eventually flip DEV_AUTH_ENABLED off.

export type DevCustomerId = "anjali" | "rohan" | "priya";

export type DevCustomerProfile = {
  googleId: string;
  email: string;
  name: string;
  mobile: string | null;
  photoUrl: string | null;
};

export const DEV_CUSTOMERS: Record<DevCustomerId, DevCustomerProfile> = {
  anjali: {
    googleId: "mock:anjali",
    email: "anjali@example.com",
    name: "Anjali Verma",
    mobile: null, // forces the onboard-mobile screen
    photoUrl: null,
  },
  rohan: {
    googleId: "mock:rohan",
    email: "rohan@example.com",
    name: "Rohan Kumar",
    mobile: "9876543210", // can book immediately
    photoUrl: null,
  },
  priya: {
    googleId: "mock:priya",
    email: "priya@example.com",
    name: "प्रिया सिंह", // Devanagari — exercises Hindi font + language inference
    mobile: "9123456789",
    photoUrl: null,
  },
};

export function resolveDevCustomer(id: string): DevCustomerProfile | null {
  if (id in DEV_CUSTOMERS) {
    return DEV_CUSTOMERS[id as DevCustomerId];
  }
  return null;
}

export function devAuthEnabled(): boolean {
  return process.env.DEV_AUTH_ENABLED === "true";
}
