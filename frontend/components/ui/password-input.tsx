"use client";

// Password field with two UX affordances:
//
// 1. **Eye toggle** — small icon at the right end that flips the field
//    between "password" and "text" so the owner can visually verify
//    what they typed. Standard pattern; most SaaS auth screens have it.
//
// 2. **Last-typed reveal** — for ~900ms after each keystroke the field
//    temporarily switches to `type="text"` so the character just typed
//    is visible. Mirrors iOS/Android's default password-field behavior
//    on desktop, where browsers otherwise mask everything immediately.
//    Cheap timer, no controlled-value juggling — password managers,
//    paste, and native autofill all keep working.
//
// Deliberately proxies every extra prop through to `<Input>` so
// this drops in wherever a plain password field lives today.

import { forwardRef, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const REVEAL_MS = 900;

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, onKeyDown, ...rest }, ref) {
    const [showAll, setShowAll] = useState(false);
    const [reveal, setReveal] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clean up any pending reveal timer on unmount so we don't drop
    // a setState onto a torn-down component.
    useEffect(() => {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(e);
      // Only reveal on printable single-character keys. Modifier keys,
      // arrows, Tab, Enter, etc. don't count as new typing.
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setReveal(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setReveal(false), REVEAL_MS);
      }
    };

    const inputType = showAll || reveal ? "text" : "password";

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={inputType}
          onKeyDown={handleKeyDown}
          // Reserve space on the right so long passwords don't slide
          // under the eye button.
          className={cn("pr-10", className)}
          {...rest}
        />
        <button
          type="button"
          aria-label={showAll ? "Hide password" : "Show password"}
          onClick={() => setShowAll((v) => !v)}
          // tabIndex=-1 so keyboard users tabbing through the form
          // don't get trapped on the toggle before they submit.
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {showAll ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>
      </div>
    );
  },
);
