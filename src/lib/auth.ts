import { cookies } from "next/headers";
import { getUserProfileByEmail, listUsers, type AppUser, type UserProfile, getUserByEmail } from "@/lib/usersStore";
import { getMembership, listUserInstances, type InstanceWithRole } from "@/lib/instancesStore";

const USER_COOKIE = "vm_user";
const INSTANCE_COOKIE = "vm_instance";

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const email = (await cookies()).get(USER_COOKIE)?.value;
    if (!email) return null;
    return await getUserByEmail(email);
  } catch {
    return null;
  }
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const email = (await cookies()).get(USER_COOKIE)?.value;
    if (!email) return null;
    return await getUserProfileByEmail(email);
  } catch {
    return null;
  }
}

export async function getCurrentInstanceId(): Promise<string | null> {
  try {
    return (await cookies()).get(INSTANCE_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  try {
    const users = await listUsers();
    if (users.length === 0) {
      return { ok: true, reason: "bootstrap" as const };
    }
    const email = (await cookies()).get(USER_COOKIE)?.value;
    const user = users.find((u) => u.email === email);
    if (!user || user.role !== "Admin") {
      return { ok: false, error: "Admin role required" as const };
    }
    return { ok: true, reason: "authorized" as const };
  } catch {
    return { ok: true, reason: "db_not_configured" as const };
  }
}

export async function requireSuperAdmin(): Promise<{ ok: true; user: AppUser } | { ok: false; error: string }> {
  try {
    const users = await listUsers();
    if (users.length === 0) {
      return { ok: false, error: "No users configured" };
    }
    const email = (await cookies()).get(USER_COOKIE)?.value;
    const user = users.find((u) => u.email === email);
    if (!user) {
      return { ok: false, error: "Not authenticated" };
    }
    if (!user.isSuperAdmin) {
      return { ok: false, error: "SuperAdmin role required" };
    }
    return { ok: true, user };
  } catch {
    return { ok: false, error: "Database error" };
  }
}

export async function requireInstanceAccess(instanceId: string): Promise<
  | { ok: true; user: AppUser; role: "Admin" | "User" | "SuperAdmin" }
  | { ok: false; error: string }
> {
  try {
    const email = (await cookies()).get(USER_COOKIE)?.value;
    if (!email) {
      return { ok: false, error: "Not authenticated" };
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return { ok: false, error: "User not found" };
    }

    // SuperAdmin has access to all instances
    if (user.isSuperAdmin) {
      return { ok: true, user, role: "SuperAdmin" };
    }

    // Check membership
    const membership = await getMembership(user.id, instanceId);
    if (!membership) {
      return { ok: false, error: "No access to this instance" };
    }

    return { ok: true, user, role: membership.role };
  } catch {
    return { ok: false, error: "Database error" };
  }
}

export async function requireInstanceAdmin(instanceId: string): Promise<
  | { ok: true; user: AppUser }
  | { ok: false; error: string }
> {
  const access = await requireInstanceAccess(instanceId);
  if (!access.ok) return access;
  
  if (access.role !== "Admin" && access.role !== "SuperAdmin") {
    return { ok: false, error: "Instance Admin role required" };
  }

  return { ok: true, user: access.user };
}

export async function getUserInstances(): Promise<InstanceWithRole[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  
  // SuperAdmin sees all instances
  if (user.isSuperAdmin) {
    const { listInstances } = await import("@/lib/instancesStore");
    const instances = await listInstances();
    return instances.map((i) => ({ ...i, role: "Admin" as const }));
  }

  return listUserInstances(user.id);
}

export async function getEffectiveInstanceId(): Promise<string | null> {
  const instanceId = await getCurrentInstanceId();
  if (instanceId) return instanceId;  // If no instance selected, try to get the first available
  const instances = await getUserInstances();
  return instances[0]?.id ?? null;
}

// Wrapper function to reduce code duplication in API routes
export async function withInstanceAccess<T>(
  handler: (params: { instanceId: string | null; user: AppUser; role: "Admin" | "User" | "SuperAdmin" }) => Promise<T>
): Promise<
  | { ok: true; result: T }
  | { ok: false; error: string; status: number }
> {
  try {
    const instanceId = await getEffectiveInstanceId();
    
    if (instanceId) {
      const access = await requireInstanceAccess(instanceId);
      if (!access.ok) {
        return { ok: false, error: access.error, status: 403 };
      }
      const result = await handler({ instanceId, user: access.user, role: access.role });
      return { ok: true, result };
    }
    
    // No instance - check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return { ok: false, error: "Not authenticated", status: 401 };
    }
    
    const result = await handler({ instanceId: null, user, role: user.isSuperAdmin ? "SuperAdmin" : "User" });
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Internal error", status: 500 };
  }
}