import { NextResponse } from "next/server";
import { logAudit } from "@/lib/auditStore";
import { hashPassword } from "@/lib/passwords";
import { createUserWithPassword, listUsers } from "@/lib/usersStore";

const AUTH_COOKIE = "vm_user";
const MIN_PASSWORD_LENGTH = 8;

export async function GET() {
  try {
    const users = await listUsers();
    return NextResponse.json({ ok: true, needsBootstrap: users.length === 0 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ ok: false, error: "Password is required" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    if (body.confirmPassword && body.confirmPassword !== password) {
      return NextResponse.json({ ok: false, error: "Passwords do not match" }, { status: 400 });
    }

    const users = await listUsers();
    if (users.length > 0) {
      return NextResponse.json({ ok: false, error: "Admin already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUserWithPassword({
      name,
      email,
      role: "Admin",
      status: "Active",
      passwordHash,
    });
    await logAudit({
      actorEmail: email,
      action: "user.bootstrap",
      entityType: "user",
      entityId: user.id,
      details: { email: user.email, role: user.role },
    });

    const response = NextResponse.json({ ok: true, user });
    response.cookies.set(AUTH_COOKIE, email, { httpOnly: true, sameSite: "lax", path: "/" });
    return response;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
