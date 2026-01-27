import fs from "node:fs/promises";
import path from "node:path";

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

const SETTINGS_DIR = path.resolve(process.cwd(), ".data");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "settings.json");

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      db: { ...DEFAULT_SETTINGS.db, ...(parsed.db ?? {}) },
      webhook: { ...DEFAULT_SETTINGS.webhook, ...(parsed.webhook ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(next: AppSettings): Promise<AppSettings> {
  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

