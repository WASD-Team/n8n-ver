import { cookies } from "next/headers";
import { getUserProfileByEmail, listUsers, type AppUser, type UserProfile } from "@/lib/usersStore";

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const email = (await cookies()).get("vm_user")?.value;
    if (!email) return null;
    const users = await listUsers();
    return users.find((u) => u.email === email) ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const email = (await cookies()).get("vm_user")?.value;
    if (!email) return null;
    return await getUserProfileByEmail(email);
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
    const email = (await cookies()).get("vm_user")?.value;
    const user = users.find((u) => u.email === email);
    if (!user || user.role !== "Admin") {
      return { ok: false, error: "Admin role required" as const };
    }
    return { ok: true, reason: "authorized" as const };
  } catch {
    return { ok: true, reason: "db_not_configured" as const };
  }
}

