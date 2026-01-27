import { getAppPool } from "@/lib/db";

export type WorkflowFolderMap = Record<string, string[]>;

const GROUPS_TABLE = "workflow_groups";
const MEMBERS_TABLE = "workflow_group_members";

async function ensureWorkflowGroupsTables() {
  const pool = await getAppPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${GROUPS_TABLE} (
      name TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MEMBERS_TABLE} (
      workflow_id TEXT PRIMARY KEY,
      group_name TEXT NOT NULL REFERENCES ${GROUPS_TABLE}(name) ON DELETE CASCADE
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS workflow_group_members_group_name_idx ON ${MEMBERS_TABLE} (group_name);`,
  );
}

export async function listWorkflowGroups(): Promise<WorkflowFolderMap> {
  await ensureWorkflowGroupsTables();
  const pool = await getAppPool();
  const groupsResult = await pool.query(`SELECT name FROM ${GROUPS_TABLE} ORDER BY name ASC`);
  const membersResult = await pool.query(
    `SELECT workflow_id, group_name FROM ${MEMBERS_TABLE} ORDER BY group_name ASC`,
  );

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

export async function saveWorkflowGroups(folders: WorkflowFolderMap) {
  await ensureWorkflowGroupsTables();
  const pool = await getAppPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM ${MEMBERS_TABLE}`);
    await client.query(`DELETE FROM ${GROUPS_TABLE}`);

    const folderNames = Object.keys(folders).map((name) => name.trim()).filter(Boolean);
    for (const name of folderNames) {
      await client.query(`INSERT INTO ${GROUPS_TABLE} (name) VALUES ($1)`, [name]);
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
          `INSERT INTO ${MEMBERS_TABLE} (workflow_id, group_name) VALUES ($1, $2)`,
          [normalized, groupName],
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
