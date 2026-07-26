import bcrypt from 'bcryptjs';
import client from './database';
import { env } from './env';

async function seed() {
  console.log('Seeding database...');

  // ── Create tables ──────────────────────────────────────────────

  // Organization table (must be first since other tables reference it)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      logo_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','approver','admin','super_admin')),
      organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      approver_id TEXT NOT NULL REFERENCES users(id),
      step_order INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS approval_groups (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL REFERENCES users(id),
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS approval_group_members (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      group_id TEXT NOT NULL REFERENCES approval_groups(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS workflow_approval_slots (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      group_id TEXT NOT NULL REFERENCES approval_groups(id),
      slot_order INTEGER NOT NULL,
      resolution_mode TEXT NOT NULL DEFAULT 'all' CHECK(resolution_mode IN ('first', 'all')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(workflow_id, slot_order)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      workflow_id TEXT NOT NULL REFERENCES workflows(id),
      requester_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_review','approved','rejected','cancelled')),
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS approval_steps (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      request_id TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
      slot_order INTEGER NOT NULL DEFAULT 0,
      group_id TEXT,
      approver_id TEXT NOT NULL REFERENCES users(id),
      resolution_mode TEXT NOT NULL DEFAULT 'all' CHECK(resolution_mode IN ('first', 'all')),
      step_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','skipped')),
      comment TEXT,
      acted_at TEXT
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS workflow_columns (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      label       TEXT NOT NULL,
      column_type TEXT NOT NULL CHECK(column_type IN ('text', 'long_text', 'single_choice', 'multiple_choice', 'date', 'file')),
      is_required INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL,
      options     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(workflow_id, sort_order)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS approval_request_fields (
      id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      request_id     TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
      column_id      TEXT NOT NULL REFERENCES workflow_columns(id),
      value          TEXT,
      file_data      BLOB,
      file_mime_type TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  console.log('Tables created.');

  // ── Run column migrations for existing tables ──────────────────

  await ensureColumns('users', [
    { name: 'organization_id', ddl: 'organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL' },
  ]);

  await ensureColumns('workflows', [
    { name: 'organization_id', ddl: 'organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE' },
  ]);

  await ensureColumns('approval_groups', [
    { name: 'organization_id', ddl: 'organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE' },
  ]);

  await ensureColumns('approval_requests', [
    { name: 'organization_id', ddl: 'organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE' },
  ]);

  // ── Migrate users table constraint (add super_admin) ──────────
  // SQLite cannot ALTER TABLE DROP CONSTRAINT, so we recreate the table.
  try {
    const existingSA = await client.execute("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    // If super_admin data exists, constraint must already allow it
    if (existingSA.rows.length === 0) {
      // Check if constraint allows super_admin by checking table schema
      const schemaResult = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
      if (schemaResult.rows.length > 0) {
        const schema = (schemaResult.rows[0] as Record<string, unknown>).sql as string;
        if (!schema.includes('super_admin')) {
          console.log('[migrations] Updating users table constraint to include super_admin...');
          await client.execute("PRAGMA foreign_keys = OFF");

          await client.execute(`
            CREATE TABLE users_new (
              id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
              email TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','approver','admin','super_admin')),
              organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
          `);

          const userRows = await client.execute("SELECT * FROM users");
          for (const row of userRows.rows) {
            const r = row as unknown as { id: string; email: string; name: string; password_hash: string; role: string; organization_id: string | null; created_at: string };
            await client.execute({
              sql: `INSERT INTO users_new (id, email, name, password_hash, role, organization_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
              args: [r.id, r.email, r.name, r.password_hash, r.role, r.organization_id || null, r.created_at],
            });
          }

          await client.execute("DROP TABLE users");
          await client.execute("ALTER TABLE users_new RENAME TO users");
          await client.execute("PRAGMA foreign_keys = ON");
          console.log('[migrations] Users table recreated with updated role constraint.');
        }
      }
    }
  } catch (err) {
    try { await client.execute("PRAGMA foreign_keys = ON"); } catch {}
    console.log('[migrations] Note: users table migration error (may be ok if already migrated):', (err as Error).message);
  }

  // ── Seed Default Organization ──────────────────────────────────

  const defaultOrgCheck = await client.execute({
    sql: 'SELECT id FROM organizations WHERE slug = ?',
    args: ['default'],
  });

  let defaultOrgId: string;

  if (defaultOrgCheck.rows.length === 0) {
    const orgResult = await client.execute({
      sql: `INSERT INTO organizations (name, slug)
            VALUES ('Default Organization', 'default')
            RETURNING id`,
      args: [],
    });
    defaultOrgId = orgResult.rows[0].id as string;
    console.log(`Default organization created: Default Organization (${defaultOrgId})`);
  } else {
    defaultOrgId = defaultOrgCheck.rows[0].id as string;
    console.log(`Default organization already exists: ${defaultOrgId}`);
  }

  // ── Seed Super Admin ───────────────────────────────────────────

  const existingSuperAdmin = await client.execute({
    sql: 'SELECT id, organization_id, role FROM users WHERE email = ?',
    args: [env.SUPER_ADMIN_EMAIL],
  });

  if (existingSuperAdmin.rows.length === 0) {
    const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 12);
    await client.execute({
      sql: `INSERT INTO users (email, name, password_hash, role, organization_id)
            VALUES (?, ?, ?, 'super_admin', NULL)`,
      args: [env.SUPER_ADMIN_EMAIL, 'Super Admin', passwordHash],
    });
    console.log(`Super admin created: ${env.SUPER_ADMIN_EMAIL}`);
  } else {
    // Upgrade existing admin to super_admin and clear org if needed
    const existingRole = existingSuperAdmin.rows[0].role as string;
    if (existingRole !== 'super_admin') {
      await client.execute({
        sql: "UPDATE users SET role = 'super_admin', organization_id = NULL WHERE email = ?",
        args: [env.SUPER_ADMIN_EMAIL],
      });
      console.log(`Upgraded existing admin to super_admin: ${env.SUPER_ADMIN_EMAIL}`);
    } else {
      console.log(`Super admin already exists: ${env.SUPER_ADMIN_EMAIL}`);
    }
  }

  // ── Assign existing users to default org (those without an org) ──

  const orphanUsers = await client.execute({
    sql: "SELECT id, email FROM users WHERE organization_id IS NULL AND role != 'super_admin'",
    args: [],
  });

  for (const orphan of orphanUsers.rows) {
    const orphanRow = orphan as Record<string, unknown>;
    await client.execute({
      sql: 'UPDATE users SET organization_id = ? WHERE id = ?',
      args: [defaultOrgId, orphanRow.id as string],
    });
    console.log(`Assigned existing user ${orphanRow.email} to Default Organization`);
  }

  // ── Backfill organization_id on existing data tables ───────────

  // For workflows without org, assign to default org
  const orphanWfs = await client.execute({
    sql: 'SELECT id FROM workflows WHERE organization_id IS NULL',
    args: [],
  });
  for (const wf of orphanWfs.rows) {
    const wfRow = wf as Record<string, unknown>;
    await client.execute({
      sql: 'UPDATE workflows SET organization_id = ? WHERE id = ?',
      args: [defaultOrgId, wfRow.id as string],
    });
  }
  if (orphanWfs.rows.length > 0) {
    console.log(`Backfilled ${orphanWfs.rows.length} workflows with organization_id`);
  }

  // For approval_groups without org
  const orphanGroups = await client.execute({
    sql: 'SELECT id FROM approval_groups WHERE organization_id IS NULL',
    args: [],
  });
  for (const g of orphanGroups.rows) {
    const gRow = g as Record<string, unknown>;
    await client.execute({
      sql: 'UPDATE approval_groups SET organization_id = ? WHERE id = ?',
      args: [defaultOrgId, gRow.id as string],
    });
  }
  if (orphanGroups.rows.length > 0) {
    console.log(`Backfilled ${orphanGroups.rows.length} approval groups with organization_id`);
  }

  // For approval_requests without org
  const orphanReqs = await client.execute({
    sql: 'SELECT id FROM approval_requests WHERE organization_id IS NULL',
    args: [],
  });
  for (const req of orphanReqs.rows) {
    const reqRow = req as Record<string, unknown>;
    await client.execute({
      sql: 'UPDATE approval_requests SET organization_id = ? WHERE id = ?',
      args: [defaultOrgId, reqRow.id as string],
    });
  }
  if (orphanReqs.rows.length > 0) {
    console.log(`Backfilled ${orphanReqs.rows.length} approval requests with organization_id`);
  }

  console.log('Seed complete.');
}

// Helper: Add columns if they don't already exist
type ColumnSpec = {
  name: string;
  ddl: string;
};

async function ensureColumns(tableName: string, columns: ColumnSpec[]) {
  for (const column of columns) {
    try {
      await client.execute(`ALTER TABLE ${tableName} ADD COLUMN ${column.ddl}`);
      console.log(`[migrations] Added ${tableName}.${column.name}`);
    } catch (error) {
      const message = (error as Error).message.toLowerCase();
      if (message.includes('duplicate column name')) {
        continue;
      }
      // In Turso/SQLite, constraint changes may need different handling
      if (message.includes('cannot add a column with non-constant default')) {
        console.log(`[migrations] Skipped ${tableName}.${column.name} (needs non-constant default)`);
        continue;
      }
      throw error;
    }
  }
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));