# Dynamic Category Management — Plan

**Date:** 2026-07-26

**Status:** Draft

**Depends on:** Phase 1 (workflow categories already exist as a hardcoded enum)

---

## Overview

Currently, workflow categories are a hardcoded TypeScript enum (`Finance`, `HR`, `IT`, `Legal`, `Operations`, `Other`). This plan replaces that with a dynamic, admin-managed list stored in the database. Admins can create, rename, reorder, and toggle categories on/off. Categories referenced by existing workflows cannot be deleted.

---

## 1. Data Model

### New Table: `workflow_categories`

| Column | Type | Description |
|---|---|---|
| `id` | TEXT (UUID) | Primary key |
| `name` | TEXT NOT NULL | Display name (e.g., "Finance", "Human Resources") |
| `is_active` | INTEGER NOT NULL DEFAULT 1 | 1 = active (appears in dropdowns), 0 = inactive (hidden but retained) |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | Display order in dropdowns and filter pills |
| `organization_id` | TEXT NOT NULL | FK → `organizations.id`. Categories are scoped per organization. |
| `created_at` | TEXT NOT NULL DEFAULT (datetime('now')) | |
| `updated_at` | TEXT NOT NULL DEFAULT (datetime('now')) | |

**Migration SQL:**
```sql
CREATE TABLE IF NOT EXISTS workflow_categories (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name            TEXT NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, name)
);
```

### Changes to `workflows` Table

Replace the free-text `category` column with a foreign key reference:

```sql
-- Add new FK column
ALTER TABLE workflows ADD COLUMN category_id TEXT REFERENCES workflow_categories(id) ON DELETE SET NULL;

-- Migrate existing data: match existing category strings to seeded categories
-- (handled in seed migration logic)

-- Drop old column after migration completes
-- ALTER TABLE workflows DROP COLUMN category;  (SQLite limitation — handled via table recreation)
```

**Migration strategy for SQLite (Turso):**
1. Add `category_id` column (nullable FK).
2. Run seed to create default categories matching the current enum values.
3. Backfill `category_id` by joining on `workflows.category = workflow_categories.name`.
4. Recreate `workflows` table without the old `category` column.

### Seed Data

Six default categories matching the current enum, all active, scoped to the default organization:

| name | sort_order |
|---|---|
| Finance | 1 |
| HR | 2 |
| IT | 3 |
| Legal | 4 |
| Operations | 5 |
| Other | 6 |

---

## 2. TypeScript Types

### Server (`server/src/types/index.ts`)

```ts
export interface WorkflowCategory {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Update the `Workflow` interface:
```ts
export interface Workflow {
  // ... existing fields ...
  categoryId: string | null;
  categoryName?: string | null;  // populated on read via JOIN
  // remove: category: string;
}
```

### Client (`client/src/types/index.ts`)

```ts
export interface WorkflowCategory {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

Update `Workflow`:
```ts
export interface Workflow {
  // ... existing fields ...
  categoryId: string | null;
  categoryName?: string | null;
  // remove: category: WorkflowCategory;
}
```

Remove the hardcoded `WorkflowCategory` type and `workflowCategories` constant — they'll be replaced by API-fetched data.

---

## 3. API Endpoints

All endpoints are admin-only except `GET /api/categories` (authenticated users can list active categories for dropdowns).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/categories` | Auth | List categories for the user's organization. Admins see all (including inactive). Regular users see only `is_active = 1`. Sorted by `sort_order`. |
| `POST` | `/api/categories` | Admin | Create a new category. Body: `{ name, isActive?, sortOrder? }`. |
| `GET` | `/api/categories/:id` | Auth | Get a single category. |
| `PATCH` | `/api/categories/:id` | Admin | Update a category. Body: `{ name?, isActive?, sortOrder? }`. |
| `DELETE` | `/api/categories/:id` | Admin | Delete a category. **Blocked** if any workflow references it. Returns 409 with a message listing the workflow count. |

### Request/Response Examples

**POST /api/categories**
```json
// Request
{
  "name": "Marketing",
  "isActive": true,
  "sortOrder": 7
}

// Response (201)
{
  "id": "a1b2c3d4...",
  "name": "Marketing",
  "isActive": true,
  "sortOrder": 7,
  "organizationId": "...",
  "createdAt": "2026-07-26T...",
  "updatedAt": "2026-07-26T..."
}
```

**DELETE /api/categories/:id** (blocked — in use)
```json
// Response (409)
{
  "message": "Cannot delete category 'Finance': it is assigned to 3 workflow(s). Deactivate the category instead, or reassign those workflows first."
}
```

---

## 4. Swagger Documentation

Add a new `Categories` tag to the OpenAPI spec in `server/src/config/swagger.ts`:

```ts
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
 *         id: { type: string }
 *         name: { type: string }
 *         isActive: { type: boolean }
 *         sortOrder: { type: integer }
 *         organizationId: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 * /api/categories:
 *   get:
 *     tags: [Categories]
 *     summary: List workflow categories
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Array of categories (active only for non-admins)
 *   post:
 *     tags: [Categories]
 *     summary: Create a category (admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               isActive: { type: boolean }
 *               sortOrder: { type: integer }
 *     responses:
 *       201: { description: Created }

 * /api/categories/{id}:
 *   get:
 *     tags: [Categories]
 *     summary: Get a category
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path, name: id, required: true, schema: { type: string }
 *     responses:
 *       200: { description: Category object }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Categories]
 *     summary: Update a category (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path, name: id, required: true, schema: { type: string }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Categories]
 *     summary: Delete a category (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path, name: id, required: true, schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       409: { description: In use, cannot delete }
 */
```

---

## 5. Backend Implementation

### New Files

| File | Purpose |
|---|---|
| `server/src/services/categoryService.ts` | Business logic: CRUD, validation, in-use check |
| `server/src/controllers/categoryController.ts` | Request handlers |
| `server/src/routes/categories.ts` | Route definitions + Swagger comments |

### Existing Files to Modify

| File | Changes |
|---|---|
| `server/src/app.ts` | Import and mount `categoryRoutes` at `/api/categories` |
| `server/src/types/index.ts` | Add `WorkflowCategory` interface; update `Workflow` to use `categoryId` + `categoryName` |
| `server/src/config/seed.ts` | Add `workflow_categories` table; seed 6 default categories; migrate `workflows.category` → `category_id` |
| `server/src/middleware/validation.ts` | Add `createCategorySchema` and `updateCategorySchema` (Zod) |
| `server/src/services/workflowService.ts` | Update `createWorkflow()` and `updateWorkflow()` to accept `categoryId` instead of `category` string; JOIN `workflow_categories` on read to populate `categoryName` |
| `server/src/config/swagger.ts` | Register `WorkflowCategory` schema, add `Categories` tag and paths |

### In-Use Check Logic

```ts
// In categoryService.ts
export async function deleteCategory(categoryId: string, orgId: string) {
  // Check if any workflows use this category
  const usageCheck = await client.execute({
    sql: 'SELECT COUNT(*) AS count FROM workflows WHERE category_id = ? AND organization_id = ?',
    args: [categoryId, orgId],
  });
  const count = (usageCheck.rows[0] as Record<string, unknown>).count as number;

  if (count > 0) {
    throw new Error(
      `Cannot delete this category: it is assigned to ${count} workflow(s). Deactivate the category instead, or reassign those workflows first.`
    );
  }

  await client.execute({
    sql: 'DELETE FROM workflow_categories WHERE id = ? AND organization_id = ?',
    args: [categoryId, orgId],
  });
}
```

---

## 6. Frontend Implementation

### New Files

| File | Purpose |
|---|---|
| `client/src/pages/Categories.tsx` | Admin page for managing categories (table with inline edit, add, toggle active, delete) |

### Existing Files to Modify

| File | Changes |
|---|---|
| `client/src/types/index.ts` | Add `WorkflowCategory` interface; update `Workflow` to use `categoryId` + `categoryName`; remove hardcoded `WorkflowCategory` type and `workflowCategories` constant |
| `client/src/pages/Workflows.tsx` | Fetch categories from `/api/categories`; populate dropdown + filter pills from API data |
| `client/src/pages/WorkflowEdit.tsx` | Fetch categories from API for the dropdown |
| `client/src/pages/WorkflowDetail.tsx` | Display `categoryName` instead of `category` |
| `client/src/components/Layout.tsx` | Add "Categories" nav link (admin only) |
| `client/src/App.tsx` | Add route for `/categories` |

### Categories Management Page (`Categories.tsx`)

- **Table** with columns: Name, Sort Order, Status (Active/Inactive badge), Actions
- **Inline add row** at top: name input + sort order input + "Add" button
- **Inline edit**: click a row to edit name or sort order; save/cancel buttons
- **Toggle**: active/inactive toggle switch per row
- **Delete**: trash icon; confirmation dialog; error toast if in use
- **Empty state**: "No categories yet. Add your first category above."
- **Reordering**: drag handles or up/down arrow buttons (stretch goal — could also just use sort_order number inputs)

### Dropdown & Filter Changes

Remove hardcoded imports and replace with API-fetched data:

```tsx
// Before (hardcoded)
import { workflowCategories } from '../types';

// After (dynamic)
const { data: categories } = useApi<WorkflowCategory[]>('/categories');
const activeCategories = categories?.filter(c => c.isActive) ?? [];
```

---

## 7. Implementation Order

### Step 1 — Database & Types
1. Add `workflow_categories` table to `seed.ts` with seed data.
2. Add `category_id` column to `workflows` table.
3. Write migration to backfill `category_id` from old `category` column.
4. Recreate `workflows` table without the old `category` column.
5. Update server and client TypeScript types.

### Step 2 — Backend CRUD
6. Create `categoryService.ts` with `listCategories`, `getCategoryById`, `createCategory`, `updateCategory`, `deleteCategory`.
7. Create `categoryController.ts`.
8. Create `routes/categories.ts` with Swagger JSDoc comments.
9. Add Zod validation schemas for create/update.
10. Mount routes in `app.ts`.
11. Update `workflowService.ts` to use `category_id` + JOIN for `categoryName`.

### Step 3 — Frontend
12. Update `client/src/types/index.ts` — remove hardcoded types, add API types.
13. Update `Workflows.tsx` — fetch categories from API for dropdown + filter pills.
14. Update `WorkflowEdit.tsx` — fetch categories from API.
15. Update `WorkflowDetail.tsx` — display `categoryName`.
16. Build `Categories.tsx` admin management page.
17. Add route in `App.tsx` and nav link in `Layout.tsx`.

### Step 4 — Verify
18. Run `npm run db:seed` to apply migrations.
19. Test all CRUD endpoints via Swagger UI.
20. Test frontend: create workflow with new category, filter by category, toggle category active/inactive, attempt delete on in-use category.

---

## 8. Validation Schemas (Zod)

```ts
// server/src/middleware/validation.ts

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
```

---

## 9. Resolved Design Decisions

1. **Organization scoping:** ✅ Per-organization — each org manages its own categories. The `organization_id` FK enforces this.

2. **Default "Other" category:** ✅ Normal seeded row — admins can rename or deactivate it, but the seed ensures it always exists as a fallback. If deleted, workflows that had it get `category_id = NULL`.

3. **Reordering UX:** ✅ Number inputs in the table. Drag-and-drop can be added later as a polish item.

4. **Migration path for existing `category` column:** ✅ Seed the six default categories into `workflow_categories`, then backfill `workflows.category_id` by matching on name. Recreate the `workflows` table to drop the old `category` text column.

5. **Inactive categories in existing workflows:** ✅ The category name is populated via JOIN. Inactive categories still exist in the DB; the name will display normally. They just won't appear in the create/edit dropdown or filter pills.
