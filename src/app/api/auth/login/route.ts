import { NextResponse } from "next/server";
import { getUserWithPasswordByEmail } from "@/lib/usersStore";
import { verifyPassword } from "@/lib/passwords";

const AUTH_COOKIE = "vm_user";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
    }

    const user = await getUserWithPasswordByEmail(email);
    
    // User not found
    if (!user) {
      return NextResponse.json({ ok: false, error: "Invalid login or password" }, { status: 401 });
    }

    // User exists but has no password set - prompt to set password
    if (!user.passwordHash) {
      return NextResponse.json({ 
        ok: false, 
        needsPassword: true, 
        email: user.email,
        userName: user.name,
        error: "Password not set" 
      }, { status: 200 });
    }

    // Password required for users with password set
    if (!password) {
      return NextResponse.json({ ok: false, error: "Password is required" }, { status: 400 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid login or password" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE, email, { httpOnly: true, sameSite: "lax", path: "/" });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
