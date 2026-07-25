import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import { requireAdmin } from '../middleware/auth';

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users with roles
 *       403:
 *         description: Forbidden (requires admin role)
 *
 * /api/admin/users/{id}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Update user role (admin)
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
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, approver, admin]
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Invalid role
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
const router = Router();

// GET /api/admin/users
router.get('/users', requireAdmin, adminController.listUsers);

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', requireAdmin, adminController.updateUserRole);

export default router;