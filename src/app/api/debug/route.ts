import { NextResponse } from "next/server";
import { getAppPool } from "@/lib/db";
import { getSettings } from "@/lib/settingsStore";

export async function GET() {
  try {
    // Check DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    const encryptionKey = process.env.ENCRYPTION_KEY;

    // Check raw data from database
    let rawSettings = null;
    let dbError = null;
    try {
      const pool = await getAppPool();
      const result = await pool.query(
        "SELECT key, value FROM app_settings WHERE key = $1",
        ["main"]
      );
      rawSettings = result.rows[0] || null;
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
    }

    // Try to get settings via getSettings()
    let parsedSettings = null;
    let getSettingsError = null;
    try {
      parsedSettings = await getSettings();
    } catch (err) {
      getSettingsError = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json({
      ok: true,
      env: {
        DATABASE_URL_set: !!dbUrl,
        DATABASE_URL_length: dbUrl?.length || 0,
        ENCRYPTION_KEY_set: !!encryptionKey,
        ENCRYPTION_KEY_length: encryptionKey?.length || 0,
      },
      database: {
        rawSettings,
        error: dbError,
      },
      getSettings: {
        result: parsedSettings,
        error: getSettingsError,
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: "Unexpected error",
      details: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}
