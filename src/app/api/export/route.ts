import { NextResponse } from "next/server";
import { getCurrentUser, getEffectiveInstanceId, requireInstanceAccess } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import {
  listVersionsByIds,
  listVersionsByWorkflowForExport,
  type VersionRow,
} from "@/lib/versionsStore";

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: VersionRow[]) {
  const header = [
    "id",
    "w_name",
    "w_updatedAt",
    "w_json",
    "w_id",
    "w_version",
    "createdAt",
    "updatedAt",
    "description",
    "comment",
    "tags",
  ];

  const lines = rows.map((r) =>
    [
      r.id,
      r.w_name,
      r.w_updatedAt,
      r.w_json,
      r.w_id,
      r.w_version,
      r.createdAt,
      r.updatedAt,
      r.description ?? "",
      r.comment ?? "",
      r.tags ? JSON.stringify(r.tags) : "",
    ].map(csvEscape).join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export async function GET(request: Request) {
  const instanceId = await getEffectiveInstanceId();
  
  // Verify instance access
  if (instanceId) {
    const access = await requireInstanceAccess(instanceId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
    }
  }
  
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "json").toLowerCase();
  const idsRaw = searchParams.get("ids");
  const workflowId = searchParams.get("workflowId");

  let rows: VersionRow[] = [];
  if (idsRaw) {
    const ids = idsRaw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v));
    rows = await listVersionsByIds(ids, instanceId ?? undefined);
  } else if (workflowId) {
    rows = await listVersionsByWorkflowForExport(workflowId, instanceId ?? undefined);
  }

  const actor = await getCurrentUser();
  await logAudit({
    actorEmail: actor?.email ?? null,
    action: "export",
    entityType: "version",
    details: { count: rows.length, workflowId: workflowId ?? null },
    instanceId,
  });

  if (format === "csv") {
    const csv = toCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=\"versions.csv\"",
      },
    });
  }

  return NextResponse.json({ ok: true, rows });
}
