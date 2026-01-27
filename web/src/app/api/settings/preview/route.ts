import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settingsStore";
import { getVersionById } from "@/lib/versionsStore";
import { applyTemplate, validateTemplate } from "@/lib/template";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });
  const body = (await request.json()) as {
    versionId: number;
    template?: string;
  };

  const version = await getVersionById(Number(body.versionId));
  if (!version) {
    return NextResponse.json({ ok: false, error: "Version not found" }, { status: 404 });
  }

  const settings = await getSettings();
  const template = body.template ?? settings.webhook.template;

  const validation = validateTemplate(template);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: `Unknown placeholders: ${validation.unknown.join(", ")}` },
      { status: 400 },
    );
  }

  const rendered = applyTemplate(template, version);
  return NextResponse.json(rendered);
}

