import { Pool } from "pg";
import { getSettings, type DatabaseSettings } from "@/lib/settingsStore";

// Map of instanceId -> { pool, key, lastUsed } for versions pools with LRU eviction
const versionsPools: Map<string, { pool: Pool; key: string; lastUsed: number }> = new Map();
let appPool: Pool | undefined;
let appPoolKey: string | undefined;

const DEFAULT_INSTANCE_ID = "default";
const MAX_VERSION_POOLS = 10; // Limit to prevent resource exhaustion

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

export async function getVersionsPool(instanceId?: string): Promise<Pool> {
  const effectiveInstanceId = instanceId || DEFAULT_INSTANCE_ID;
  const settings = await getSettings(effectiveInstanceId);
  const nextKey = getVersionsPoolKey(settings.db);
  
  const existing = versionsPools.get(effectiveInstanceId);
  if (existing && existing.key === nextKey) {
    // Update last used time
    existing.lastUsed = Date.now();
    return existing.pool;
  }

  // If settings changed, close old pool
  if (existing && existing.key !== nextKey) {
    await existing.pool.end();
    versionsPools.delete(effectiveInstanceId);
  }

  // Evict least recently used pool if at capacity
  if (versionsPools.size >= MAX_VERSION_POOLS) {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;
    for (const [key, value] of versionsPools) {
      if (value.lastUsed < oldestTime) {
        oldestTime = value.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const oldPool = versionsPools.get(oldestKey);
      if (oldPool) {
        await oldPool.pool.end();
        versionsPools.delete(oldestKey);
      }
    }
  }

  const config = buildVersionsPgConfig(settings.db);
  const newPool = new Pool(config);
  versionsPools.set(effectiveInstanceId, { pool: newPool, key: nextKey, lastUsed: Date.now() });
  return newPool;
}

// Close all versions pools (useful for testing/cleanup)
export async function closeAllVersionsPools(): Promise<void> {
  for (const [, { pool }] of versionsPools) {
    await pool.end();
  }
  versionsPools.clear();
}

// Close specific instance pool
export async function closeVersionsPool(instanceId: string): Promise<void> {
  const existing = versionsPools.get(instanceId);
  if (existing) {
    await existing.pool.end();
    versionsPools.delete(instanceId);
  }
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

