import { Pool } from "pg";
import { getSettings, type DatabaseSettings } from "@/lib/settingsStore";

let versionsPool: Pool | undefined;
let versionsPoolKey: string | undefined;
let appPool: Pool | undefined;
let appPoolKey: string | undefined;

export function buildVersionsPgConfig(db: DatabaseSettings) {
  if (!db.host || !db.database || !db.user) {
    throw new Error("Versions DB is not configured. Open Settings and fill DB access.");
  }

  return {
    host: db.host,
    port: Number(db.port || 5432),
    database: db.database,
    user: db.user,
    password: db.password,
    options: "-c client_encoding=UTF8",
    ssl:
      db.sslMode === "disable"
        ? undefined
        : {
            rejectUnauthorized: db.sslMode === "verify-full",
          },
  };
}

function getVersionsPoolKey(db: DatabaseSettings) {
  return [db.host, db.port, db.database, db.user, db.sslMode].join("|");
}

function parseAppDatabaseUrl(url?: string) {
  if (!url) {
    throw new Error("App database is not configured. Set DATABASE_URL in .env.local.");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is invalid. Expected postgres://user:pass@host:5432/db");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must start with postgres:// or postgresql://");
  }
  const dbName = parsed.pathname.replace(/^\/+/, "");
  if (!parsed.hostname || !dbName || !parsed.username) {
    throw new Error("DATABASE_URL must include host, database, and user.");
  }
  const sslMode = parsed.searchParams.get("sslmode");
  return {
    config: {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database: dbName,
      user: decodeURIComponent(parsed.username),
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      options: "-c client_encoding=UTF8",
      ssl:
        sslMode === "disable" || !sslMode
          ? undefined
          : {
              rejectUnauthorized: sslMode === "verify-full",
            },
    },
    key: [parsed.hostname, parsed.port || "5432", dbName, parsed.username, sslMode ?? "disable"].join("|"),
  };
}

export async function getVersionsPool() {
  const settings = await getSettings();
  const nextKey = getVersionsPoolKey(settings.db);
  if (versionsPool && versionsPoolKey === nextKey) return versionsPool;

  if (versionsPool && versionsPoolKey !== nextKey) {
    await versionsPool.end();
  }

  const config = buildVersionsPgConfig(settings.db);
  versionsPool = new Pool(config);
  versionsPoolKey = nextKey;
  return versionsPool;
}

export async function getAppPool() {
  const { config, key } = parseAppDatabaseUrl(process.env.DATABASE_URL);
  if (appPool && appPoolKey === key) return appPool;

  if (appPool && appPoolKey !== key) {
    await appPool.end();
  }

  appPool = new Pool(config);
  appPoolKey = key;
  return appPool;
}

function getAppDbUser(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "unknown";
  try {
    const parsed = new URL(url);
    return parsed.username || "unknown";
  } catch {
    return "unknown";
  }
}

export function formatAppDbError(err: unknown): string {
  const fallback = "App DB error. Check DATABASE_URL and database availability.";
  if (!err || typeof err !== "object") return fallback;

  const code = "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
  if (code === "28P01") {
    return `App DB authentication failed for user "${getAppDbUser()}". Check DATABASE_URL credentials.`;
  }
  if (code === "3D000") {
    return "App DB does not exist. Check DATABASE_URL database name.";
  }
  if (code === "28000") {
    return `App DB authorization failed for user "${getAppDbUser()}". Check DATABASE_URL credentials.`;
  }

  const message = "message" in err ? String((err as { message?: unknown }).message ?? "") : "";
  if (message) return message;
  return fallback;
}

