"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutConfirmDialog } from "@/components/app/logout-confirm-dialog";

// Full labelled variant — used on the Account settings page. Same
// confirmation dialog as the header icon so the interaction is
// identical regardless of where you click Sign out.
export function LogoutButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <LogOut className="size-4" /> Sign out
      </Button>
      <LogoutConfirmDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
