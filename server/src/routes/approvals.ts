import { Router } from 'express';
import * as approvalController from '../controllers/approvalController';
import { requireAuth } from '../middleware/auth';
import {
  validate,
  submitApprovalSchema,
  stepActionSchema,
} from '../middleware/validation';

/**
 * @openapi
 * /api/approvals:
 *   get:
 *     tags: [Approvals]
 *     summary: List approval requests
 *     description: Returns approval requests for the current user. Admins see all requests.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of approval requests
 *       401:
 *         description: Not authenticated
 *
 *   post:
 *     tags: [Approvals]
 *     summary: Submit a new approval request
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitApproval'
 *     responses:
 *       201:
 *         description: Approval request submitted
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *
 * /api/approvals/{id}:
 *   get:
 *     tags: [Approvals]
 *     summary: Get approval request by ID
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
 *         description: Approval request details with fields and steps
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Approval not found
 *
 * /api/approvals/{id}/step/{stepId}:
 *   patch:
 *     tags: [Approvals]
 *     summary: Act on an approval step (approve / reject)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: stepId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StepAction'
 *     responses:
 *       200:
 *         description: Step action recorded
 *       400:
 *         description: Invalid action
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Approval or step not found
 *
 * /api/approvals/{id}/cancel:
 *   patch:
 *     tags: [Approvals]
 *     summary: Cancel an approval request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Approval request cancelled
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Approval not found
 */
const router = Router();

// GET /api/approvals
router.get('/', requireAuth, approvalController.list);

// GET /api/approvals/:id
router.get('/:id', requireAuth, approvalController.getById);

// POST /api/approvals
router.post(
  '/',
  requireAuth,
  validate(submitApprovalSchema),
  approvalController.submit,
);

// PATCH /api/approvals/:id/step/:stepId
router.patch(
  '/:id/step/:stepId',
  requireAuth,
  validate(stepActionSchema),
  approvalController.actOnStep,
);

// PATCH /api/approvals/:id/cancel
router.patch('/:id/cancel', requireAuth, approvalController.cancel);

export default router;