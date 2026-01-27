import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { deleteVersionsBulk, deleteVersionsMetadataBulk } from "@/lib/versionsStore";

export async function DELETE(request: Request) {
  const body = (await request.json()) as { ids?: number[]; metadataOnly?: boolean };
  const ids = body.ids ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "No version IDs provided" }, { status: 400 });
  }

  if (body.metadataOnly) {
    await deleteVersionsMetadataBulk(ids);
  } else {
    await deleteVersionsBulk(ids);
  }

  const actor = await getCurrentUser();
  await logAudit({
    actorEmail: actor?.email ?? null,
    action: body.metadataOnly ? "metadata.bulk.delete" : "version.bulk.delete",
    entityType: "version",
    details: { ids },
  });

  return NextResponse.json({ ok: true });
}
