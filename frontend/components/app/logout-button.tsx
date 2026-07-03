"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutConfirmDialog } from "@/components/app/logout-confirm-dialog";

// Header icon variant — used in the top nav. Opens a confirmation
// dialog instead of logging out immediately so an accidental click
// doesn't kick the receptionist off mid-queue-shift.
export function LogoutButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Sign out"
        onClick={() => setOpen(true)}
      >
        <LogOut className="size-4" />
      </Button>
      <LogoutConfirmDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
