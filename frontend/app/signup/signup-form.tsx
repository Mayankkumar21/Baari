"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Check, Scissors, Stethoscope, Flower, PawPrint, Store } from "lucide-react";
import { Tooth } from "@/components/icons/tooth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  CountryCodePicker,
  useCountry,
} from "@/components/country-code-picker";
import { signupAction, type SignupState } from "./actions";
import { cn } from "@/lib/utils";

type TenantKey = "clinic" | "dental" | "salon" | "spa" | "vet" | "other";

type TenantOption = {
  key: TenantKey;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  placeholder: string;
};

// The two verticals we're actively marketing to today. Everything
// else lives under "Other" so the picker doesn't feel like a
// take-anything catalogue — clinic and salon owners see themselves,
// the rest still have a path through.
//
// Placeholder examples are deliberately specific — they read as a
// wink to the reader ("they thought about this") and make the entry
// box less scary than a generic "Business name" hint.
const PRIMARY_OPTIONS: TenantOption[] = [
  { key: "clinic", label: "Clinic", icon: Stethoscope, placeholder: "Dr. Sharma's Clinic" },
  { key: "salon", label: "Salon", icon: Scissors, placeholder: "Bella Salon" },
];

// The "Other" catch-all. When the user clicks Other, we reveal the
// four secondary options so they can be more specific. Baari treats
// each as a distinct tenant type internally (vocab, service catalog,
// slot defaults) — the UI just doesn't put them front and centre.
const OTHER_OPTIONS: TenantOption[] = [
  { key: "dental", label: "Dental", icon: Tooth, placeholder: "Smile Dental Care" },
  { key: "spa", label: "Spa", icon: Flower, placeholder: "Tranquil Day Spa" },
  { key: "vet", label: "Vet", icon: PawPrint, placeholder: "Paws & Whiskers Vet" },
  { key: "other", label: "Other", icon: Store, placeholder: "My Business" },
];

const OPTIONS: TenantOption[] = [...PRIMARY_OPTIONS, ...OTHER_OPTIONS];

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

  // SSR → India (deterministic), client swaps to browser-detected on
  // mount. Signup: this determines the E.164 country code the account
  // is created with, so getting it wrong for non-Indian owners means
  // they can never log in with their real number.
  const [country, setCountry] = useCountry();
  const [national, setNational] = useState("");

  return (
    <form action={action} className="space-y-5">
      {/* Honeypots */}
      <input type="text" name="website" autoComplete="off" tabIndex={-1} className="hidden" />
      <input type="text" name="company_name" autoComplete="off" tabIndex={-1} className="hidden" />

      <div>
        <Label className="mb-2 block">What kind of business?</Label>
        <TenantPicker
          value={tenantType}
          onChange={setTenantType}
        />
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
          <Label htmlFor="mobile-national">Mobile</Label>
          <div className="flex gap-2">
            <CountryCodePicker value={country} onChange={setCountry} />
            <Input
              id="mobile-national"
              type="tel"
              inputMode="numeric"
              maxLength={15}
              required
              autoComplete="tel-national"
              placeholder="Your mobile number"
              value={national}
              onChange={(e) =>
                setNational(e.target.value.replace(/[^\d\s\-().]/g, "").slice(0, 15))
              }
              className="flex-1"
            />
          </div>
          {/* Hidden E.164 field — the server action reads this. */}
          <input
            type="hidden"
            name="mobile"
            value={national ? `+${country.dial}${national.replace(/\D/g, "")}` : ""}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Recovery email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <p className="text-[11px] text-muted-foreground pt-1">
          Used if you tap &quot;Forgot password?&quot; later. You can verify it
          from Settings after signup.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
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

// Tenant type picker with two rows:
//   Row 1: Clinic · Salon · Other (the two verticals we lead with)
//   Row 2: If Other is active OR the visitor arrived with a non-
//          primary type in the URL, show Dental · Spa · Vet · Generic
//          so they can be specific. Baari treats each secondary key
//          as a distinct tenant type internally.
function TenantPicker({
  value,
  onChange,
}: {
  value: TenantKey;
  onChange: (k: TenantKey) => void;
}) {
  const isPrimary = value === "clinic" || value === "salon";
  // Show the secondary row whenever the current selection isn't a
  // primary key. Also stays visible until the user picks a primary
  // again, so they can browse.
  const [showOther, setShowOther] = useState(!isPrimary);

  const handlePrimary = (k: TenantKey) => {
    onChange(k);
    setShowOther(false);
  };
  const handleOtherToggle = () => {
    setShowOther(true);
    // If they were on a primary tile, don't jump their selection —
    // just reveal the sub-row and let them pick. If nothing in the
    // sub-row was previously chosen, default to the generic "other".
    if (isPrimary) onChange("other");
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {PRIMARY_OPTIONS.map(({ key, label, icon: Icon }) => (
          <TenantTile
            key={key}
            label={label}
            icon={Icon}
            active={value === key}
            onClick={() => handlePrimary(key)}
          />
        ))}
        <TenantTile
          label="Other"
          icon={Store}
          // "Other" reads as active when either the tile has been
          // clicked (showOther) OR the current selection is one of
          // the non-primary keys.
          active={showOther || !isPrimary}
          onClick={handleOtherToggle}
        />
      </div>
      {showOther ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-foreground/70">
            Which kind?
          </div>
          <div className="grid grid-cols-4 gap-2">
            {OTHER_OPTIONS.map(({ key, label, icon: Icon }) => (
              <TenantTile
                key={key}
                label={label}
                icon={Icon}
                active={value === key}
                onClick={() => onChange(key)}
                compact
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TenantTile({
  label,
  icon: Icon,
  active,
  onClick,
  compact = false,
}: {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-lg border text-xs font-medium transition-all backdrop-blur",
        compact ? "p-2" : "p-3",
        active
          ? "border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <Icon className={cn("text-primary", compact ? "size-4" : "size-5")} />
      {label}
    </button>
  );
}
