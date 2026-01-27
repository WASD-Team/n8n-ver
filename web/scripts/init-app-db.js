const { Pool } = require("pg");

function parseDatabaseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid database URL.");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Database URL must start with postgres:// or postgresql://");
  }
  const dbName = parsed.pathname.replace(/^\/+/, "");
  if (!parsed.hostname || !dbName || !parsed.username) {
    throw new Error("Database URL must include host, database, and user.");
  }
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: dbName,
    user: decodeURIComponent(parsed.username),
    password: parsed.password ? decodeURIComponent(parsed.password) : "",
  };
}

async function ensureRoleAndDb(adminPool, target) {
  if (target.password) {
    await adminPool.query(
      `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) THEN
          EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', $1, $2);
        END IF;
      END $$;
      `,
      [target.user, target.password],
    );
  }

  await adminPool.query(
    `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) THEN
        EXECUTE format('CREATE DATABASE %I OWNER %I', $1, $2);
      END IF;
    END $$;
    `,
    [target.database, target.user],
  );
}

async function ensureUsersTable(appPool) {
  await appPool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      password_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await appPool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
}

async function main() {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  const targetUrl = process.env.DATABASE_URL;
  if (!adminUrl) {
    throw new Error("DATABASE_ADMIN_URL is not set (admin connection to create DB).");
  }
  if (!targetUrl) {
    throw new Error("DATABASE_URL is not set (target app database connection).");
  }

  const target = parseDatabaseUrl(targetUrl);
  const adminPool = new Pool({ connectionString: adminUrl, options: "-c client_encoding=UTF8" });

  try {
    await ensureRoleAndDb(adminPool, target);
  } finally {
    await adminPool.end();
  }

  const appPool = new Pool({ connectionString: targetUrl, options: "-c client_encoding=UTF8" });
  try {
    await ensureUsersTable(appPool);
  } finally {
    await appPool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
