import { Router } from 'express';
import * as approvalGroupController from '../controllers/approvalGroupController';
import { requireAdmin } from '../middleware/auth';
import {
  validate,
  createApprovalGroupSchema,
  updateApprovalGroupSchema,
} from '../middleware/validation';

/**
 * @openapi
 * /api/approval-groups:
 *   get:
 *     tags: [Approval Groups]
 *     summary: List all approval groups (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of approval groups
 *       403:
 *         description: Forbidden (requires admin role)
 *
 *   post:
 *     tags: [Approval Groups]
 *     summary: Create an approval group (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateApprovalGroup'
 *     responses:
 *       201:
 *         description: Approval group created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden (requires admin role)
 *
 * /api/approval-groups/{id}:
 *   get:
 *     tags: [Approval Groups]
 *     summary: Get approval group by ID (admin)
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
 *         description: Approval group details
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Group not found
 *
 *   patch:
 *     tags: [Approval Groups]
 *     summary: Update an approval group (admin)
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
 *             $ref: '#/components/schemas/UpdateApprovalGroup'
 *     responses:
 *       200:
 *         description: Approval group updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Group not found
 *
 *   delete:
 *     tags: [Approval Groups]
 *     summary: Delete an approval group (admin)
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
 *         description: Approval group deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Group not found
 */
const router = Router();

// All approval group routes are admin-only
router.get('/', requireAdmin, approvalGroupController.list);
router.post('/', requireAdmin, validate(createApprovalGroupSchema), approvalGroupController.create);
router.get('/:id', requireAdmin, approvalGroupController.getById);
router.patch('/:id', requireAdmin, validate(updateApprovalGroupSchema), approvalGroupController.update);
router.delete('/:id', requireAdmin, approvalGroupController.remove);

export default router;