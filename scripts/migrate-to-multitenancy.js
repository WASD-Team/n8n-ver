/**
 * Migration script for multi-tenancy support
 * 
 * This script migrates existing data to support multiple instances:
 * 1. Creates the instances and user_instance_memberships tables
 * 2. Creates a "default" instance
 * 3. Adds instance_id columns to existing tables
 * 4. Migrates existing data to the default instance
 * 5. Makes the first admin user a SuperAdmin
 * 
 * Run with: node scripts/migrate-to-multitenancy.js
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

function parseDbUrl(url) {
  const parsed = new URL(url);
  const sslMode = parsed.searchParams.get('sslmode');
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\/+/, ''),
    user: decodeURIComponent(parsed.username),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    ssl: (sslMode === 'disable' || !sslMode)
      ? undefined
      : { rejectUnauthorized: sslMode === 'verify-full' },
  };
}

async function migrate() {
  const pool = new Pool(parseDbUrl(DATABASE_URL));

  const client = await pool.connect();

  try {
    console.log('Starting multi-tenancy migration...');
    
    await client.query('BEGIN');

    // 1. Create instances table
    console.log('Creating instances table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by TEXT
      );
    `);

    // 2. Create user_instance_memberships table
    console.log('Creating user_instance_memberships table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_instance_memberships (
        user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('Admin', 'User')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, instance_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_instance_memberships_user_id 
        ON user_instance_memberships(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_instance_memberships_instance_id 
        ON user_instance_memberships(instance_id);
    `);

    // 3. Add is_superadmin column to app_users
    console.log('Adding is_superadmin column to app_users...');
    await client.query(`
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;
    `);

    // 4. Add instance_id to workflow_version_metadata
    console.log('Adding instance_id to workflow_version_metadata...');
    await client.query(`
      ALTER TABLE workflow_version_metadata ADD COLUMN IF NOT EXISTS instance_id TEXT;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_version_metadata_instance_id 
        ON workflow_version_metadata(instance_id);
    `);

    // 5. Add instance_id to app_audit_log
    console.log('Adding instance_id to app_audit_log...');
    await client.query(`
      ALTER TABLE app_audit_log ADD COLUMN IF NOT EXISTS instance_id TEXT;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_app_audit_log_instance_id 
        ON app_audit_log(instance_id);
    `);

    // 6. Add instance_id to workflow_groups
    console.log('Adding instance_id to workflow_groups...');
    await client.query(`
      ALTER TABLE workflow_groups ADD COLUMN IF NOT EXISTS instance_id TEXT;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_groups_instance_id 
        ON workflow_groups(instance_id);
    `);

    // 7. Add instance_id to workflow_group_members
    console.log('Adding instance_id to workflow_group_members...');
    await client.query(`
      ALTER TABLE workflow_group_members ADD COLUMN IF NOT EXISTS instance_id TEXT;
    `);

    // 8. Create default instance
    console.log('Creating default instance...');
    await client.query(`
      INSERT INTO instances (id, name, slug, created_at)
      VALUES ('default', 'Default Instance', 'default', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // 9. Add instance_id to app_settings and migrate to default instance
    console.log('Adding instance_id to app_settings...');
    await client.query(`
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS instance_id TEXT;
    `);
    
    console.log('Migrating settings to default instance...');
    await client.query(`
      UPDATE app_settings SET key = 'default', instance_id = 'default' WHERE key = 'main';
    `);
    await client.query(`
      UPDATE app_settings SET instance_id = 'default' WHERE instance_id IS NULL;
    `);

    // 10. Migrate existing metadata to default instance
    console.log('Migrating metadata to default instance...');
    await client.query(`
      UPDATE workflow_version_metadata SET instance_id = 'default' WHERE instance_id IS NULL;
    `);

    // 11. Migrate existing audit logs to default instance
    console.log('Migrating audit logs to default instance...');
    await client.query(`
      UPDATE app_audit_log SET instance_id = 'default' WHERE instance_id IS NULL;
    `);

    // 12. Migrate existing workflow groups to default instance
    console.log('Migrating workflow groups to default instance...');
    await client.query(`
      UPDATE workflow_groups SET instance_id = 'default' WHERE instance_id IS NULL;
    `);
    await client.query(`
      UPDATE workflow_group_members SET instance_id = 'default' WHERE instance_id IS NULL;
    `);

    // 13. Make the first admin user a SuperAdmin
    console.log('Setting first admin as SuperAdmin...');
    const adminResult = await client.query(`
      UPDATE app_users SET is_superadmin = TRUE 
      WHERE id = (SELECT id FROM app_users WHERE role = 'Admin' ORDER BY created_at ASC LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM app_users WHERE is_superadmin = TRUE)
      RETURNING id, email;
    `);
    
    if (adminResult.rows.length > 0) {
      console.log(`  Made user ${adminResult.rows[0].email} a SuperAdmin`);
    }

    // 14. Add existing users to default instance
    console.log('Adding existing users to default instance...');
    const usersResult = await client.query(`
      INSERT INTO user_instance_memberships (user_id, instance_id, role)
      SELECT id, 'default', role FROM app_users
      WHERE NOT EXISTS (
        SELECT 1 FROM user_instance_memberships WHERE user_id = app_users.id AND instance_id = 'default'
      )
      ON CONFLICT DO NOTHING
      RETURNING user_id;
    `);
    console.log(`  Added ${usersResult.rowCount} users to default instance`);

    await client.query('COMMIT');
    
    console.log('\nMigration completed successfully!');
    console.log('\nSummary:');
    console.log('- Created instances table');
    console.log('- Created user_instance_memberships table');
    console.log('- Added is_superadmin column to app_users');
    console.log('- Added instance_id to all relevant tables');
    console.log('- Created "default" instance');
    console.log('- Migrated existing data to default instance');
    console.log('- Set first admin as SuperAdmin');
    console.log('- Added all users to default instance');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
