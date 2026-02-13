import { AccessDeniedClient } from "@/components/AccessDeniedClient";
import { SettingsClient } from "@/components/SettingsClient";
import { getCurrentUser, getUserInstances, getEffectiveInstanceId, requireInstanceAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settingsStore";
import type { AppUser } from "@/lib/usersStore";
import { listUsers } from "@/lib/usersStore";

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  const currentInstanceId = await getEffectiveInstanceId();
  const settings = await getSettings(currentInstanceId ?? undefined);
  const instances = await getUserInstances();

  let users: AppUser[] = [];
  let usersError: string | null = null;
  try {
    users = await listUsers();
  } catch (err) {
    usersError = err instanceof Error ? err.message : String(err);
  }

  // Check if user is Admin in current instance (or SuperAdmin)
  if (currentInstanceId) {
    const adminCheck = await requireInstanceAdmin(currentInstanceId);
    if (!adminCheck.ok) {
      return <AccessDeniedClient />;
    }
  } else if (!currentUser?.isSuperAdmin) {
    // No instance selected and not SuperAdmin
    return <AccessDeniedClient />;
  }

  return (
    <SettingsClient
      initialSettings={settings}
      initialUsers={users}
      usersError={usersError}
      isSuperAdmin={currentUser?.isSuperAdmin ?? false}
      instances={instances}
      currentInstanceId={currentInstanceId}
    />
  );
}

