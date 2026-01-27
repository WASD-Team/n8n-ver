import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { getSettings } from "@/lib/settingsStore";
import { getVersionById } from "@/lib/versionsStore";
import { applyTemplate } from "@/lib/template";

export async function POST(
  _request: Request,
  context: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await context.params;
  const version = await getVersionById(Number(versionId));
  if (!version) return NextResponse.json({ ok: false, error: "Version not found" }, { status: 404 });

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
  const actor = await getCurrentUser();
  await logAudit({
    actorEmail: actor?.email ?? null,
    action: "version.restore",
    entityType: "version",
    entityId: versionId,
    details: {
      webhookUrl: settings.webhook.url,
      status: response.status,
    },
  });
  return NextResponse.json({ ok: response.ok, status: response.status, body: text });
}
