import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logAudit } from "@/lib/auditStore";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { getUserProfileByEmail, getUserWithPasswordByEmail, updateUserName, updateUserPasswordHash } from "@/lib/usersStore";

const MIN_PASSWORD_LENGTH = 8;

export async function GET() {
  const email = (await cookies()).get("vm_user")?.value;
  if (!email) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const profile = await getUserProfileByEmail(email);
  if (!profile) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  return NextResponse.json({ ok: true, profile });
}

export async function PATCH(request: Request) {
  const email = (await cookies()).get("vm_user")?.value;
  if (!email) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = (await request.json()) as {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  const user = await getUserWithPasswordByEmail(email);
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const updates: { name?: string; passwordUpdated?: boolean } = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ ok: false, error: "Display name is required" }, { status: 400 });
    }
    if (trimmed !== user.name) {
      await updateUserName({ id: user.id, name: trimmed });
      await logAudit({
        actorEmail: email,
        action: "user.name.update",
        entityType: "user",
        entityId: user.id,
        details: { name: trimmed },
      });
      updates.name = trimmed;
    }
  }

  if (typeof body.newPassword === "string" && body.newPassword.length > 0) {
    if (body.newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ ok: false, error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (body.confirmPassword && body.newPassword !== body.confirmPassword) {
      return NextResponse.json({ ok: false, error: "Passwords do not match" }, { status: 400 });
    }
    if (user.passwordHash) {
      if (!body.currentPassword) {
        return NextResponse.json({ ok: false, error: "Current password is required" }, { status: 400 });
      }
      const ok = await verifyPassword(body.currentPassword, user.passwordHash);
      if (!ok) {
        return NextResponse.json({ ok: false, error: "Current password is incorrect" }, { status: 400 });
      }
    }
    const nextHash = await hashPassword(body.newPassword);
    await updateUserPasswordHash({ id: user.id, passwordHash: nextHash });
    await logAudit({
      actorEmail: email,
      action: user.passwordHash ? "user.password.update" : "user.password.set",
      entityType: "user",
      entityId: user.id,
    });
    updates.passwordUpdated = true;
  }

  if (!updates.name && !updates.passwordUpdated) {
    return NextResponse.json({ ok: false, error: "No changes submitted" }, { status: 400 });
  }

  const profile = await getUserProfileByEmail(email);
  return NextResponse.json({ ok: true, updates, profile });
}
