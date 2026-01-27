import { NextResponse } from "next/server";
import { Pool } from "pg";
import { requireAdmin } from "@/lib/auth";
import { buildVersionsPgConfig } from "@/lib/db";
import type { DatabaseSettings } from "@/lib/settingsStore";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: admin.error }, { status: 403 });

  const body = (await request.json()) as { db?: DatabaseSettings };
  if (!body.db) {
    return NextResponse.json({ ok: false, error: "Database settings are required" }, { status: 400 });
  }

  let pool: Pool | undefined;
  try {
    const config = buildVersionsPgConfig(body.db);
    pool = new Pool(config);
    await pool.query("SELECT 1");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  } finally {
    if (pool) await pool.end();
  }
}
