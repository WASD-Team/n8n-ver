import { NextResponse } from "next/server";
import { getUserWithPasswordByEmail, updateUserPasswordHash, getUserById } from "@/lib/usersStore";
import { hashPassword } from "@/lib/passwords";
import { getInviteToken, isInviteTokenValid, markInviteTokenAsUsed } from "@/lib/inviteTokensStore";

const AUTH_COOKIE = "vm_user";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { 
      email?: string; 
      password?: string; 
      confirmPassword?: string;
      token?: string;
    };
    
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";
    const confirmPassword = body.confirmPassword ?? "";
    const token = body.token?.trim() ?? "";

    if (!password) {
      return NextResponse.json({ ok: false, error: "Password is required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Password must be at least 6 characters" }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ ok: false, error: "Passwords do not match" }, { status: 400 });
    }

    let user;
    
    // If token is provided, validate it and get user from token
    if (token) {
      const isValid = await isInviteTokenValid(token);
      if (!isValid) {
        return NextResponse.json({ ok: false, error: "Invalid or expired invitation link" }, { status: 401 });
      }
      
      const inviteToken = await getInviteToken(token);
      if (!inviteToken) {
        return NextResponse.json({ ok: false, error: "Token not found" }, { status: 404 });
      }
      
      const tokenUser = await getUserById(inviteToken.userId);
      if (!tokenUser) {
        return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      }
      
      user = await getUserWithPasswordByEmail(tokenUser.email);
      
      // Mark token as used
      await markInviteTokenAsUsed(token);
    } else {
      // Legacy flow: use email
      if (!email) {
        return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
      }
      
      user = await getUserWithPasswordByEmail(email);
    }
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // Only allow setting password if user doesn't have one
    if (user.passwordHash) {
      return NextResponse.json({ ok: false, error: "Password already set" }, { status: 400 });
    }

    // Hash and save password
    const passwordHash = await hashPassword(password);
    await updateUserPasswordHash({ id: user.id, passwordHash });

    // Auto-login after setting password
    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE, user.email, { httpOnly: true, sameSite: "lax", path: "/" });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
