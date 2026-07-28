import { Router } from 'express';
import * as categoryController from '../controllers/categoryController';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createCategorySchema, updateCategorySchema } from '../middleware/validation';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Categories
 *     description: Workflow category management (admin)
 *
 * components:
 *   schemas:
 *     WorkflowCategory:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         isActive:
 *           type: boolean
 *         sortOrder:
 *           type: integer
 *         organizationId:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 * /api/categories:
 *   get:
 *     tags: [Categories]
 *     summary: List workflow categories
 *     description: Admins see all categories (including inactive). Regular users see only active categories.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of categories sorted by sortOrder
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WorkflowCategory'
 *       401:
 *         description: Authentication required
 *
 *   post:
 *     tags: [Categories]
 *     summary: Create a workflow category (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               sortOrder:
 *                 type: integer
 *                 default: 0
 *     responses:
 *       201:
 *         description: Created category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkflowCategory'
 *       400:
 *         description: Validation error or duplicate name
 *       403:
 *         description: Admin access required
 *
 * /api/categories/{id}:
 *   get:
 *     tags: [Categories]
 *     summary: Get a single category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkflowCategory'
 *       404:
 *         description: Category not found
 *
 *   patch:
 *     tags: [Categories]
 *     summary: Update a category (admin)
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
 *               isActive:
 *                 type: boolean
 *               sortOrder:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Updated category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkflowCategory'
 *       400:
 *         description: Validation error or duplicate name
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Category not found
 *
 *   delete:
 *     tags: [Categories]
 *     summary: Delete a category (admin)
 *     description: Cannot delete a category that is assigned to one or more workflows.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Category not found
 *       409:
 *         description: Category is in use by one or more workflows
 */

// GET /api/categories
router.get('/', requireAuth, categoryController.list);

// POST /api/categories (admin)
router.post('/', requireAdmin, validate(createCategorySchema), categoryController.create);

// PATCH /api/categories/reorder (admin — bulk reorder)
// IMPORTANT: Must be before /:id routes, otherwise "reorder" gets captured as an :id parameter
router.patch('/reorder', requireAdmin, categoryController.reorder);

// GET /api/categories/:id
router.get('/:id', requireAuth, categoryController.getById);

// PATCH /api/categories/:id (admin)
router.patch('/:id', requireAdmin, validate(updateCategorySchema), categoryController.update);

// DELETE /api/categories/:id (admin)
router.delete('/:id', requireAdmin, categoryController.remove);

export default router;
