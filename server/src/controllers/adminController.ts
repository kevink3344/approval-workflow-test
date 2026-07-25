import { Request, Response, NextFunction } from 'express';
import client from '../config/database';

export async function listUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await client.execute(
      'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC',
    );
    res.json(
      result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
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
    const validRoles = ['user', 'approver', 'admin'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      return;
    }

    const result = await client.execute({
      sql: `UPDATE users SET role = ? WHERE id = ?
            RETURNING id, email, name, role, created_at`,
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
      createdAt: row.created_at,
    });
  } catch (err) {
    next(err);
  }
}