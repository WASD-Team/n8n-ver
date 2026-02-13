import { getAppPool } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

export type WebhookSettings = {
  url: string;
  method: "POST" | "PUT";
  contentType: "application/json" | "application/x-www-form-urlencoded";
  template: string;
};

export type DatabaseSettings = {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  sslMode: "disable" | "require" | "verify-full";
};

export type AppSettings = {
  db: DatabaseSettings;
  webhook: WebhookSettings;
};

const DEFAULT_SETTINGS: AppSettings = {
  db: {
    host: "",
    port: "5432",
    database: "",
    user: "",
    password: "",
    sslMode: "disable",
  },
  webhook: {
    url: "",
    method: "POST",
    contentType: "application/json",
    template:
      '{"workflowId":"{w_id}","versionId":"{id}","versionUuid":"{w_version}","name":"{w_name}","updatedAt":"{w_updatedAt}","json":{w_json}}',
  },
};

// Default instance ID for backward compatibility
const DEFAULT_INSTANCE_ID = "default";

async function ensureSettingsTable() {
  const pool = await getAppPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
  `);
}

export async function getSettings(instanceId?: string): Promise<AppSettings> {
  const settingsKey = instanceId || DEFAULT_INSTANCE_ID;
  try {
    await ensureSettingsTable();
    
    const pool = await getAppPool();
    const result = await pool.query(
      "SELECT value FROM app_settings WHERE key = $1",
      [settingsKey]
    );

    if (result.rows.length === 0) {
      return DEFAULT_SETTINGS;
    }

    const stored = result.rows[0].value as Partial<AppSettings>;
    
    // Decrypt password if present
    if (stored.db?.password) {
      try {
        // Check if password looks encrypted (has colons)
        if (stored.db.password.includes(":")) {
          stored.db.password = decrypt(stored.db.password);
        }
      } catch {
        // Keep original password if decryption fails
      }
    }

    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      db: { ...DEFAULT_SETTINGS.db, ...(stored.db ?? {}) },
      webhook: { ...DEFAULT_SETTINGS.webhook, ...(stored.webhook ?? {}) },
    };
  } catch (err) {
    console.error("[getSettings] ERROR:", err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(next: AppSettings, instanceId?: string): Promise<AppSettings> {
  const settingsKey = instanceId || DEFAULT_INSTANCE_ID;
  try {
    await ensureSettingsTable();
    
    // Encrypt password before saving
    const toStore = {
      ...next,
      db: {
        ...next.db,
        password: next.db.password ? encrypt(next.db.password) : "",
      },
    };

    const pool = await getAppPool();
    await pool.query(
      `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = $2, updated_at = NOW()
      `,
      [settingsKey, JSON.stringify(toStore)]
    );

    return next; // Return with decrypted password
  } catch (err) {
    console.error("[saveSettings] ERROR:", err);
    throw err; // Re-throw to be caught by the API handler
  }
}
