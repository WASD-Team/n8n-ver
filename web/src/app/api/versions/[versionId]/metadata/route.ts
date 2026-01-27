import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { deleteVersionMetadata } from "@/lib/versionsStore";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await context.params;
  await deleteVersionMetadata(Number(versionId));

  const actor = await getCurrentUser();
  await logAudit({
    actorEmail: actor?.email ?? null,
    action: "metadata.delete",
    entityType: "version",
    entityId: versionId,
  });

  return NextResponse.json({ ok: true });
}
