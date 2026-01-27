import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settingsStore";
import type { VersionRow } from "@/lib/versionsStore";
import { getVersionById } from "@/lib/versionsStore";
import { applyTemplate } from "@/lib/template";

function buildFallbackVersion(versionId: number): VersionRow {
  const now = new Date().toISOString();
  const safeId = Number.isFinite(versionId) ? Math.floor(versionId) : 0;
  return {
    id: safeId,
    w_id: String(safeId || "test-workflow"),
    w_name: "Test workflow",
    w_version: "1",
    createdAt: now,
    updatedAt: now,
    w_updatedAt: now,
    w_json: "{}",
    description: null,
    comment: null,
    tags: null,
  };
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });
  const body = (await request.json()) as { versionId?: number };
  const requestedId = Number(body.versionId);
  const version = (Number.isFinite(requestedId) ? await getVersionById(requestedId) : undefined) ?? buildFallbackVersion(requestedId);

  const settings = await getSettings();
  if (!settings.webhook.url) {
    return NextResponse.json({ ok: false, error: "Webhook URL is empty" }, { status: 400 });
  }

  const applied = applyTemplate(settings.webhook.template, version);
  if (!applied.ok) {
    return NextResponse.json({ ok: false, error: applied.error }, { status: 400 });
  }

  const payload =
    settings.webhook.contentType === "application/json" ? JSON.stringify(applied.json) : applied.rendered;

  const response = await fetch(settings.webhook.url, {
    method: settings.webhook.method,
    headers: { "Content-Type": settings.webhook.contentType },
    body: payload,
  });

  const text = await response.text();
  return NextResponse.json({ ok: response.ok, status: response.status, body: text });
}

