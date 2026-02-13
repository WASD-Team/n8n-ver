import { NextResponse } from "next/server";
import { requireSuperAdmin, requireInstanceAdmin } from "@/lib/auth";
import {
  getInstanceById,
  updateInstance,
  deleteInstance,
} from "@/lib/instancesStore";

// GET /api/instances/[id] - Get instance details
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    const access = await requireInstanceAdmin(id);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
    }

    const instance = await getInstanceById(id);
    if (!instance) {
      return NextResponse.json({ ok: false, error: "Instance not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, instance });
  } catch (error) {
    console.error("Error getting instance:", error);
    return NextResponse.json({ ok: false, error: "Failed to get instance" }, { status: 500 });
  }
}

// PUT /api/instances/[id] - Update instance (SuperAdmin only)
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    const superAdminCheck = await requireSuperAdmin();
    if (!superAdminCheck.ok) {
      return NextResponse.json({ ok: false, error: superAdminCheck.error }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug } = body;

    // Validate slug format if provided
    if (slug) {
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(slug.trim().toLowerCase())) {
        return NextResponse.json(
          { ok: false, error: "Slug can only contain lowercase letters, numbers, and hyphens" },
          { status: 400 }
        );
      }
    }

    const instance = await updateInstance({
      id,
      name: name?.trim(),
      slug: slug?.trim().toLowerCase(),
    });

    if (!instance) {
      return NextResponse.json({ ok: false, error: "Instance not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, instance });
  } catch (error: any) {
    console.error("Error updating instance:", error);
    
    if (error?.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "An instance with this slug already exists" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ ok: false, error: "Failed to update instance" }, { status: 500 });
  }
}

// DELETE /api/instances/[id] - Delete instance (SuperAdmin only)
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    const superAdminCheck = await requireSuperAdmin();
    if (!superAdminCheck.ok) {
      return NextResponse.json({ ok: false, error: superAdminCheck.error }, { status: 403 });
    }

    // Prevent deletion of default instance
    if (id === "default") {
      return NextResponse.json(
        { ok: false, error: "Cannot delete the default instance" },
        { status: 400 }
      );
    }

    await deleteInstance(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting instance:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete instance" }, { status: 500 });
  }
}
