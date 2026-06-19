import { redirect } from "next/navigation";

export default function SettingsIndex() {
  // The shared layout already requires doctor; this just defaults the URL.
  redirect("/settings/workspace");
}
