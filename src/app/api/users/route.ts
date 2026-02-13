import { NextResponse } from "next/server";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { createUser, listUsers, type UserRole } from "@/lib/usersStore";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });
  try {
    const users = await listUsers();
    return NextResponse.json(users);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });
  const body = (await request.json()) as {
    name: string;
    email: string;
    role: UserRole;
  };

  if (!body.name || !body.email || !body.role) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  try {
    const user = await createUser({ name: body.name, email: body.email, role: body.role, status: "Invited" });
    const actor = await getCurrentUser();
    await logAudit({
      actorEmail: actor?.email ?? null,
      action: "user.create",
      entityType: "user",
      entityId: user.id,
      details: { email: user.email, role: user.role },
    });
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

