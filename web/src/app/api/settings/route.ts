import { NextResponse } from "next/server";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { getSettings, saveSettings, type AppSettings } from "@/lib/settingsStore";
import { applyTemplate, validateTemplate } from "@/lib/template";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });
  const body = (await request.json()) as AppSettings;

  const validation = validateTemplate(body.webhook?.template ?? "");
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: `Unknown placeholders: ${validation.unknown.join(", ")}` },
      { status: 400 },
    );
  }

  const sampleVersion = {
    id: 1,
    w_name: "Sample workflow",
    w_updatedAt: new Date().toISOString(),
    w_json: "{}",
    w_id: "WF_SAMPLE",
    w_version: "00000000-0000-0000-0000-000000000000",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const applied = applyTemplate(body.webhook.template, sampleVersion);
  if (!applied.ok) {
    return NextResponse.json({ ok: false, error: `Template error: ${applied.error}` }, { status: 400 });
  }

  const saved = await saveSettings(body);
  const actor = await getCurrentUser();
  await logAudit({
    actorEmail: actor?.email ?? null,
    action: "settings.save",
    entityType: "settings",
    details: {
      webhookUrl: body.webhook?.url ?? "",
      method: body.webhook?.method ?? "",
      contentType: body.webhook?.contentType ?? "",
    },
  });
  return NextResponse.json({ ok: true, settings: saved, placeholders: validation.placeholders });
}

