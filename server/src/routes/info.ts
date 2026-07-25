import { Router } from 'express';
import { env } from '../config/env';

const router = Router();

const VALID_LOGIN_MODES = ['select', 'password', 'maintenance'] as const;

/**
 * @openapi
 * /api/info:
 *   get:
 *     tags: [Info]
 *     summary: Get application info
 *     description: Returns the API version and login mode override.
 *     security: []
 *     responses:
 *       200:
 *         description: Application information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 loginModeOverride:
 *                   type: string
 *                   nullable: true
 *                   example: "select"
 */
router.get('/', (_req, res) => {
  const loginModeOverride = env.LOGIN_MODE &&
    VALID_LOGIN_MODES.includes(env.LOGIN_MODE as typeof VALID_LOGIN_MODES[number])
    ? env.LOGIN_MODE
    : null;

  res.json({
    version: '1.0.0',
    loginModeOverride,
  });
});

export default router;