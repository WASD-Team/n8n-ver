import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settingsStore";
import { getVersionById, getVersionByUuid } from "@/lib/versionsStore";
import { applyTemplate, validateTemplate } from "@/lib/template";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });
    const body = (await request.json()) as {
      versionId?: number | string;
      template?: string;
    };
    const rawVersionId = typeof body.versionId === "string" ? body.versionId.trim() : body.versionId;
    const numericId =
      typeof rawVersionId === "number"
        ? rawVersionId
        : typeof rawVersionId === "string" && /^\d+$/.test(rawVersionId)
          ? Number(rawVersionId)
          : null;

    const version =
      numericId !== null
        ? await getVersionById(numericId)
        : typeof rawVersionId === "string" && rawVersionId
          ? await getVersionByUuid(rawVersionId)
          : undefined;
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
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to preview" },
      { status: 500 },
    );
  }
}

