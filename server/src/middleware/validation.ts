import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: 'Validation failed.',
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

// Column schema
const columnSchema = z.object({
  label: z.string().min(1, 'Column label is required.'),
  columnType: z.enum(['text', 'long_text', 'single_choice', 'multiple_choice', 'date', 'file']),
  isRequired: z.boolean(),
  sortOrder: z.number().int().positive(),
  options: z.array(z.string().min(1)).nullable(),
});

// Workflow schemas
export const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required.'),
  description: z.string().optional().default(''),
  status: z.enum(['draft', 'active', 'archived']).optional().default('draft'),
  categoryId: z.string().nullable().optional().default(null),
  instructions: z.string().nullable().optional().default(null),
  slots: z
    .array(
      z.object({
        groupId: z.string().min(1),
        resolutionMode: z.enum(['first', 'all']),
      }),
    )
    .optional()
    .default([]),
  columns: z.array(columnSchema).optional().default([]),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  categoryId: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  slots: z
    .array(
      z.object({
        groupId: z.string().min(1),
        resolutionMode: z.enum(['first', 'all']),
      }),
    )
    .optional(),
  steps: z
    .array(
      z.object({
        approverId: z.string().min(1),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
  columns: z.array(columnSchema).optional(),
});

// Approval schemas
export const submitApprovalSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required.'),
  fields: z
    .array(
      z.object({
        columnId: z.string().min(1),
        value: z.string().nullable(),
      }),
    )
    .optional()
    .default([]),
});

export const stepActionSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  comment: z.string().optional(),
});

// Approval group schemas
export const createApprovalGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required.'),
  description: z.string().optional().default(''),
  memberIds: z.array(z.string().min(1)).min(1, 'At least one member is required.'),
});

export const updateApprovalGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  memberIds: z.array(z.string().min(1)).min(1).optional(),
});

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required.').max(100),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// User update schemas
export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
});
