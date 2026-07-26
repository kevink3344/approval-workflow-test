import { Request, Response, NextFunction } from 'express';
import * as orgService from '../services/organizationService';

// GET /api/organizations
export async function listOrganizations(req: Request, res: Response, next: NextFunction) {
  try {
    const includeUserCount = req.query.includeUserCount === 'true';
    const organizations = await orgService.listOrganizations(includeUserCount);
    res.json(organizations);
  } catch (err) {
    next(err);
  }
}

// GET /api/organizations/:id
export async function getOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await orgService.getOrganizationById(req.params.id);
    if (!org) {
      res.status(404).json({ message: 'Organization not found.' });
      return;
    }
    res.json(org);
  } catch (err) {
    next(err);
  }
}

// POST /api/organizations
export async function createOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, slug, adminEmail, adminName, adminPassword } = req.body;

    if (!name || !slug) {
      res.status(400).json({ message: 'name and slug are required.' });
      return;
    }

    const result = await orgService.createOrganization({
      name,
      slug,
      adminEmail,
      adminName,
      adminPassword,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/organizations/:id
export async function updateOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, isActive } = req.body;
    const result = await orgService.updateOrganization(req.params.id, { name, isActive });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/organizations/:id
export async function deleteOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    await orgService.deleteOrganization(req.params.id);
    res.json({ message: 'Organization and all associated data deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/organizations/:orgId/users
export async function listOrgUsers(req: Request, res: Response, next: NextFunction) {
  try {
    // For org admins, ensure they can only list their own org's users
    if (req.user?.role === 'admin' && req.user.organizationId !== req.params.orgId) {
      res.status(403).json({ message: 'Forbidden: Cannot manage users outside your organization.' });
      return;
    }
    const users = await orgService.listOrganizationUsers(req.params.orgId);
    res.json(users);
  } catch (err) {
    next(err);
  }
}

// POST /api/organizations/:orgId/users
export async function addOrgUser(req: Request, res: Response, next: NextFunction) {
  try {
    // For org admins, ensure they can only add users to their own org
    if (req.user?.role === 'admin' && req.user.organizationId !== req.params.orgId) {
      res.status(403).json({ message: 'Forbidden: Cannot manage users outside your organization.' });
      return;
    }

    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ message: 'email, name, and password are required.' });
      return;
    }

    const user = await orgService.addOrganizationUser(req.params.orgId, {
      email,
      name,
      password,
      role: role || 'user',
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/organizations/:orgId/users/:userId
export async function updateOrgUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'admin' && req.user.organizationId !== req.params.orgId) {
      res.status(403).json({ message: 'Forbidden: Cannot manage users outside your organization.' });
      return;
    }

    const { role } = req.body;
    const user = await orgService.updateOrganizationUser(
      req.params.orgId,
      req.params.userId,
      { role },
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/organizations/:orgId/users/:userId
export async function removeOrgUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'admin' && req.user.organizationId !== req.params.orgId) {
      res.status(403).json({ message: 'Forbidden: Cannot manage users outside your organization.' });
      return;
    }

    await orgService.removeOrganizationUser(req.params.orgId, req.params.userId);
    res.json({ message: 'User removed from organization.' });
  } catch (err) {
    next(err);
  }
}