import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Turso / libsql
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || '',
  TURSO_DATABASE_TOKEN: process.env.TURSO_DATABASE_TOKEN || '',

  // Super Admin seed credentials
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || 'admin@workflow.local',
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || 'permissiongranted12345',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Login Mode (optional env override: 'select' | 'password' | 'maintenance')
  LOGIN_MODE: process.env.LOGIN_MODE?.trim().toLowerCase() || null,
};
