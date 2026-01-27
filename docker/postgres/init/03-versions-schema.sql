\connect versions_db;

CREATE TABLE IF NOT EXISTS workflow_versions (
  id INTEGER PRIMARY KEY,
  w_name TEXT NOT NULL,
  w_updatedat TIMESTAMPTZ NOT NULL,
  w_json TEXT NOT NULL,
  w_id TEXT NOT NULL,
  w_version TEXT NOT NULL,
  createdat TIMESTAMPTZ NOT NULL,
  updatedat TIMESTAMPTZ NOT NULL
);
