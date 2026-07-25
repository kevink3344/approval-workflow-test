import { Router } from 'express';
import * as settingsController from '../controllers/settingsController';
import { requireAuth, requireAdmin } from '../middleware/auth';

/**
 * @openapi
 * /api/settings/{key}:
 *   get:
 *     tags: [Settings]
 *     summary: Get a setting by key (public)
 *     description: Public endpoint — no auth required. Used for reading login mode, etc.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         example: loginMode
 *     responses:
 *       200:
 *         description: Setting value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                 value:
 *                   type: string
 *                   nullable: true
 *       404:
 *         description: Setting not found
 *
 *   put:
 *     tags: [Settings]
 *     summary: Update a setting (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Setting updated
 *       403:
 *         description: Forbidden (requires admin role)
 *       404:
 *         description: Setting not found
 */
const router = Router();

// GET /api/settings/:key — public (no auth) so login page can read mode
router.get('/:key', settingsController.getSetting);

// PUT /api/settings/:key — admin only
router.put('/:key', requireAuth, requireAdmin, settingsController.updateSetting);

export default router;