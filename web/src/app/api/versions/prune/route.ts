import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { deleteAllExceptLatest } from "@/lib/versionsStore";

export async function POST(request: Request) {
  let body: { keep?: number } = {};
  try {
    body = (await request.json()) as { keep?: number };
  } catch {
    body = {};
  }

  const keep = Number(body.keep ?? 5);
  if (!Number.isFinite(keep) || keep < 0) {
    return NextResponse.json({ ok: false, error: "keep must be a non-negative number" }, { status: 400 });
  }

  const result = await deleteAllExceptLatest(keep);
  const actor = await getCurrentUser();
  await logAudit({
    actorEmail: actor?.email ?? null,
    action: "version.prune",
    entityType: "version",
    details: { keep, ...result },
  });

  return NextResponse.json({ ok: true, keep, ...result });
}
