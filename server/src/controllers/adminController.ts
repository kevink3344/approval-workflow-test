import { Request, Response, NextFunction } from 'express';
import client from '../config/database';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    // Organization-scoped: only return users from the authenticated user's org
    // unless super_admin who can see all
    const orgId = req.scopedOrganizationId;

    let result;
    if (orgId) {
      result = await client.execute({
        sql: `SELECT id, email, name, role, organization_id, created_at
              FROM users
              WHERE organization_id = ?
              ORDER BY created_at DESC`,
        args: [orgId],
      });
    } else {
      // super_admin with no org filter
      result = await client.execute(
        'SELECT id, email, name, role, organization_id, created_at FROM users ORDER BY created_at DESC',
      );
    }

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        organizationId: row.organization_id || null,
        createdAt: row.created_at,
      })),
    );
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = req.body;
    // super_admin role can only be set by another super_admin (or system)
    const validRoles = ['user', 'approver', 'admin'];
    if (req.user?.role === 'super_admin') {
      validRoles.push('super_admin');
    }
    if (!validRoles.includes(role)) {
      res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      return;
    }

    const result = await client.execute({
      sql: `UPDATE users SET role = ? WHERE id = ?
            RETURNING id, email, name, role, organization_id, created_at`,
      args: [role, req.params.id],
    });

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      organizationId: row.organization_id || null,
      createdAt: row.created_at,
    });
  } catch (err) {
    next(err);
  }
}