import { Request, Response, NextFunction } from 'express';
import * as categoryService from '../services/categoryService';

import client from '../config/database';

async function getEffectiveOrgId(req: Request): Promise<string | null> {
  // Use scoped org first, then user's org, then fall back to the first available org
  const scopeOrg = req.scopedOrganizationId || req.user?.organizationId || null;
  if (scopeOrg) return scopeOrg;

  // For super_admins without an org, use any existing organization
  if (req.user?.role === 'super_admin') {
    const orgResult = await client.execute("SELECT id FROM organizations WHERE slug = 'default' LIMIT 1");
    if (orgResult.rows.length > 0) {
      return (orgResult.rows[0] as Record<string, unknown>).id as string;
    }
    // Last resort: get any org
    const anyOrg = await client.execute('SELECT id FROM organizations LIMIT 1');
    if (anyOrg.rows.length > 0) {
      return (anyOrg.rows[0] as Record<string, unknown>).id as string;
    }
  }

  return null;
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = await getEffectiveOrgId(req);
    if (!orgId) {
      res.status(400).json({ message: 'Organization context required.' });
      return;
    }
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    const categories = await categoryService.listCategories(orgId, isAdmin);
    res.json(categories);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = await getEffectiveOrgId(req);
    if (!orgId) {
      res.status(400).json({ message: 'Organization context required.' });
      return;
    }
    const category = await categoryService.getCategoryById(req.params.id, orgId);
    if (!category) {
      res.status(404).json({ message: 'Category not found.' });
      return;
    }
    res.json(category);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = await getEffectiveOrgId(req);
    if (!orgId) {
      res.status(400).json({ message: 'Organization context required.' });
      return;
    }
    const category = await categoryService.createCategory({
      name: req.body.name,
      isActive: req.body.isActive,
      sortOrder: req.body.sortOrder,
      organizationId: orgId,
    });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = await getEffectiveOrgId(req);
    if (!orgId) {
      res.status(400).json({ message: 'Organization context required.' });
      return;
    }
    const category = await categoryService.updateCategory(req.params.id, orgId, req.body);
    res.json(category);
  } catch (err) {
    next(err);
  }
}

export async function reorder(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = await getEffectiveOrgId(req);
    if (!orgId) {
      res.status(400).json({ message: 'Organization context required.' });
      return;
    }
    const { orders } = req.body; // [{ id: string, sortOrder: number }]
    if (!orders || !Array.isArray(orders)) {
      res.status(400).json({ message: 'orders array is required.' });
      return;
    }
    await categoryService.reorderCategories(orgId, orders);
    res.json({ message: 'Reordered successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = await getEffectiveOrgId(req);
    if (!orgId) {
      res.status(400).json({ message: 'Organization context required.' });
      return;
    }
    await categoryService.deleteCategory(req.params.id, orgId);
    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
