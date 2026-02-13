import { NextResponse } from "next/server";
import { getCurrentUser, requireInstanceAdmin, getEffectiveInstanceId } from "@/lib/auth";
import { logAudit } from "@/lib/auditStore";
import { getSettings, saveSettings, type AppSettings } from "@/lib/settingsStore";
import { applyTemplate, validateTemplate } from "@/lib/template";

// Disable caching for this API route
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryInstanceId = searchParams.get("instanceId");
    
    // Use query param if provided, otherwise use effective instance
    const instanceId = queryInstanceId || await getEffectiveInstanceId();
    
    // For settings, we need at least instance access (admin role)
    if (instanceId) {
      const access = await requireInstanceAdmin(instanceId);
      if (!access.ok) {
        return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
      }
    }
    
    const settings = await getSettings(instanceId ?? undefined);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    console.error("Settings GET error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to get settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryInstanceId = searchParams.get("instanceId");
    
    // Use query param if provided, otherwise use effective instance
    const instanceId = queryInstanceId || await getEffectiveInstanceId();
    
    // For settings, we need instance admin role
    if (instanceId) {
      const access = await requireInstanceAdmin(instanceId);
      if (!access.ok) {
        return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
      }
    }
    
    const rawBody = await request.text();

    if (!rawBody.trim()) {
      return NextResponse.json({ ok: false, error: "Request body is empty" }, { status: 400 });
    }

    let body: AppSettings;
    try {
      body = JSON.parse(rawBody) as AppSettings;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // Validate webhook template only if provided
    if (body.webhook?.template) {
      const validation = validateTemplate(body.webhook.template);
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
    }

    const saved = await saveSettings(body, instanceId ?? undefined);
    
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
      instanceId,
    });
    return NextResponse.json({ ok: true, settings: saved });
  } catch (err) {
    console.error("Settings PUT error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
