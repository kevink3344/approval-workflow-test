import { Router } from 'express';
import * as userController from '../controllers/userController';
import * as adminController from '../controllers/adminController';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  validate,
  updateProfileSchema,
  changePasswordSchema,
} from '../middleware/validation';

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users (admin only)
 *     description: Used for user pickers in the UI.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden (requires admin role)
 *
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *
 *   patch:
 *     tags: [Users]
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *
 * /api/users/{id}/password:
 *   patch:
 *     tags: [Users]
 *     summary: Change user password
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: Validation error or incorrect current password
 *       404:
 *         description: User not found
 */
const router = Router();

// GET /api/users (admin only - for user pickers)
router.get('/', requireAdmin, adminController.listUsers);

// GET /api/users/:id
router.get('/:id', requireAuth, userController.getProfile);

// PATCH /api/users/:id
router.patch(
  '/:id',
  requireAuth,
  validate(updateProfileSchema),
  userController.updateProfile,
);

// PATCH /api/users/:id/password
router.patch(
  '/:id/password',
  requireAuth,
  validate(changePasswordSchema),
  userController.changePassword,
);

export default router;