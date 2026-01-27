\connect versions_db;

COPY workflow_versions (id, w_name, w_updatedat, w_json, w_id, w_version, createdat, updatedat)
FROM '/docker-entrypoint-initdb.d/test_version.csv'
WITH (FORMAT csv, HEADER true);
