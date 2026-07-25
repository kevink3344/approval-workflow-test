import bcrypt from 'bcryptjs';
import client from './database';
import { env } from './env';

async function seed() {
  console.log('Seeding database...');

  // Create tables
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
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','approver','admin')),
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

  // Seed super admin if not already present
  const existing = await client.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [env.SUPER_ADMIN_EMAIL],
  });

  if (existing.rows.length === 0) {
    const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 12);
    await client.execute({
      sql: `INSERT INTO users (email, name, password_hash, role)
            VALUES (?, ?, ?, 'admin')`,
      args: [env.SUPER_ADMIN_EMAIL, 'Super Admin', passwordHash],
    });
    console.log(`Super admin created: ${env.SUPER_ADMIN_EMAIL}`);
  } else {
    console.log(`Super admin already exists: ${env.SUPER_ADMIN_EMAIL}`);
  }

  console.log('Seed complete.');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));