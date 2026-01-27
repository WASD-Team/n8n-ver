import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { deleteVersionById, getVersionById, updateVersionMetadata } from "@/lib/versionsStore";

export async function GET(
  _request: Request,
  context: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await context.params;
  const version = await getVersionById(Number(versionId));
  if (!version) return NextResponse.json({ ok: false, error: "Version not found" }, { status: 404 });
  return NextResponse.json({ ok: true, version });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await context.params;
  const body = (await request.json()) as {
    description?: string;
    comment?: string;
    tags?: string[];
  };

  await updateVersionMetadata({
    versionId: Number(versionId),
    description: body.description ?? "",
    comment: body.comment ?? "",
    tags: body.tags ?? [],
  });

  const actor = await getCurrentUser();
  await logAudit({
    actorEmail: actor?.email ?? null,
    action: "metadata.update",
    entityType: "version",
    entityId: versionId,
    details: {
      descriptionLength: (body.description ?? "").length,
      commentLength: (body.comment ?? "").length,
      tagsCount: body.tags?.length ?? 0,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await context.params;
  await deleteVersionById(Number(versionId));
  const actor = await getCurrentUser();
  await logAudit({
    actorEmail: actor?.email ?? null,
    action: "version.delete",
    entityType: "version",
    entityId: versionId,
  });
  return NextResponse.json({ ok: true });
}
