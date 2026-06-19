"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Check, Scissors, Stethoscope, Flower, PawPrint, Store } from "lucide-react";
import { Tooth } from "@/components/icons/tooth";
import { IndiaFlag } from "@/components/icons/india-flag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction, type SignupState } from "./actions";
import { cn } from "@/lib/utils";

type TenantKey = "clinic" | "dental" | "salon" | "spa" | "vet" | "other";

type TenantOption = {
  key: TenantKey;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  placeholder: string;
};

// Placeholder examples are deliberately specific — they read as a wink to the
// reader ("they thought about this") and they make the entry box less scary
// than a generic "Business name" hint.
const OPTIONS: TenantOption[] = [
  { key: "clinic", label: "Clinic", icon: Stethoscope, placeholder: "Dr. Sharma's Clinic" },
  { key: "dental", label: "Dental", icon: Tooth, placeholder: "Smile Dental Care" },
  { key: "salon", label: "Salon", icon: Scissors, placeholder: "Bella Salon" },
  { key: "spa", label: "Spa", icon: Flower, placeholder: "Tranquil Day Spa" },
  { key: "vet", label: "Vet", icon: PawPrint, placeholder: "Paws & Whiskers Vet" },
  { key: "other", label: "Other", icon: Store, placeholder: "My Business" },
];

// Same rules as lib/password.ts → passwordStrength(). Duplicated client-side so
// the live indicator doesn't require a roundtrip. Server still has final say.
type PasswordCheck = { key: string; label: string; ok: boolean };
function checkPassword(p: string): PasswordCheck[] {
  return [
    { key: "len", label: "8+ characters", ok: p.length >= 8 },
    { key: "letter", label: "Has a letter", ok: /[A-Za-z]/.test(p) },
    { key: "digit", label: "Has a number", ok: /\d/.test(p) },
  ];
}

export function SignupForm({ initialType }: { initialType?: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const [tenantType, setTenantType] = useState<TenantKey>(
    (OPTIONS.find((o) => o.key === initialType)?.key ?? "clinic") as TenantKey,
  );
  const [password, setPassword] = useState("");

  const selected = OPTIONS.find((o) => o.key === tenantType) ?? OPTIONS[0];
  const pwChecks = useMemo(() => checkPassword(password), [password]);
  const pwAllOk = pwChecks.every((c) => c.ok);

  return (
    <form action={action} className="space-y-5">
      {/* Honeypots */}
      <input type="text" name="website" autoComplete="off" tabIndex={-1} className="hidden" />
      <input type="text" name="company_name" autoComplete="off" tabIndex={-1} className="hidden" />

      <div>
        <Label className="mb-2 block">What kind of business?</Label>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTenantType(key)}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-all backdrop-blur",
                tenantType === key
                  ? "border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="size-5 text-primary" />
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="tenant_type" value={tenantType} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="business_name">Business name</Label>
        <Input
          id="business_name"
          name="business_name"
          required
          maxLength={120}
          // `organization` is the autocomplete token for a business name —
          // tells the browser this is the company, not an address or the
          // user's own name.
          autoComplete="organization"
          // Re-key when the tenant type changes so the browser drops any
          // stale autocomplete suggestion menu and re-evaluates the
          // placeholder.
          key={`name-${tenantType}`}
          placeholder={selected.placeholder}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="owner_name">Your name</Label>
          <Input
            id="owner_name"
            name="owner_name"
            required
            maxLength={80}
            autoComplete="name"
            placeholder="Your full name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mobile">Mobile</Label>
          <div className="relative">
            {/* z-10 lifts the prefix above the input's translucent backdrop
                so the tricolor + "+91" render crisply instead of through
                the frosted-glass overlay. */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center gap-1.5 pl-3 text-xs text-foreground">
              <IndiaFlag className="rounded-[1px]" />
              <span className="font-semibold">+91</span>
              <span className="h-3 w-px bg-border" />
            </div>
            <Input
              id="mobile"
              name="mobile"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              required
              autoComplete="tel-national"
              placeholder="98765 43210"
              className="pl-[68px]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Pick something memorable"
        />
        <div className="flex flex-wrap gap-3 pt-1 text-[11px]">
          {pwChecks.map((c) => (
            <span
              key={c.key}
              className={cn(
                "inline-flex items-center gap-1 transition-colors",
                c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              <Check
                className={cn("size-3", c.ok ? "opacity-100" : "opacity-30")}
              />
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {state.error ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            state.duplicate
              ? "border-primary/30 bg-primary/8 text-foreground"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {state.error}
          {state.duplicate ? (
            <>
              {" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in →
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      <Button
        type="submit"
        variant="glow"
        size="lg"
        className="w-full"
        disabled={pending || !pwAllOk}
      >
        {pending ? "Creating workspace…" : "Create workspace"}
      </Button>
    </form>
  );
}
