import { NextResponse } from "next/server";
import { requireAdmin, getCurrentUser } from "@/lib/auth";
import { getUserById } from "@/lib/usersStore";
import { createInviteToken } from "@/lib/inviteTokensStore";
import { logAudit } from "@/lib/auditStore";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });
  
  const { id } = await context.params;
  
  try {
    // Check if user exists
    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }
    
    // Only generate token for invited users
    if (user.status !== "Invited") {
      return NextResponse.json({ ok: false, error: "User is not in Invited status" }, { status: 400 });
    }
    
    // Generate invite token (expires in 72 hours)
    const token = await createInviteToken(user.id, user.email, 72);
    
    // Build the invite URL from request headers
    const headers = request.headers;
    const host = headers.get('host') || headers.get('x-forwarded-host');
    const protocol = headers.get('x-forwarded-proto') || 
                    (headers.get('host')?.includes('localhost') ? 'http' : 'https');
    const baseUrl = `${protocol}://${host}`;
    const inviteUrl = `${baseUrl}/login?token=${token}`;
    
    // Log audit
    const actor = await getCurrentUser();
    await logAudit({
      actorEmail: actor?.email ?? null,
      action: "user.invite.generate",
      entityType: "user",
      entityId: user.id,
      details: { userEmail: user.email },
    });
    
    return NextResponse.json({ 
      ok: true, 
      token,
      inviteUrl,
      expiresInHours: 72
    });
  } catch (err) {
    return NextResponse.json({ 
      ok: false, 
      error: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}
