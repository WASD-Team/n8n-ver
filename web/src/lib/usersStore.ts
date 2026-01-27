import { randomUUID } from "node:crypto";
import { formatAppDbError, getAppPool } from "@/lib/db";

export type UserRole = "Admin" | "User";
export type UserStatus = "Active" | "Invited";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
};

export type UserProfile = AppUser & {
  hasPassword: boolean;
};

type StoredUser = AppUser & {
  passwordHash: string | null;
};

export async function ensureUsersTable() {
  try {
    const pool = await getAppPool();
    await pool.query(`
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
    await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  } catch (err) {
    throw new Error(formatAppDbError(err));
  }
}

function mapUser(row: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}): AppUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listUsers(): Promise<AppUser[]> {
  await ensureUsersTable();
  const pool = await getAppPool();
  const result = await pool.query(
    "SELECT id, name, email, role, status, created_at FROM app_users ORDER BY created_at DESC",
  );
  return result.rows.map(mapUser);
}

export async function createUser(input: {
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
}) {
  await ensureUsersTable();
  const pool = await getAppPool();
  const id = randomUUID();
  const status = input.status ?? "Invited";
  await pool.query(
    "INSERT INTO app_users (id, name, email, role, status) VALUES ($1, $2, $3, $4, $5)",
    [id, input.name, input.email, input.role, status],
  );
  return { id, name: input.name, email: input.email, role: input.role, status };
}

export async function createUserWithPassword(input: {
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  passwordHash: string;
}) {
  await ensureUsersTable();
  const pool = await getAppPool();
  const id = randomUUID();
  const status = input.status ?? "Active";
  await pool.query(
    "INSERT INTO app_users (id, name, email, role, status, password_hash) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, input.name, input.email, input.role, status, input.passwordHash],
  );
  return { id, name: input.name, email: input.email, role: input.role, status };
}

export async function updateUserRole(input: { id: string; role: UserRole }) {
  await ensureUsersTable();
  const pool = await getAppPool();
  await pool.query("UPDATE app_users SET role = $1 WHERE id = $2", [input.role, input.id]);
}

export async function updateUserName(input: { id: string; name: string }) {
  await ensureUsersTable();
  const pool = await getAppPool();
  await pool.query("UPDATE app_users SET name = $1 WHERE id = $2", [input.name, input.id]);
}

export async function updateUserPasswordHash(input: { id: string; passwordHash: string }) {
  await ensureUsersTable();
  const pool = await getAppPool();
  await pool.query("UPDATE app_users SET password_hash = $1 WHERE id = $2", [input.passwordHash, input.id]);
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  await ensureUsersTable();
  const pool = await getAppPool();
  const result = await pool.query(
    "SELECT id, name, email, role, status, created_at, password_hash FROM app_users WHERE email = $1",
    [email],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { ...mapUser(row), hasPassword: Boolean(row.password_hash) };
}

export async function getUserWithPasswordByEmail(email: string): Promise<StoredUser | null> {
  await ensureUsersTable();
  const pool = await getAppPool();
  const result = await pool.query(
    "SELECT id, name, email, role, status, created_at, password_hash FROM app_users WHERE email = $1",
    [email],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { ...mapUser(row), passwordHash: row.password_hash ?? null };
}

export async function removeUser(id: string) {
  await ensureUsersTable();
  const pool = await getAppPool();
  await pool.query("DELETE FROM app_users WHERE id = $1", [id]);
}

