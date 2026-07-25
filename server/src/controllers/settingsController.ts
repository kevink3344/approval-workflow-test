import { Request, Response, NextFunction } from 'express';
import client from '../config/database';
import { env } from '../config/env';

const VALID_LOGIN_MODES = ['select', 'password', 'maintenance'] as const;
const ALLOWED_KEYS = new Set(['login_mode', 'maintenance_message']);

export async function getSetting(req: Request, res: Response, next: NextFunction) {
  try {
    const { key } = req.params;

    if (!ALLOWED_KEYS.has(key)) {
      res.status(404).json({ message: 'Setting not found.' });
      return;
    }

    // Env var override for login_mode
    if (key === 'login_mode') {
      const envOverride = env.LOGIN_MODE;
      if (envOverride && VALID_LOGIN_MODES.includes(envOverride as typeof VALID_LOGIN_MODES[number])) {
        res.json({ key: 'login_mode', value: envOverride });
        return;
      }
    }

    const result = await client.execute({
      sql: 'SELECT value FROM app_settings WHERE key = ?',
      args: [key],
    });

    if (result.rows.length === 0) {
      // Return sensible default for login_mode
      const defaultValue = key === 'login_mode' ? 'select' : '';
      res.json({ key, value: defaultValue });
      return;
    }

    res.json({ key, value: result.rows[0].value as string });
  } catch (err) {
    next(err);
  }
}

export async function updateSetting(req: Request, res: Response, next: NextFunction) {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!ALLOWED_KEYS.has(key)) {
      res.status(404).json({ message: 'Setting not found.' });
      return;
    }

    if (!value || typeof value !== 'string') {
      res.status(400).json({ message: 'Value is required and must be a string.' });
      return;
    }

    // Validate login_mode values
    if (key === 'login_mode' && !VALID_LOGIN_MODES.includes(value as typeof VALID_LOGIN_MODES[number])) {
      res.status(400).json({ message: `Invalid login_mode. Must be one of: ${VALID_LOGIN_MODES.join(', ')}.` });
      return;
    }

    await client.execute({
      sql: `INSERT INTO app_settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      args: [key, value],
    });

    res.json({ key, value });
  } catch (err) {
    next(err);
  }
}