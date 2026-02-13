import { NextResponse } from "next/server";
import { getInviteToken, isInviteTokenValid } from "@/lib/inviteTokensStore";
import { getUserById } from "@/lib/usersStore";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim() ?? "";

    if (!token) {
      return NextResponse.json({ ok: false, error: "Token is required" }, { status: 400 });
    }

    // Check if token is valid
    const isValid = await isInviteTokenValid(token);
    if (!isValid) {
      return NextResponse.json({ 
        ok: false, 
        error: "Invalid or expired invitation link" 
      }, { status: 401 });
    }

    // Get token details
    const inviteToken = await getInviteToken(token);
    if (!inviteToken) {
      return NextResponse.json({ ok: false, error: "Token not found" }, { status: 404 });
    }

    // Get user details
    const user = await getUserById(inviteToken.userId);
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // Check if user is still in Invited status
    if (user.status !== "Invited") {
      return NextResponse.json({ 
        ok: false, 
        error: "This invitation is no longer valid" 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      ok: true, 
      userId: user.id,
      email: user.email,
      name: user.name,
      expiresAt: inviteToken.expiresAt
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
