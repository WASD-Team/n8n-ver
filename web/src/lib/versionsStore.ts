import { randomUUID } from "node:crypto";
import { getAppPool, getVersionsPool } from "@/lib/db";

export type VersionRow = {
  id: number;
  w_name: string;
  w_updatedAt: string;
  w_json: string;
  w_id: string;
  w_version: string;
  createdAt: string;
  updatedAt: string;
  description?: string | null;
  comment?: string | null;
  tags?: string[] | null;
};

export type WorkflowSummary = {
  workflowId: string;
  name: string;
  lastUpdatedAt: string;
  versionsCount: number;
};

const VERSIONS_TABLE = "workflow_versions";
const METADATA_TABLE = "workflow_version_metadata";

async function ensureMetadataTable() {
  const pool = await getAppPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${METADATA_TABLE} (
      version_id INTEGER PRIMARY KEY,
      description TEXT,
      comment TEXT,
      tags JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

type VersionMetadata = {
  description: string | null;
  comment: string | null;
  tags: string[] | null;
};

function parseTags(raw: unknown): string[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as string[];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function listMetadataByIds(ids: number[]): Promise<Map<number, VersionMetadata>> {
  const metadata = new Map<number, VersionMetadata>();
  if (ids.length === 0) return metadata;
  await ensureMetadataTable();
  const pool = await getAppPool();
  const result = await pool.query(
    `
    SELECT version_id, description, comment, tags
    FROM ${METADATA_TABLE}
    WHERE version_id = ANY($1::int[])
    `,
    [ids],
  );
  for (const row of result.rows as Array<Record<string, unknown>>) {
    const versionId = Number(row.version_id);
    metadata.set(versionId, {
      description: row.description ? String(row.description) : null,
      comment: row.comment ? String(row.comment) : null,
      tags: parseTags(row.tags),
    });
  }
  return metadata;
}

function applyMetadata(versions: VersionRow[], metadata: Map<number, VersionMetadata>): VersionRow[] {
  return versions.map((version) => ({
    ...version,
    ...(metadata.get(version.id) ?? { description: null, comment: null, tags: null }),
  }));
}

export async function listWorkflows(params?: {
  search?: string;
}): Promise<WorkflowSummary[]> {
  const pool = await getVersionsPool();
  const search = params?.search?.trim();
  const searchParam = search ? `%${search}%` : null;

  const result = await pool.query(
    `
    SELECT
      v.w_id AS workflow_id,
      (array_agg(v.w_name ORDER BY v.w_updatedat DESC))[1] AS name,
      MAX(v.w_updatedat) AS last_updated,
      COUNT(*)::int AS versions_count
    FROM ${VERSIONS_TABLE} v
    WHERE ($1::text IS NULL OR v.w_name ILIKE $1)
    GROUP BY v.w_id
    ORDER BY versions_count DESC
    `,
    [searchParam],
  );

  return result.rows.map((row) => ({
    workflowId: row.workflow_id,
    name: row.name,
    lastUpdatedAt: row.last_updated,
    versionsCount: row.versions_count,
  }));
}

export async function listStaleWorkflows(limit = 10): Promise<WorkflowSummary[]> {
  const pool = await getVersionsPool();
  const result = await pool.query(
    `
    SELECT
      v.w_id AS workflow_id,
      (array_agg(v.w_name ORDER BY v.w_updatedat DESC))[1] AS name,
      MAX(v.w_updatedat) AS last_updated,
      COUNT(*)::int AS versions_count
    FROM ${VERSIONS_TABLE} v
    GROUP BY v.w_id
    ORDER BY last_updated ASC
    LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => ({
    workflowId: row.workflow_id,
    name: row.name,
    lastUpdatedAt: row.last_updated,
    versionsCount: row.versions_count,
  }));
}

export async function listRecentVersions(limit = 10): Promise<VersionRow[]> {
  const pool = await getVersionsPool();
  const result = await pool.query(
    `
    SELECT v.*
    FROM ${VERSIONS_TABLE} v
    ORDER BY v.createdat DESC
    LIMIT $1
    `,
    [limit],
  );
  const versions = result.rows.map(mapVersionRow);
  const metadata = await listMetadataByIds(versions.map((version) => version.id));
  return applyMetadata(versions, metadata);
}

export async function listVersionsByWorkflow(workflowId: string): Promise<VersionRow[]> {
  const pool = await getVersionsPool();
  const result = await pool.query(
    `
    SELECT v.*
    FROM ${VERSIONS_TABLE} v
    WHERE v.w_id = $1
    ORDER BY v.createdat DESC
    `,
    [workflowId],
  );
  const versions = result.rows.map(mapVersionRow);
  const metadata = await listMetadataByIds(versions.map((version) => version.id));
  return applyMetadata(versions, metadata);
}

export async function getVersionById(versionId: number): Promise<VersionRow | undefined> {
  const pool = await getVersionsPool();
  const result = await pool.query(
    `
    SELECT v.*
    FROM ${VERSIONS_TABLE} v
    WHERE v.id = $1
    LIMIT 1
    `,
    [versionId],
  );
  if (!result.rows[0]) return undefined;
  const version = mapVersionRow(result.rows[0]);
  const metadata = await listMetadataByIds([version.id]);
  return applyMetadata([version], metadata)[0];
}

export async function getVersionByUuid(versionUuid: string): Promise<VersionRow | undefined> {
  const pool = await getVersionsPool();
  const result = await pool.query(
    `
    SELECT v.*
    FROM ${VERSIONS_TABLE} v
    WHERE v.w_version = $1
    LIMIT 1
    `,
    [versionUuid],
  );
  if (!result.rows[0]) return undefined;
  const version = mapVersionRow(result.rows[0]);
  const metadata = await listMetadataByIds([version.id]);
  return applyMetadata([version], metadata)[0];
}

export async function updateVersionMetadata(input: {
  versionId: number;
  description: string;
  comment: string;
  tags: string[];
}) {
  await ensureMetadataTable();
  const pool = await getAppPool();
  await pool.query(
    `
    INSERT INTO ${METADATA_TABLE} (version_id, description, comment, tags)
    VALUES ($1, $2, $3, $4::jsonb)
    ON CONFLICT (version_id)
    DO UPDATE SET description = $2, comment = $3, tags = $4::jsonb, updated_at = NOW()
    `,
    [input.versionId, input.description, input.comment, JSON.stringify(input.tags ?? [])],
  );
}

export async function deleteVersionById(versionId: number) {
  const versionsPool = await getVersionsPool();
  const appPool = await getAppPool();
  await versionsPool.query(`DELETE FROM ${VERSIONS_TABLE} WHERE id = $1`, [versionId]);
  await appPool.query(`DELETE FROM ${METADATA_TABLE} WHERE version_id = $1`, [versionId]);
}

export async function deleteAllExceptLatest(keep: number) {
  const keepCount = Number.isFinite(keep) ? Math.max(0, Math.floor(keep)) : 0;
  const versionsPool = await getVersionsPool();
  const appPool = await getAppPool();
  await ensureMetadataTable();

  const keepResult = await versionsPool.query(
    `
    SELECT id
    FROM ${VERSIONS_TABLE}
    ORDER BY createdat DESC
    LIMIT $1
    `,
    [keepCount],
  );
  const keepIds = keepResult.rows.map((row) => Number(row.id));

  let deleteMetadata;
  if (keepIds.length === 0) {
    deleteMetadata = await appPool.query(`DELETE FROM ${METADATA_TABLE}`);
  } else {
    deleteMetadata = await appPool.query(
      `
      DELETE FROM ${METADATA_TABLE}
      WHERE NOT (version_id = ANY($1::int[]))
      `,
      [keepIds],
    );
  }

  let deleteVersions;
  if (keepIds.length === 0) {
    deleteVersions = await versionsPool.query(`DELETE FROM ${VERSIONS_TABLE}`);
  } else {
    deleteVersions = await versionsPool.query(
      `
      DELETE FROM ${VERSIONS_TABLE}
      WHERE NOT (id = ANY($1::int[]))
      `,
      [keepIds],
    );
  }

  return {
    deletedMetadata: deleteMetadata.rowCount ?? 0,
    deletedVersions: deleteVersions.rowCount ?? 0,
  };
}

export async function deleteVersionMetadata(versionId: number) {
  await ensureMetadataTable();
  const pool = await getAppPool();
  await pool.query(`DELETE FROM ${METADATA_TABLE} WHERE version_id = $1`, [versionId]);
}

export async function listVersionsByIds(ids: number[]): Promise<VersionRow[]> {
  if (ids.length === 0) return [];
  const pool = await getVersionsPool();
  const result = await pool.query(
    `
    SELECT v.*
    FROM ${VERSIONS_TABLE} v
    WHERE v.id = ANY($1::int[])
    ORDER BY v.createdat DESC
    `,
    [ids],
  );
  const versions = result.rows.map(mapVersionRow);
  const metadata = await listMetadataByIds(versions.map((version) => version.id));
  return applyMetadata(versions, metadata);
}

export async function listVersionsByWorkflowForExport(workflowId: string): Promise<VersionRow[]> {
  const pool = await getVersionsPool();
  const result = await pool.query(
    `
    SELECT v.*
    FROM ${VERSIONS_TABLE} v
    WHERE v.w_id = $1
    ORDER BY v.createdat DESC
    `,
    [workflowId],
  );
  const versions = result.rows.map(mapVersionRow);
  const metadata = await listMetadataByIds(versions.map((version) => version.id));
  return applyMetadata(versions, metadata);
}

export async function deleteVersionsBulk(ids: number[]) {
  if (ids.length === 0) return;
  const versionsPool = await getVersionsPool();
  const appPool = await getAppPool();
  await versionsPool.query(`DELETE FROM ${VERSIONS_TABLE} WHERE id = ANY($1::int[])`, [ids]);
  await appPool.query(`DELETE FROM ${METADATA_TABLE} WHERE version_id = ANY($1::int[])`, [ids]);
}

export async function deleteVersionsMetadataBulk(ids: number[]) {
  if (ids.length === 0) return;
  await ensureMetadataTable();
  const pool = await getAppPool();
  await pool.query(`DELETE FROM ${METADATA_TABLE} WHERE version_id = ANY($1::int[])`, [ids]);
}

export async function createManualVersion(input: {
  workflowId: string;
  workflowName: string;
  workflowJson: string;
  versionUuid?: string | null;
  workflowUpdatedAt?: string | null;
  createdAt?: string | null;
}) {
  const now = new Date().toISOString();
  const versionUuid = input.versionUuid?.trim() || randomUUID();
  const workflowUpdatedAt = input.workflowUpdatedAt?.trim() || now;
  const createdAt = input.createdAt?.trim() || now;

  const pool = await getVersionsPool();
  const nextIdResult = await pool.query(
    `
    SELECT COALESCE(MAX(id), 0) + 1 AS next_id
    FROM ${VERSIONS_TABLE}
    `,
  );
  const nextId = Number(nextIdResult.rows[0]?.next_id ?? 1);
  const result = await pool.query(
    `
    INSERT INTO ${VERSIONS_TABLE} (id, w_name, w_id, w_version, w_updatedat, w_json, createdat, updatedat)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      nextId,
      input.workflowName.trim(),
      input.workflowId.trim(),
      versionUuid,
      workflowUpdatedAt,
      input.workflowJson,
      createdAt,
      createdAt,
    ],
  );

  const version = mapVersionRow(result.rows[0]);
  const metadata = await listMetadataByIds([version.id]);
  return applyMetadata([version], metadata)[0];
}

function mapVersionRow(row: Record<string, unknown>): VersionRow {
  return {
    id: Number(row.id),
    w_name: String(row.w_name),
    w_updatedAt: String(row.w_updatedAt ?? row.w_updatedat),
    w_json: String(row.w_json),
    w_id: String(row.w_id),
    w_version: String(row.w_version),
    createdAt: String(row.createdAt ?? row.createdat),
    updatedAt: String(row.updatedAt ?? row.updatedat),
    description: null,
    comment: null,
    tags: null,
  };
}

