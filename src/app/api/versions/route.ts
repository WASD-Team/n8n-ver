import { NextResponse } from "next/server";
import { getCurrentUser, getEffectiveInstanceId, requireInstanceAccess } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { createManualVersion } from "@/lib/versionsStore";

type CreateVersionBody = {
  workflowId?: string;
  workflowName?: string;
  workflowJson?: string;
  versionUuid?: string;
};

export async function POST(request: Request) {
  try {
    const instanceId = await getEffectiveInstanceId();
    
    // Verify instance access
    if (instanceId) {
      const access = await requireInstanceAccess(instanceId);
      if (!access.ok) {
        return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
      }
    }
    
    let body: CreateVersionBody = {};
    try {
      body = (await request.json()) as CreateVersionBody;
    } catch {
      body = {};
    }

    const workflowId = body.workflowId?.trim() ?? "";
    const workflowName = body.workflowName?.trim() ?? "";
    const workflowJson = body.workflowJson?.trim() ?? "";
    const versionUuid = body.versionUuid?.trim() ?? "";

    if (!workflowId || !workflowName || !workflowJson) {
      return NextResponse.json(
        { ok: false, error: "workflowId, workflowName, and workflowJson are required." },
        { status: 400 },
      );
    }

    let normalizedJson: string;
    try {
      normalizedJson = JSON.stringify(JSON.parse(workflowJson));
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "Invalid JSON" },
        { status: 400 },
      );
    }

    const version = await createManualVersion({
      workflowId,
      workflowName,
      workflowJson: normalizedJson,
      versionUuid: versionUuid || undefined,
      instanceId: instanceId ?? undefined,
    });

    const actor = await getCurrentUser();
    await logAudit({
      actorEmail: actor?.email ?? null,
      action: "version.manual.create",
      entityType: "version",
      entityId: version.id,
      details: {
        workflowId,
        workflowName,
        versionUuid: version.w_version,
      },
      instanceId,
    });

    return NextResponse.json({ ok: true, version });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
