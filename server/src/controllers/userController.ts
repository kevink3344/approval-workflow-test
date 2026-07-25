import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import client from '../config/database';

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await client.execute({
      sql: 'SELECT id, email, name, role, created_at FROM users WHERE id = ?',
      args: [req.params.id],
    });
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }
    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    // Users can only update their own profile
    if (req.user!.userId !== req.params.id) {
      res.status(403).json({ message: 'You can only update your own profile.' });
      return;
    }

    const { name } = req.body;
    const result = await client.execute({
      sql: `UPDATE users SET name = ? WHERE id = ?
            RETURNING id, email, name, role, created_at`,
      args: [name, req.params.id],
    });

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
    });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.userId !== req.params.id) {
      res.status(403).json({ message: 'You can only change your own password.' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const user = await client.execute({
      sql: 'SELECT password_hash FROM users WHERE id = ?',
      args: [req.params.id],
    });
    if (user.rows.length === 0) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash as string);
    if (!valid) {
      res.status(400).json({ message: 'Current password is incorrect.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await client.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [passwordHash, req.params.id],
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}