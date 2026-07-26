import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload } from '../types';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      scopedOrganizationId?: string | null;
    }
  }
}

// Require valid JWT token
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// Require admin role (org-scoped admin or super_admin)
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      res.status(403).json({ message: 'Admin access required.' });
      return;
    }
    next();
  });
}

// Require super admin role
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({ message: 'Super admin access required.' });
      return;
    }
    next();
  });
}

// Require approver or admin role
export function requireApprover(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (
      req.user?.role !== 'approver' &&
      req.user?.role !== 'admin' &&
      req.user?.role !== 'super_admin'
    ) {
      res.status(403).json({ message: 'Approver access required.' });
      return;
    }
    next();
  });
}

// Organization scope middleware — applied globally to enforce data isolation
// For non-super_admin users, sets req.scopedOrganizationId to their organization_id.
// For super_admins, reads optional X-Organization-ID header for cross-org viewing.
export function orgScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    // No user set (shouldn't happen if auth middleware ran, but be safe)
    next();
    return;
  }

  if (req.user.role === 'super_admin') {
    // Super admin can optionally scope to a specific org via header
    const xOrgId = req.headers['x-organization-id'] as string | undefined;
    req.scopedOrganizationId = xOrgId || null; // null = see all
  } else {
    // All other users are scoped to their own organization
    if (!req.user.organizationId) {
      // User has no org — they shouldn't exist in this state (except super_admin)
      _res.status(403).json({ message: 'No organization assigned. Contact a system administrator.' });
      return;
    }
    req.scopedOrganizationId = req.user.organizationId;
  }

  next();
}