import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getInstanceById, getMembership } from "@/lib/instancesStore";

const INSTANCE_COOKIE = "vm_instance";

// POST /api/instances/switch - Switch to a different instance
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { instanceId } = body;

    if (!instanceId) {
      return NextResponse.json({ ok: false, error: "Instance ID is required" }, { status: 400 });
    }

    // Verify instance exists
    const instance = await getInstanceById(instanceId);
    if (!instance) {
      return NextResponse.json({ ok: false, error: "Instance not found" }, { status: 404 });
    }

    // Verify user has access to this instance (unless SuperAdmin)
    if (!user.isSuperAdmin) {
      const membership = await getMembership(user.id, instanceId);
      if (!membership) {
        return NextResponse.json({ ok: false, error: "No access to this instance" }, { status: 403 });
      }
    }

    // Set the instance cookie
    const cookieStore = await cookies();
    cookieStore.set(INSTANCE_COOKIE, instanceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.json({ ok: true, instanceId });
  } catch (error) {
    console.error("Error switching instance:", error);
    return NextResponse.json({ ok: false, error: "Failed to switch instance" }, { status: 500 });
  }
}
