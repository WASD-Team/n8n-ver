import { NextResponse } from "next/server";
import { getCurrentUser, getEffectiveInstanceId, requireInstanceAccess } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { deleteVersionsBulk, deleteVersionsMetadataBulk } from "@/lib/versionsStore";

export async function DELETE(request: Request) {
  const instanceId = await getEffectiveInstanceId();
  
  // Verify instance access
  if (instanceId) {
    const access = await requireInstanceAccess(instanceId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
    }
  }
  
  const body = (await request.json()) as { ids?: number[]; metadataOnly?: boolean };
  const ids = body.ids ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "No version IDs provided" }, { status: 400 });
  }

  if (body.metadataOnly) {
    await deleteVersionsMetadataBulk(ids, instanceId ?? undefined);
  } else {
    await deleteVersionsBulk(ids, instanceId ?? undefined);
  }

  const actor = await getCurrentUser();
  await logAudit({
    actorEmail: actor?.email ?? null,
    action: body.metadataOnly ? "metadata.bulk.delete" : "version.bulk.delete",
    entityType: "version",
    details: { ids },
    instanceId,
  });

  return NextResponse.json({ ok: true });
}
