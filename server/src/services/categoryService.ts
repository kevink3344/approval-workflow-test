import client from '../config/database';
import type { WorkflowCategory } from '../types';

interface CreateCategoryParams {
  name: string;
  isActive: boolean;
  sortOrder: number;
  organizationId: string;
}

interface UpdateCategoryParams {
  name?: string;
  isActive?: boolean;
  sortOrder?: number;
}

function formatCategory(row: Record<string, unknown>): WorkflowCategory {
  return {
    id: row.id as string,
    name: row.name as string,
    isActive: !!(row.is_active as number),
    sortOrder: row.sort_order as number,
    organizationId: row.organization_id as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function listCategories(orgId: string, includeInactive: boolean) {
  let result;
  if (includeInactive) {
    result = await client.execute({
      sql: 'SELECT * FROM workflow_categories WHERE organization_id = ? ORDER BY sort_order, name',
      args: [orgId],
    });
  } else {
    result = await client.execute({
      sql: "SELECT * FROM workflow_categories WHERE organization_id = ? AND is_active = 1 ORDER BY sort_order, name",
      args: [orgId],
    });
  }
  return (result.rows as Array<Record<string, unknown>>).map(formatCategory);
}

export async function getCategoryById(categoryId: string, orgId: string) {
  const result = await client.execute({
    sql: 'SELECT * FROM workflow_categories WHERE id = ? AND organization_id = ?',
    args: [categoryId, orgId],
  });
  if (result.rows.length === 0) return null;
  return formatCategory(result.rows[0] as Record<string, unknown>);
}

export async function createCategory(params: CreateCategoryParams) {
  // Check for duplicate name within the org
  const dupCheck = await client.execute({
    sql: 'SELECT id FROM workflow_categories WHERE name = ? AND organization_id = ?',
    args: [params.name.trim(), params.organizationId],
  });
  if (dupCheck.rows.length > 0) {
    throw new Error(`A category with the name "${params.name.trim()}" already exists.`);
  }

  const result = await client.execute({
    sql: `INSERT INTO workflow_categories (name, is_active, sort_order, organization_id)
          VALUES (?, ?, ?, ?)
          RETURNING *`,
    args: [
      params.name.trim(),
      params.isActive ? 1 : 0,
      params.sortOrder,
      params.organizationId,
    ],
  });

  return formatCategory(result.rows[0] as Record<string, unknown>);
}

export async function updateCategory(categoryId: string, orgId: string, params: UpdateCategoryParams) {
  const existing = await client.execute({
    sql: 'SELECT * FROM workflow_categories WHERE id = ? AND organization_id = ?',
    args: [categoryId, orgId],
  });
  if (existing.rows.length === 0) {
    throw new Error('Category not found.');
  }

  const sets: string[] = [];
  const args: (string | number)[] = [];

  if (params.name !== undefined) {
    // Check for duplicate name (exclude self)
    const dupCheck = await client.execute({
      sql: 'SELECT id FROM workflow_categories WHERE name = ? AND organization_id = ? AND id != ?',
      args: [params.name.trim(), orgId, categoryId],
    });
    if (dupCheck.rows.length > 0) {
      throw new Error(`A category with the name "${params.name.trim()}" already exists.`);
    }
    sets.push('name = ?');
    args.push(params.name.trim());
  }

  if (params.isActive !== undefined) {
    sets.push('is_active = ?');
    args.push(params.isActive ? 1 : 0);
  }

  if (params.sortOrder !== undefined) {
    sets.push('sort_order = ?');
    args.push(params.sortOrder);
  }

  if (sets.length === 0) {
    return formatCategory(existing.rows[0] as Record<string, unknown>);
  }

  sets.push("updated_at = datetime('now')");
  args.push(categoryId);
  args.push(orgId);

  await client.execute({
    sql: `UPDATE workflow_categories SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
    args,
  });

  const updated = await client.execute({
    sql: 'SELECT * FROM workflow_categories WHERE id = ? AND organization_id = ?',
    args: [categoryId, orgId],
  });

  return formatCategory(updated.rows[0] as Record<string, unknown>);
}

export async function reorderCategories(orgId: string, orders: { id: string; sortOrder: number }[]) {
  for (const item of orders) {
    await client.execute({
      sql: `UPDATE workflow_categories SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`,
      args: [item.sortOrder, item.id, orgId],
    });
  }
}

export async function deleteCategory(categoryId: string, orgId: string) {
  // Check if any workflows use this category
  const usageCheck = await client.execute({
    sql: 'SELECT COUNT(*) AS count FROM workflows WHERE category_id = ? AND organization_id = ?',
    args: [categoryId, orgId],
  });
  const count = (usageCheck.rows[0] as Record<string, unknown>).count as number;

  if (count > 0) {
    throw new Error(
      `Cannot delete this category: it is assigned to ${count} workflow(s). Deactivate the category instead, or reassign those workflows first.`,
    );
  }

  await client.execute({
    sql: 'DELETE FROM workflow_categories WHERE id = ? AND organization_id = ?',
    args: [categoryId, orgId],
  });
}