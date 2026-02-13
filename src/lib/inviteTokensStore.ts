import { randomBytes } from "node:crypto";
import { formatAppDbError, getAppPool } from "@/lib/db";

export type InviteToken = {
  token: string;
  userId: string;
  userEmail: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export async function ensureInviteTokensTable() {
  try {
    const pool = await getAppPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invite_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS invite_tokens_user_id_idx ON invite_tokens (user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS invite_tokens_expires_at_idx ON invite_tokens (expires_at);`);
  } catch (err) {
    throw new Error(formatAppDbError(err));
  }
}

export async function createInviteToken(userId: string, userEmail: string, expiresInHours = 72): Promise<string> {
  await ensureInviteTokensTable();
  const pool = await getAppPool();
  
  // Generate a secure random token
  const token = randomBytes(32).toString("base64url");
  
  // Set expiration time
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);
  
  await pool.query(
    "INSERT INTO invite_tokens (token, user_id, user_email, expires_at) VALUES ($1, $2, $3, $4)",
    [token, userId, userEmail, expiresAt.toISOString()]
  );
  
  return token;
}

export async function getInviteToken(token: string): Promise<InviteToken | null> {
  await ensureInviteTokensTable();
  const pool = await getAppPool();
  
  const result = await pool.query(
    "SELECT token, user_id, user_email, expires_at, used_at, created_at FROM invite_tokens WHERE token = $1",
    [token]
  );
  
  const row = result.rows[0];
  if (!row) return null;
  
  return {
    token: row.token,
    userId: row.user_id,
    userEmail: row.user_email,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

export async function markInviteTokenAsUsed(token: string): Promise<void> {
  await ensureInviteTokensTable();
  const pool = await getAppPool();
  
  await pool.query(
    "UPDATE invite_tokens SET used_at = NOW() WHERE token = $1",
    [token]
  );
}

export async function isInviteTokenValid(token: string): Promise<boolean> {
  const inviteToken = await getInviteToken(token);
  
  if (!inviteToken) return false;
  if (inviteToken.usedAt) return false; // Already used
  
  const now = new Date();
  const expiresAt = new Date(inviteToken.expiresAt);
  
  return now < expiresAt; // Not expired
}

export async function revokeUserInviteTokens(userId: string): Promise<void> {
  await ensureInviteTokensTable();
  const pool = await getAppPool();
  
  await pool.query(
    "DELETE FROM invite_tokens WHERE user_id = $1 AND used_at IS NULL",
    [userId]
  );
}

export async function cleanupExpiredTokens(): Promise<number> {
  await ensureInviteTokensTable();
  const pool = await getAppPool();
  
  const result = await pool.query(
    "DELETE FROM invite_tokens WHERE expires_at < NOW() RETURNING token"
  );
  
  return result.rowCount ?? 0;
}
