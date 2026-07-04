import { requireDoctor } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteWorkspaceForm } from "./delete-workspace-form";
import { EmailForm } from "./email-form";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const sess = await requireDoctor();
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="p-6 pb-3">
          <CardTitle>Recovery email</CardTitle>
          <p className="pt-1 text-xs text-muted-foreground">
            We'll email a 6-digit reset code here if you ever tap "Forgot
            password?" Without an email on file, you'll have to contact
            support to recover your account.
          </p>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <EmailForm currentEmail={sess.user.email ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6 pb-3">
          <CardTitle>Change password</CardTitle>
          <p className="pt-1 text-xs text-muted-foreground">
            You'll stay signed in on this device after changing it.
          </p>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6 pb-3">
          <CardTitle>Sign out</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <LogoutButton />
        </CardContent>
      </Card>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader className="p-6 pb-3">
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <p className="pt-1 text-xs text-muted-foreground">
            Permanently deletes the workspace, every booking, every customer
            record, and signs you out. There is no undo.
          </p>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <DeleteWorkspaceForm workspaceName={sess.clinic.name} />
        </CardContent>
      </Card>
    </div>
  );
}
