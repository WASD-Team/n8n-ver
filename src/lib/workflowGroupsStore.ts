import { getAppPool } from "@/lib/db";

export type WorkflowFolderMap = Record<string, string[]>;

const GROUPS_TABLE = "workflow_groups";
const MEMBERS_TABLE = "workflow_group_members";

async function ensureWorkflowGroupsTables() {
  const pool = await getAppPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${GROUPS_TABLE} (
      name TEXT PRIMARY KEY,
      instance_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE ${GROUPS_TABLE} ADD COLUMN IF NOT EXISTS instance_id TEXT;`);
  
  // Create workflow_group_members table
  // Note: instance_id can be NULL for backward compatibility
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${MEMBERS_TABLE} (
        workflow_id TEXT NOT NULL,
        group_name TEXT NOT NULL,
        instance_id TEXT NOT NULL DEFAULT 'default',
        CONSTRAINT workflow_group_members_pkey PRIMARY KEY (workflow_id, instance_id)
      );
    `);
  } catch {
    // Table might exist with different schema, that's ok
  }
  await pool.query(`ALTER TABLE ${MEMBERS_TABLE} ADD COLUMN IF NOT EXISTS instance_id TEXT;`);
  
  await pool.query(
    `CREATE INDEX IF NOT EXISTS workflow_group_members_group_name_idx ON ${MEMBERS_TABLE} (group_name);`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS workflow_group_members_instance_id_idx ON ${MEMBERS_TABLE} (instance_id);`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS workflow_groups_instance_id_idx ON ${GROUPS_TABLE} (instance_id);`,
  );
}

export async function listWorkflowGroups(instanceId?: string): Promise<WorkflowFolderMap> {
  await ensureWorkflowGroupsTables();
  const pool = await getAppPool();
  
  const groupsQuery = instanceId
    ? `SELECT name FROM ${GROUPS_TABLE} WHERE instance_id = $1 OR instance_id IS NULL ORDER BY name ASC`
    : `SELECT name FROM ${GROUPS_TABLE} ORDER BY name ASC`;
  
  const membersQuery = instanceId
    ? `SELECT workflow_id, group_name FROM ${MEMBERS_TABLE} WHERE instance_id = $1 OR instance_id IS NULL ORDER BY group_name ASC`
    : `SELECT workflow_id, group_name FROM ${MEMBERS_TABLE} ORDER BY group_name ASC`;
  
  const groupsResult = await pool.query(groupsQuery, instanceId ? [instanceId] : []);
  const membersResult = await pool.query(membersQuery, instanceId ? [instanceId] : []);

  const map: WorkflowFolderMap = {};
  for (const row of groupsResult.rows as Array<{ name: string }>) {
    map[row.name] = [];
  }
  for (const row of membersResult.rows as Array<{ workflow_id: string; group_name: string }>) {
    if (!map[row.group_name]) map[row.group_name] = [];
    map[row.group_name].push(row.workflow_id);
  }
  return map;
}

export async function saveWorkflowGroups(folders: WorkflowFolderMap, instanceId?: string) {
  await ensureWorkflowGroupsTables();
  const pool = await getAppPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Delete only for this instance
    if (instanceId) {
      await client.query(`DELETE FROM ${MEMBERS_TABLE} WHERE instance_id = $1`, [instanceId]);
      await client.query(`DELETE FROM ${GROUPS_TABLE} WHERE instance_id = $1`, [instanceId]);
    } else {
      await client.query(`DELETE FROM ${MEMBERS_TABLE} WHERE instance_id IS NULL`);
      await client.query(`DELETE FROM ${GROUPS_TABLE} WHERE instance_id IS NULL`);
    }

    const folderNames = Object.keys(folders).map((name) => name.trim()).filter(Boolean);
    for (const name of folderNames) {
      await client.query(
        `INSERT INTO ${GROUPS_TABLE} (name, instance_id) VALUES ($1, $2)`,
        [name, instanceId ?? null]
      );
    }

    const seen = new Set<string>();
    for (const [group, ids] of Object.entries(folders)) {
      const groupName = group.trim();
      if (!groupName) continue;
      for (const workflowId of ids) {
        const normalized = workflowId.trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        await client.query(
          `INSERT INTO ${MEMBERS_TABLE} (workflow_id, group_name, instance_id) VALUES ($1, $2, $3)`,
          [normalized, groupName, instanceId ?? null],
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
