"use client";

import { useEffect, useRef, useTransition } from "react";
import { LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/login/actions";

// Shared confirm-then-logout dialog. Rendered by both logout button
// variants (header icon + account-settings button) so the interaction
// stays identical across surfaces. Closes on ESC or backdrop click;
// primary "Sign out" is auto-focused so ⏎ confirms.
export function LogoutConfirmDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button once the dialog mounts so keyboard users
  // can press Enter immediately.
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  // Escape key closes (unless we're mid-submit — bailing during a
  // server action leaves the page in a weird spot).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the dialog is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, pending, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — clickable to close when not submitting. Rendered as
          a button so keyboard users can also dismiss with Enter/Space. */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={() => !pending && onClose()}
        disabled={pending}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="logout-dialog-title"
              className="text-base font-semibold text-foreground"
            >
              Sign out?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ll need to enter your mobile and password to sign back in.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel"
            onClick={onClose}
            disabled={pending}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              // Server action redirects on success; wrapping in
              // startTransition keeps the button in "pending" state
              // until the navigation actually happens.
              start(async () => {
                await logoutAction();
              });
            }}
          >
            <LogOut className="size-4" /> {pending ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </>
  );
}
