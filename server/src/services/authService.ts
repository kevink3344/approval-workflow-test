import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import client from '../config/database';
import type { User, JwtPayload } from '../types';

function generateToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  organizationId?: string,
): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
  const existing = await client.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email.toLowerCase().trim()],
  });
  if (existing.rows.length > 0) {
    throw new Error('A user with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await client.execute({
    sql: `INSERT INTO users (email, name, password_hash, role, organization_id)
          VALUES (?, ?, ?, 'user', ?)
          RETURNING id, email, name, role, organization_id, created_at`,
    args: [email.toLowerCase().trim(), name.trim(), passwordHash, organizationId || null],
  });

  const row = result.rows[0];
  const formatted = {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as User['role'],
    organizationId: (row.organization_id as string) || null,
    createdAt: new Date(row.created_at as string),
  };

  return { user: formatted, token: generateToken(formatted as User) };
}

export async function loginUserById(
  userId: string,
): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
  const result = await client.execute({
    sql: `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.created_at,
                 o.name AS organization_name
          FROM users u
          LEFT JOIN organizations o ON o.id = u.organization_id
          WHERE u.id = ?`,
    args: [userId],
  });

  if (result.rows.length === 0) {
    throw new Error('User not found.');
  }

  const row = result.rows[0];
  const formatted = {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as User['role'],
    organizationId: (row.organization_id as string) || null,
    organizationName: (row.organization_name as string) || null,
    createdAt: new Date(row.created_at as string),
  };

  return { user: formatted, token: generateToken(formatted as User) };
}

export async function listUsers(): Promise<Array<{ id: string; name: string; email: string; role: string; organizationId: string | null }>> {
  const result = await client.execute({
    sql: 'SELECT id, name, email, role, organization_id FROM users ORDER BY name ASC',
    args: [],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as string,
    organizationId: (row.organization_id as string) || null,
  }));
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
  const result = await client.execute({
    sql: `SELECT u.id, u.email, u.name, u.password_hash, u.role, u.organization_id, u.created_at,
                 o.name AS organization_name
          FROM users u
          LEFT JOIN organizations o ON o.id = u.organization_id
          WHERE u.email = ?`,
    args: [email.toLowerCase().trim()],
  });

  if (result.rows.length === 0) {
    throw new Error('Invalid email or password.');
  }

  const row = result.rows[0];
  const valid = await bcrypt.compare(password, row.password_hash as string);
  if (!valid) {
    throw new Error('Invalid email or password.');
  }

  const formatted = {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as User['role'],
    organizationId: (row.organization_id as string) || null,
    organizationName: (row.organization_name as string) || null,
    createdAt: new Date(row.created_at as string),
  };

  return { user: formatted, token: generateToken(formatted as User) };
}

export async function getUserById(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
  const result = await client.execute({
    sql: `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.created_at,
                 o.name AS organization_name
          FROM users u
          LEFT JOIN organizations o ON o.id = u.organization_id
          WHERE u.id = ?`,
    args: [userId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as User['role'],
    organizationId: (row.organization_id as string) || null,
    organizationName: (row.organization_name as string) || null,
    createdAt: new Date(row.created_at as string),
  };
}