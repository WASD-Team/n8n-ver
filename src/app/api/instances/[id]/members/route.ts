import { NextResponse } from "next/server";
import { requireInstanceAdmin, requireSuperAdmin } from "@/lib/auth";
import {
  listInstanceMemberships,
  addMembership,
  updateMembershipRole,
  removeMembership,
} from "@/lib/instancesStore";
import { getUserById, listUsers } from "@/lib/usersStore";

// GET /api/instances/[id]/members - List instance members
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await context.params;
    
    const access = await requireInstanceAdmin(instanceId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
    }

    const memberships = await listInstanceMemberships(instanceId);
    
    // Enrich with user data
    const users = await listUsers();
    const userMap = new Map(users.map((u) => [u.id, u]));
    
    const members = memberships.map((m) => {
      const user = userMap.get(m.userId);
      return {
        ...m,
        name: user?.name ?? "Unknown",
        email: user?.email ?? "",
      };
    });

    return NextResponse.json({ ok: true, members });
  } catch (error) {
    console.error("Error listing members:", error);
    return NextResponse.json({ ok: false, error: "Failed to list members" }, { status: 500 });
  }
}

// POST /api/instances/[id]/members - Add member to instance
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await context.params;
    
    // Only SuperAdmin or Instance Admin can add members
    const access = await requireInstanceAdmin(instanceId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID is required" }, { status: 400 });
    }
    if (!role || !["Admin", "User"].includes(role)) {
      return NextResponse.json({ ok: false, error: "Valid role (Admin/User) is required" }, { status: 400 });
    }

    // Verify user exists
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const membership = await addMembership({
      userId,
      instanceId,
      role,
    });

    return NextResponse.json({ ok: true, membership });
  } catch (error) {
    console.error("Error adding member:", error);
    return NextResponse.json({ ok: false, error: "Failed to add member" }, { status: 500 });
  }
}

// PUT /api/instances/[id]/members - Update member role
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await context.params;
    
    const access = await requireInstanceAdmin(instanceId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID is required" }, { status: 400 });
    }
    if (!role || !["Admin", "User"].includes(role)) {
      return NextResponse.json({ ok: false, error: "Valid role (Admin/User) is required" }, { status: 400 });
    }

    const membership = await updateMembershipRole({
      userId,
      instanceId,
      role,
    });

    if (!membership) {
      return NextResponse.json({ ok: false, error: "Membership not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, membership });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json({ ok: false, error: "Failed to update member" }, { status: 500 });
  }
}

// DELETE /api/instances/[id]/members - Remove member from instance
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await context.params;
    
    const access = await requireInstanceAdmin(instanceId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID is required" }, { status: 400 });
    }

    await removeMembership(userId, instanceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ ok: false, error: "Failed to remove member" }, { status: 500 });
  }
}
