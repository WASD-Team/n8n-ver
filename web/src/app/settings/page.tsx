import { AccessDeniedClient } from "@/components/AccessDeniedClient";
import { SettingsClient } from "@/components/SettingsClient";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settingsStore";
import type { AppUser } from "@/lib/usersStore";
import { listUsers } from "@/lib/usersStore";

export default async function SettingsPage() {
  const settings = await getSettings();

  let users: AppUser[] = [];
  let usersError: string | null = null;
  try {
    users = await listUsers();
  } catch (err) {
    usersError = err instanceof Error ? err.message : String(err);
  }

  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    const admins = users.filter((u) => u.role === "Admin").map((u) => u.email);
    return <AccessDeniedClient admins={admins} />;
  }

  return <SettingsClient initialSettings={settings} initialUsers={users} usersError={usersError} />;
}

