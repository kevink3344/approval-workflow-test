import { Router } from 'express';
import * as workflowController from '../controllers/workflowController';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  validate,
  createWorkflowSchema,
  updateWorkflowSchema,
} from '../middleware/validation';

/**
 * @openapi
 * /api/workflows:
 *   get:
 *     tags: [Workflows]
 *     summary: List all workflows
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workflows with slots and columns
 *       401:
 *         description: Not authenticated
 *
 *   post:
 *     tags: [Workflows]
 *     summary: Create a workflow (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWorkflow'
 *     responses:
 *       201:
 *         description: Workflow created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden (requires admin role)
 *
 * /api/workflows/{id}:
 *   get:
 *     tags: [Workflows]
 *     summary: Get workflow by ID
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
 *         description: Workflow details
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Workflow not found
 *
 *   patch:
 *     tags: [Workflows]
 *     summary: Update a workflow (admin)
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
 *             $ref: '#/components/schemas/UpdateWorkflow'
 *     responses:
 *       200:
 *         description: Workflow updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Workflow not found
 *
 *   delete:
 *     tags: [Workflows]
 *     summary: Delete a workflow (admin)
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
 *         description: Workflow deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Workflow not found
 */
const router = Router();

// GET /api/workflows
router.get('/', requireAuth, workflowController.list);

// GET /api/workflows/:id
router.get('/:id', requireAuth, workflowController.getById);

// POST /api/workflows (admin only)
router.post(
  '/',
  requireAdmin,
  validate(createWorkflowSchema),
  workflowController.create,
);

// PATCH /api/workflows/:id (admin only)
router.patch(
  '/:id',
  requireAdmin,
  validate(updateWorkflowSchema),
  workflowController.update,
);

// DELETE /api/workflows/:id (admin only)
router.delete('/:id', requireAdmin, workflowController.remove);

export default router;