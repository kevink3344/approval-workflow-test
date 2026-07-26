import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import client from '../config/database';

async function getDefaultOrgId(): Promise<string | null> {
  const result = await client.execute("SELECT id FROM organizations WHERE slug = 'default' LIMIT 1");
  if (result.rows.length === 0) return null;
  return result.rows[0].id as string;
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password, organizationId } = req.body;

    // If no organizationId provided, try to assign to default org
    const targetOrgId = organizationId || await getDefaultOrgId();
    const result = await authService.registerUser(name, email, password, targetOrgId || undefined);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginSelect(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ message: 'userId is required.' });
      return;
    }
    const result = await authService.loginUserById(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await authService.listUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response) {
  // JWT is stateless — client removes the token
  res.json({ message: 'Logged out successfully.' });
}