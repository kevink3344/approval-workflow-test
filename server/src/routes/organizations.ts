import { Router } from 'express';
import * as orgController from '../controllers/organizationController';
import { requireAuth, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// ── Organization CRUD (Super Admin only) ────────────────────────

// GET /api/organizations — list all (super_admin sees all, others see their own)
router.get('/', requireAuth, orgController.listOrganizations);

// POST /api/organizations — create (super_admin only)
router.post('/', requireSuperAdmin, orgController.createOrganization);

// GET /api/organizations/:id — get single
router.get('/:id', requireAuth, orgController.getOrganization);

// PATCH /api/organizations/:id — update (super_admin only)
router.patch('/:id', requireSuperAdmin, orgController.updateOrganization);

// DELETE /api/organizations/:id — delete (super_admin only)
router.delete('/:id', requireSuperAdmin, orgController.deleteOrganization);

// ── Organization User Management ────────────────────────────────

// GET /api/organizations/:orgId/users — list users in org (org admin or super_admin)
router.get('/:orgId/users', requireAuth, orgController.listOrgUsers);

// POST /api/organizations/:orgId/users — add user to org
router.post('/:orgId/users', requireAuth, orgController.addOrgUser);

// PATCH /api/organizations/:orgId/users/:userId — update org user
router.patch('/:orgId/users/:userId', requireAuth, orgController.updateOrgUser);

// DELETE /api/organizations/:orgId/users/:userId — remove org user
router.delete('/:orgId/users/:userId', requireAuth, orgController.removeOrgUser);

export default router;