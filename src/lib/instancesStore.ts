import { randomUUID } from "node:crypto";
import { getAppPool } from "@/lib/db";

// Cache flag to avoid repeated CREATE TABLE calls
let tablesEnsured = false;

export type Instance = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  createdBy: string | null;
};

export type InstanceMembership = {
  userId: string;
  instanceId: string;
  role: "Admin" | "User";
  createdAt: string;
};

export type InstanceWithRole = Instance & {
  role: "Admin" | "User";
};

export async function ensureInstancesTables() {
  if (tablesEnsured) return;
  
  const pool = await getAppPool();
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_instance_memberships (
        user_id TEXT NOT NULL,
        instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('Admin', 'User')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, instance_id)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_instance_memberships_user_id 
        ON user_instance_memberships(user_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_instance_memberships_instance_id 
        ON user_instance_memberships(instance_id);
    `);
  } catch (error: unknown) {
    // Ignore duplicate type/table errors (can happen due to race conditions)
    const pgError = error as { code?: string };
    if (pgError.code !== '42P07' && pgError.code !== '23505') {
      throw error;
    }
  }
  
  tablesEnsured = true;
}

function mapInstance(row: Record<string, unknown>): Instance {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    createdAt: String(row.created_at),
    createdBy: row.created_by ? String(row.created_by) : null,
  };
}

function mapMembership(row: Record<string, unknown>): InstanceMembership {
  return {
    userId: String(row.user_id),
    instanceId: String(row.instance_id),
    role: row.role as "Admin" | "User",
    createdAt: String(row.created_at),
  };
}

// Instance CRUD

export async function listInstances(options?: {
  limit?: number;
  offset?: number;
}): Promise<Instance[]> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  
  const result = await pool.query(
    "SELECT * FROM instances ORDER BY created_at ASC LIMIT $1 OFFSET $2",
    [limit, offset]
  );
  return result.rows.map(mapInstance);
}

export async function countInstances(): Promise<number> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  const result = await pool.query("SELECT COUNT(*) FROM instances");
  return Number(result.rows[0].count);
}

export async function getInstanceById(id: string): Promise<Instance | null> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  const result = await pool.query(
    "SELECT * FROM instances WHERE id = $1",
    [id]
  );
  return result.rows[0] ? mapInstance(result.rows[0]) : null;
}

export async function getInstanceBySlug(slug: string): Promise<Instance | null> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  const result = await pool.query(
    "SELECT * FROM instances WHERE slug = $1",
    [slug]
  );
  return result.rows[0] ? mapInstance(result.rows[0]) : null;
}

export async function createInstance(input: {
  name: string;
  slug: string;
  createdBy?: string;
}): Promise<Instance> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  const id = randomUUID();
  
  const result = await pool.query(
    `INSERT INTO instances (id, name, slug, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, input.name.trim(), input.slug.trim().toLowerCase(), input.createdBy ?? null]
  );
  
  return mapInstance(result.rows[0]);
}

export async function updateInstance(input: {
  id: string;
  name?: string;
  slug?: string;
}): Promise<Instance | null> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name.trim());
  }
  if (input.slug !== undefined) {
    updates.push(`slug = $${paramIndex++}`);
    values.push(input.slug.trim().toLowerCase());
  }

  if (updates.length === 0) return getInstanceById(input.id);

  values.push(input.id);
  const result = await pool.query(
    `UPDATE instances SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  
  return result.rows[0] ? mapInstance(result.rows[0]) : null;
}

export async function deleteInstance(id: string): Promise<void> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  await pool.query("DELETE FROM instances WHERE id = $1", [id]);
}

// Membership operations

export async function listInstanceMemberships(instanceId: string): Promise<InstanceMembership[]> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  const result = await pool.query(
    "SELECT * FROM user_instance_memberships WHERE instance_id = $1 ORDER BY created_at ASC",
    [instanceId]
  );
  return result.rows.map(mapMembership);
}

export async function listUserMemberships(userId: string): Promise<InstanceMembership[]> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  const result = await pool.query(
    "SELECT * FROM user_instance_memberships WHERE user_id = $1 ORDER BY created_at ASC",
    [userId]
  );
  return result.rows.map(mapMembership);
}

export async function listUserInstances(userId: string): Promise<InstanceWithRole[]> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  const result = await pool.query(
    `SELECT i.*, m.role
     FROM instances i
     JOIN user_instance_memberships m ON i.id = m.instance_id
     WHERE m.user_id = $1
     ORDER BY i.created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    ...mapInstance(row),
    role: row.role as "Admin" | "User",
  }));
}

export async function getMembership(
  userId: string,
  instanceId: string
): Promise<InstanceMembership | null> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  const result = await pool.query(
    "SELECT * FROM user_instance_memberships WHERE user_id = $1 AND instance_id = $2",
    [userId, instanceId]
  );
  return result.rows[0] ? mapMembership(result.rows[0]) : null;
}

export async function addMembership(input: {
  userId: string;
  instanceId: string;
  role: "Admin" | "User";
}): Promise<InstanceMembership> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  const result = await pool.query(
    `INSERT INTO user_instance_memberships (user_id, instance_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, instance_id) DO UPDATE SET role = $3
     RETURNING *`,
    [input.userId, input.instanceId, input.role]
  );
  return mapMembership(result.rows[0]);
}

export async function updateMembershipRole(input: {
  userId: string;
  instanceId: string;
  role: "Admin" | "User";
}): Promise<InstanceMembership | null> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  const result = await pool.query(
    `UPDATE user_instance_memberships 
     SET role = $3 
     WHERE user_id = $1 AND instance_id = $2
     RETURNING *`,
    [input.userId, input.instanceId, input.role]
  );
  return result.rows[0] ? mapMembership(result.rows[0]) : null;
}

export async function removeMembership(userId: string, instanceId: string): Promise<void> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  await pool.query(
    "DELETE FROM user_instance_memberships WHERE user_id = $1 AND instance_id = $2",
    [userId, instanceId]
  );
}

export async function removeAllUserMemberships(userId: string): Promise<void> {
  await ensureInstancesTables();
  const pool = await getAppPool();
  await pool.query(
    "DELETE FROM user_instance_memberships WHERE user_id = $1",
    [userId]
  );
}

// Helper: ensure default instance exists
export async function ensureDefaultInstance(): Promise<Instance> {
  await ensureInstancesTables();
  const existing = await getInstanceBySlug("default");
  if (existing) return existing;
  
  return createInstance({
    name: "Default Instance",
    slug: "default",
  });
}

// Helper: check if user has access to instance
export async function hasInstanceAccess(
  userId: string,
  instanceId: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true;
  const membership = await getMembership(userId, instanceId);
  return membership !== null;
}

// Helper: check if user is admin of instance
export async function isInstanceAdmin(
  userId: string,
  instanceId: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true;
  const membership = await getMembership(userId, instanceId);
  return membership?.role === "Admin";
}
