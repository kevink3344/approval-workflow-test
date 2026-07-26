import bcrypt from 'bcryptjs';
import client from './database';

async function seedTestUsers() {
  console.log('Seeding test users...');

  // Get the default organization
  const defaultOrg = await client.execute("SELECT id FROM organizations WHERE slug = 'default' LIMIT 1");
  if (defaultOrg.rows.length === 0) {
    console.log('No default organization found — run seed.ts first.');
    return;
  }
  const defaultOrgId = defaultOrg.rows[0].id as string;

  const users = [
    { email: 'alice@workflow.local', name: 'Alice Johnson', password: 'test123456', role: 'user' },
    { email: 'bob@workflow.local', name: 'Bob Smith', password: 'test123456', role: 'approver' },
    { email: 'charlie@workflow.local', name: 'Charlie Brown', password: 'test123456', role: 'user' },
  ];

  for (const user of users) {
    const existing = await client.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [user.email],
    });

    if (existing.rows.length > 0) {
      console.log(`User already exists: ${user.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 12);
    await client.execute({
      sql: `INSERT INTO users (email, name, password_hash, role, organization_id)
            VALUES (?, ?, ?, ?, ?)`,
      args: [user.email, user.name, passwordHash, user.role, defaultOrgId],
    });
    console.log(`Created user: ${user.email} (${user.role}) in Default Organization`);
  }

  console.log('Test users seed complete.');
}

seedTestUsers()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));