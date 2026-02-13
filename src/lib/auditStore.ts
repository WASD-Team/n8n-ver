import { formatAppDbError, getAppPool } from "@/lib/db";

export type AuditEvent = {
  id: number;
  createdAt: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  instanceId: string | null;
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
        details JSONB,
        instance_id TEXT
      );
    `);
    await pool.query(`ALTER TABLE ${AUDIT_TABLE} ADD COLUMN IF NOT EXISTS instance_id TEXT;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_audit_log_instance_id ON ${AUDIT_TABLE}(instance_id);`);
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
  instanceId?: string | null;
}) {
  try {
    await ensureAuditTable();
    const pool = await getAppPool();
    await pool.query(
      `
      INSERT INTO ${AUDIT_TABLE} (actor_email, action, entity_type, entity_id, details, instance_id)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      `,
      [
        input.actorEmail ?? null,
        input.action,
        input.entityType,
        input.entityId ? String(input.entityId) : null,
        input.details ? JSON.stringify(input.details) : null,
        input.instanceId ?? null,
      ],
    );
  } catch {
    // Do not block core actions if audit log fails
  }
}

export async function listAudit(options?: {
  limit?: number;
  offset?: number;
  instanceId?: string;
}): Promise<AuditEvent[]> {
  await ensureAuditTable();
  const pool = await getAppPool();
  
  const limit = options?.limit ?? 200;
  const offset = options?.offset ?? 0;
  const instanceId = options?.instanceId;
  
  const query = instanceId
    ? `SELECT id, created_at, actor_email, action, entity_type, entity_id, details, instance_id
       FROM ${AUDIT_TABLE}
       WHERE instance_id = $3 OR instance_id IS NULL
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`
    : `SELECT id, created_at, actor_email, action, entity_type, entity_id, details, instance_id
       FROM ${AUDIT_TABLE}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`;
  
  const params = instanceId ? [limit, offset, instanceId] : [limit, offset];
  const result = await pool.query(query, params);
  
  return result.rows.map((row) => ({
    id: Number(row.id),
    createdAt: row.created_at,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details ?? null,
    instanceId: row.instance_id ?? null,
  }));
}

export async function countAudit(instanceId?: string): Promise<number> {
  await ensureAuditTable();
  const pool = await getAppPool();
  
  const query = instanceId
    ? `SELECT COUNT(*) FROM ${AUDIT_TABLE} WHERE instance_id = $1 OR instance_id IS NULL`
    : `SELECT COUNT(*) FROM ${AUDIT_TABLE}`;
  
  const params = instanceId ? [instanceId] : [];
  const result = await pool.query(query, params);
  
  return Number(result.rows[0].count);
}
