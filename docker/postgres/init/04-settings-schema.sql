-- Settings storage table
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Insert default settings
INSERT INTO app_settings (key, value) 
VALUES ('main', '{
  "db": {
    "host": "",
    "port": "5432",
    "database": "",
    "user": "",
    "password": "",
    "sslMode": "disable"
  },
  "webhook": {
    "url": "",
    "method": "POST",
    "contentType": "application/json",
    "template": "{\"workflowId\":\"{w_id}\",\"versionId\":\"{id}\",\"versionUuid\":\"{w_version}\",\"name\":\"{w_name}\",\"updatedAt\":\"{w_updatedAt}\",\"json\":{w_json}}"
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
