import { NextResponse } from "next/server";
import { withInstanceAccess } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { deleteVersionMetadata } from "@/lib/versionsStore";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await context.params;
  
  const result = await withInstanceAccess(async ({ instanceId, user }) => {
    await deleteVersionMetadata(Number(versionId));

    await logAudit({
      actorEmail: user.email,
      action: "metadata.delete",
      entityType: "version",
      entityId: versionId,
      instanceId,
    });

    return { ok: true };
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.result);
}
