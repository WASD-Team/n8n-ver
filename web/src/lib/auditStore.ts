import { formatAppDbError, getAppPool } from "@/lib/db";

export type AuditEvent = {
  id: number;
  createdAt: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
};

const AUDIT_TABLE = "app_audit_log";

async function ensureAuditTable() {
  try {
    const pool = await getAppPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${AUDIT_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        actor_email TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details JSONB
      );
    `);
  } catch (err) {
    throw new Error(formatAppDbError(err));
  }
}

export async function logAudit(input: {
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown> | null;
}) {
  try {
    await ensureAuditTable();
    const pool = await getAppPool();
    await pool.query(
      `
      INSERT INTO ${AUDIT_TABLE} (actor_email, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        input.actorEmail ?? null,
        input.action,
        input.entityType,
        input.entityId ? String(input.entityId) : null,
        input.details ? JSON.stringify(input.details) : null,
      ],
    );
  } catch {
    // Do not block core actions if audit log fails
  }
}

export async function listAudit(limit = 200): Promise<AuditEvent[]> {
  await ensureAuditTable();
  const pool = await getAppPool();
  const result = await pool.query(
    `
    SELECT id, created_at, actor_email, action, entity_type, entity_id, details
    FROM ${AUDIT_TABLE}
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    createdAt: row.created_at,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details ?? null,
  }));
}
