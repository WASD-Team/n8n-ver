import { NextResponse } from "next/server";
import { requireSuperAdmin, getCurrentUser, requireInstanceAccess } from "@/lib/auth";
import {
  listInstances,
  createInstance,
  addMembership,
  listUserInstances,
} from "@/lib/instancesStore";

// GET /api/instances - List instances (SuperAdmin sees all, others see their own)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    if (user.isSuperAdmin) {
      const instances = await listInstances();
      return NextResponse.json({ ok: true, instances });
    }

    const instances = await listUserInstances(user.id);
    return NextResponse.json({ ok: true, instances });
  } catch (error) {
    console.error("Error listing instances:", error);
    return NextResponse.json({ ok: false, error: "Failed to list instances" }, { status: 500 });
  }
}

// POST /api/instances - Create new instance (SuperAdmin only)
export async function POST(request: Request) {
  try {
    const superAdminCheck = await requireSuperAdmin();
    if (!superAdminCheck.ok) {
      return NextResponse.json({ ok: false, error: superAdminCheck.error }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, adminUserId } = body;

    if (!name?.trim()) {
      return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    }
    if (!slug?.trim()) {
      return NextResponse.json({ ok: false, error: "Slug is required" }, { status: 400 });
    }

    // Validate slug format and length
    const trimmedSlug = slug.trim().toLowerCase();
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(trimmedSlug)) {
      return NextResponse.json(
        { ok: false, error: "Slug can only contain lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }
    if (trimmedSlug.length < 3 || trimmedSlug.length > 50) {
      return NextResponse.json(
        { ok: false, error: "Slug must be between 3 and 50 characters" },
        { status: 400 }
      );
    }

    const instance = await createInstance({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      createdBy: superAdminCheck.user.id,
    });

    // If adminUserId provided, add them as Admin of the instance
    if (adminUserId) {
      await addMembership({
        userId: adminUserId,
        instanceId: instance.id,
        role: "Admin",
      });
    }

    return NextResponse.json({ ok: true, instance });
  } catch (error: any) {
    console.error("Error creating instance:", error);
    
    // Handle unique constraint violation
    if (error?.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "An instance with this slug already exists" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ ok: false, error: "Failed to create instance" }, { status: 500 });
  }
}
