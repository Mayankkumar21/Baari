"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteWorkspace, type DeleteState } from "../actions";

export function DeleteWorkspaceForm({ workspaceName }: { workspaceName: string }) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteWorkspace, {});
  const [confirmValue, setConfirmValue] = useState("");
  const ready = confirmValue.trim() === workspaceName;

  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="confirm_name" className="mb-1.5 block">
          Type <span className="font-semibold text-foreground">{workspaceName}</span> to confirm
        </Label>
        <Input
          id="confirm_name"
          name="confirm_name"
          value={confirmValue}
          onChange={(e) => setConfirmValue(e.target.value)}
          placeholder={workspaceName}
        />
      </div>
      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}
      <Button type="submit" variant="destructive" disabled={!ready || pending}>
        <Trash2 className="size-4" />{" "}
        {pending ? "Deleting…" : "Delete workspace permanently"}
      </Button>
    </form>
  );
}
