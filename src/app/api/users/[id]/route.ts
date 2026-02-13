import { NextResponse } from "next/server";
import { getCurrentUser, requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { removeUser, updateUserRole, updateUserSuperAdmin, resetUserPassword, type UserRole } from "@/lib/usersStore";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });
  const { id } = await context.params;
  const body = (await request.json()) as { role?: UserRole; isSuperAdmin?: boolean; resetPassword?: boolean };

  // Handle password reset
  if (body.resetPassword) {
    try {
      await resetUserPassword(id);
      const actor = await getCurrentUser();
      await logAudit({
        actorEmail: actor?.email ?? null,
        action: "user.password.reset",
        entityType: "user",
        entityId: id,
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
    }
  }

  // Handle SuperAdmin status change - requires SuperAdmin permissions
  if (typeof body.isSuperAdmin === "boolean") {
    const superAdminCheck = await requireSuperAdmin();
    if (!superAdminCheck.ok) {
      return NextResponse.json({ ok: false, error: "Only SuperAdmin can change SuperAdmin status" }, { status: 403 });
    }
    
    try {
      await updateUserSuperAdmin({ id, isSuperAdmin: body.isSuperAdmin });
      const actor = await getCurrentUser();
      await logAudit({
        actorEmail: actor?.email ?? null,
        action: body.isSuperAdmin ? "user.superadmin.grant" : "user.superadmin.revoke",
        entityType: "user",
        entityId: id,
        details: { isSuperAdmin: body.isSuperAdmin },
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
    }
  }

  // Handle role change
  if (!body.role) {
    return NextResponse.json({ ok: false, error: "Role is required" }, { status: 400 });
  }

  try {
    await updateUserRole({ id, role: body.role });
    const actor = await getCurrentUser();
    await logAudit({
      actorEmail: actor?.email ?? null,
      action: "user.role.update",
      entityType: "user",
      entityId: id,
      details: { role: body.role },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });
  const { id } = await context.params;
  try {
    await removeUser(id);
    const actor = await getCurrentUser();
    await logAudit({
      actorEmail: actor?.email ?? null,
      action: "user.delete",
      entityType: "user",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

