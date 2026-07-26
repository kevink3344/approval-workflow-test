import bcrypt from 'bcryptjs';
import client from '../config/database';

interface CreateOrganizationParams {
  name: string;
  slug: string;
  adminEmail?: string;
  adminName?: string;
  adminPassword?: string;
}

interface UpdateOrganizationParams {
  name?: string;
  isActive?: boolean;
}

function formatOrganization(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    logoUrl: (row.logo_url as string) || null,
    isActive: !!(row.is_active as number),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function listOrganizations(includeUserCount = false) {
  if (includeUserCount) {
    const result = await client.execute(
      `SELECT o.*, (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) AS user_count
       FROM organizations o
       ORDER BY o.created_at DESC`,
    );
    return result.rows.map((row) => ({
      ...formatOrganization(row as Record<string, unknown>),
      userCount: (row as Record<string, unknown>).user_count as number,
    }));
  }

  const result = await client.execute(
    'SELECT * FROM organizations ORDER BY created_at DESC',
  );
  return result.rows.map((row) => formatOrganization(row as Record<string, unknown>));
}

export async function getOrganizationById(orgId: string) {
  const result = await client.execute({
    sql: `SELECT o.*, (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) AS user_count
          FROM organizations o
          WHERE o.id = ?`,
    args: [orgId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    ...formatOrganization(row),
    userCount: row.user_count as number,
  };
}

export async function createOrganization(params: CreateOrganizationParams) {
  // Check for duplicate name
  const nameCheck = await client.execute({
    sql: 'SELECT id FROM organizations WHERE name = ? COLLATE NOCASE',
    args: [params.name],
  });
  if (nameCheck.rows.length > 0) {
    throw new Error('Organization name already exists.');
  }

  // Check for duplicate slug
  const slugCheck = await client.execute({
    sql: 'SELECT id FROM organizations WHERE slug = ? COLLATE NOCASE',
    args: [params.slug],
  });
  if (slugCheck.rows.length > 0) {
    throw new Error('Organization slug already exists.');
  }

  // Create organization
  const orgResult = await client.execute({
    sql: `INSERT INTO organizations (name, slug)
          VALUES (?, ?)
          RETURNING *`,
    args: [params.name.trim(), params.slug.trim().toLowerCase()],
  });

  const organization = formatOrganization(orgResult.rows[0] as Record<string, unknown>);

  // Create admin user if credentials provided
  let adminUser: Record<string, unknown> | null = null;
  if (params.adminEmail && params.adminPassword) {
    const existingUser = await client.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [params.adminEmail.toLowerCase().trim()],
    });

    if (existingUser.rows.length > 0) {
      // Rollback org creation
      await client.execute({
        sql: 'DELETE FROM organizations WHERE id = ?',
        args: [organization.id],
      });
      throw new Error(`A user with email ${params.adminEmail} already exists.`);
    }

    const passwordHash = await bcrypt.hash(params.adminPassword, 12);
    const adminResult = await client.execute({
      sql: `INSERT INTO users (email, name, password_hash, role, organization_id)
            VALUES (?, ?, ?, 'admin', ?)
            RETURNING id, email, name, role, organization_id, created_at`,
      args: [
        params.adminEmail.toLowerCase().trim(),
        (params.adminName || params.adminEmail).trim(),
        passwordHash,
        organization.id,
      ],
    });

    const adminRow = adminResult.rows[0];
    adminUser = {
      id: adminRow.id,
      email: adminRow.email,
      name: adminRow.name,
      role: adminRow.role,
      organizationId: adminRow.organization_id,
      createdAt: adminRow.created_at,
    };
  }

  return {
    organization: {
      ...organization,
      userCount: adminUser ? 1 : 0,
    },
    adminUser,
  };
}

export async function updateOrganization(orgId: string, params: UpdateOrganizationParams) {
  const existing = await client.execute({
    sql: 'SELECT * FROM organizations WHERE id = ?',
    args: [orgId],
  });

  if (existing.rows.length === 0) {
    throw new Error('Organization not found.');
  }

  const sets: string[] = [];
  const args: (string | number)[] = [];

  if (params.name !== undefined) {
    // Check for duplicate name (exclude self)
    const nameCheck = await client.execute({
      sql: 'SELECT id FROM organizations WHERE name = ? COLLATE NOCASE AND id != ?',
      args: [params.name, orgId],
    });
    if (nameCheck.rows.length > 0) {
      throw new Error('Organization name already exists.');
    }
    sets.push('name = ?');
    args.push(params.name.trim());
  }

  if (params.isActive !== undefined) {
    sets.push('is_active = ?');
    args.push(params.isActive ? 1 : 0);
  }

  if (sets.length === 0) {
    return getOrganizationById(orgId);
  }

  sets.push("updated_at = datetime('now')");
  args.push(orgId);

  await client.execute({
    sql: `UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });

  return getOrganizationById(orgId);
}

export async function deleteOrganization(orgId: string) {
  const existing = await client.execute({
    sql: 'SELECT id FROM organizations WHERE id = ?',
    args: [orgId],
  });

  if (existing.rows.length === 0) {
    throw new Error('Organization not found.');
  }

  // Due to ON DELETE CASCADE on workflows/approval_groups/approval_requests,
  // and ON DELETE SET NULL on users, the delete should cascade properly.
  // But we need to handle users explicitly since they are SET NULL.
  // First, delete all users in this org (or they'd become orphans with NULL org)
  await client.execute({
    sql: 'DELETE FROM users WHERE organization_id = ?',
    args: [orgId],
  });

  // Now delete the organization itself. CASCADE will handle:
  // - workflows (organization_id CASCADE)
  // - approval_groups (organization_id CASCADE)
  // - approval_requests (organization_id CASCADE)
  // - workflow_columns (via workflows CASCADE)
  // - workflow_steps (via workflows CASCADE)
  // - workflow_approval_slots (via workflows CASCADE)
  // - approval_steps (via approval_requests CASCADE)
  // - approval_request_fields (via approval_requests CASCADE)
  // - approval_group_members (via approval_groups CASCADE)
  await client.execute({
    sql: 'DELETE FROM organizations WHERE id = ?',
    args: [orgId],
  });

  return { deleted: true };
}

export async function listOrganizationUsers(orgId: string) {
  // Verify org exists
  const orgCheck = await client.execute({
    sql: 'SELECT id FROM organizations WHERE id = ?',
    args: [orgId],
  });
  if (orgCheck.rows.length === 0) {
    throw new Error('Organization not found.');
  }

  const result = await client.execute({
    sql: `SELECT id, email, name, role, organization_id, created_at
          FROM users
          WHERE organization_id = ?
          ORDER BY created_at DESC`,
    args: [orgId],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as string,
    organizationId: (row.organization_id as string) || null,
    createdAt: new Date(row.created_at as string),
  }));
}

export async function addOrganizationUser(
  orgId: string,
  userData: { email: string; name: string; password: string; role: string },
) {
  // Verify org exists
  const orgCheck = await client.execute({
    sql: 'SELECT id FROM organizations WHERE id = ?',
    args: [orgId],
  });
  if (orgCheck.rows.length === 0) {
    throw new Error('Organization not found.');
  }

  // Check for duplicate email
  const emailCheck = await client.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [userData.email.toLowerCase().trim()],
  });
  if (emailCheck.rows.length > 0) {
    throw new Error('A user with this email already exists.');
  }

  // Validate role
  const validRoles = ['user', 'approver', 'admin'];
  if (!validRoles.includes(userData.role)) {
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  const passwordHash = await bcrypt.hash(userData.password, 12);
  const result = await client.execute({
    sql: `INSERT INTO users (email, name, password_hash, role, organization_id)
          VALUES (?, ?, ?, ?, ?)
          RETURNING id, email, name, role, organization_id, created_at`,
    args: [
      userData.email.toLowerCase().trim(),
      userData.name.trim(),
      passwordHash,
      userData.role,
      orgId,
    ],
  });

  const row = result.rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as string,
    organizationId: (row.organization_id as string) || null,
    createdAt: new Date(row.created_at as string),
  };
}

export async function updateOrganizationUser(
  orgId: string,
  userId: string,
  updates: { role?: string },
) {
  // Verify the user belongs to this org
  const userCheck = await client.execute({
    sql: 'SELECT id FROM users WHERE id = ? AND organization_id = ?',
    args: [userId, orgId],
  });
  if (userCheck.rows.length === 0) {
    throw new Error('User not found in this organization.');
  }

  if (updates.role !== undefined) {
    const validRoles = ['user', 'approver', 'admin'];
    if (!validRoles.includes(updates.role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const result = await client.execute({
      sql: `UPDATE users SET role = ? WHERE id = ?
            RETURNING id, email, name, role, organization_id, created_at`,
      args: [updates.role, userId],
    });

    const row = result.rows[0];
    return {
      id: row.id as string,
      email: row.email as string,
      name: row.name as string,
      role: row.role as string,
      organizationId: (row.organization_id as string) || null,
      createdAt: new Date(row.created_at as string),
    };
  }

  // Just return current state
  const result = await client.execute({
    sql: 'SELECT id, email, name, role, organization_id, created_at FROM users WHERE id = ?',
    args: [userId],
  });
  const row = result.rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as string,
    organizationId: (row.organization_id as string) || null,
    createdAt: new Date(row.created_at as string),
  };
}

export async function removeOrganizationUser(orgId: string, userId: string) {
  const userCheck = await client.execute({
    sql: 'SELECT id FROM users WHERE id = ? AND organization_id = ?',
    args: [userId, orgId],
  });
  if (userCheck.rows.length === 0) {
    throw new Error('User not found in this organization.');
  }

  await client.execute({
    sql: 'DELETE FROM users WHERE id = ? AND organization_id = ?',
    args: [userId, orgId],
  });

  return { removed: true };
}