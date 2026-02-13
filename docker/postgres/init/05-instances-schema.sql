\connect app_db;

-- Instances table
CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

-- User instance memberships (many-to-many with role per instance)
CREATE TABLE IF NOT EXISTS user_instance_memberships (
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'User')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_user_instance_memberships_user_id 
  ON user_instance_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_instance_memberships_instance_id 
  ON user_instance_memberships(instance_id);

-- Add is_superadmin column to app_users if not exists
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- Add instance_id to app_settings (change key format to instance_id)
-- The key column will now store instance_id instead of 'main'

-- Add instance_id to workflow_version_metadata
ALTER TABLE workflow_version_metadata ADD COLUMN IF NOT EXISTS instance_id TEXT;
CREATE INDEX IF NOT EXISTS idx_workflow_version_metadata_instance_id 
  ON workflow_version_metadata(instance_id);

-- Add instance_id to app_audit_log
ALTER TABLE app_audit_log ADD COLUMN IF NOT EXISTS instance_id TEXT;
CREATE INDEX IF NOT EXISTS idx_app_audit_log_instance_id 
  ON app_audit_log(instance_id);

-- Add instance_id to workflow_groups
ALTER TABLE workflow_groups ADD COLUMN IF NOT EXISTS instance_id TEXT;
-- Need to drop and recreate primary key to include instance_id
-- For existing data, we'll handle this in migration

-- Add instance_id to workflow_group_members
ALTER TABLE workflow_group_members ADD COLUMN IF NOT EXISTS instance_id TEXT;

-- Create default instance for migration
INSERT INTO instances (id, name, slug, created_at)
VALUES ('default', 'Default Instance', 'default', NOW())
ON CONFLICT (id) DO NOTHING;

-- Migrate existing settings to default instance
UPDATE app_settings SET key = 'default' WHERE key = 'main';

-- Migrate existing metadata to default instance
UPDATE workflow_version_metadata SET instance_id = 'default' WHERE instance_id IS NULL;

-- Migrate existing audit logs to default instance
UPDATE app_audit_log SET instance_id = 'default' WHERE instance_id IS NULL;

-- Migrate existing workflow groups to default instance
UPDATE workflow_groups SET instance_id = 'default' WHERE instance_id IS NULL;
UPDATE workflow_group_members SET instance_id = 'default' WHERE instance_id IS NULL;

-- Make the first admin user a superadmin (migration for existing systems)
UPDATE app_users SET is_superadmin = TRUE 
WHERE id = (SELECT id FROM app_users WHERE role = 'Admin' ORDER BY created_at ASC LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM app_users WHERE is_superadmin = TRUE);

-- Add existing admin users to default instance
INSERT INTO user_instance_memberships (user_id, instance_id, role)
SELECT id, 'default', role FROM app_users
WHERE NOT EXISTS (
  SELECT 1 FROM user_instance_memberships WHERE user_id = app_users.id AND instance_id = 'default'
)
ON CONFLICT DO NOTHING;
