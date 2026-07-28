import client from '../config/database';

interface ColumnInput {
  label: string;
  columnType: string;
  isRequired: boolean;
  sortOrder: number;
  options: string[] | null;
}

interface CreateWorkflowParams {
  name: string;
  description: string;
  createdBy: string;
  organizationId: string;
  status?: string;
  categoryId?: string | null;
  instructions?: string | null;
  slots?: { groupId: string; resolutionMode: string }[];
  columns?: ColumnInput[];
}

interface UpdateWorkflowParams {
  name?: string;
  description?: string;
  status?: string;
  categoryId?: string | null;
  instructions?: string | null;
  slots?: { groupId: string; resolutionMode: string }[];
  steps?: { approverId: string; order: number }[];
  columns?: ColumnInput[];
}

function validateColumn(column: ColumnInput, index: number): string | null {
  if (!column.label || !column.label.trim()) {
    return `Column ${index + 1}: label is required.`;
  }
  const validTypes = ['text', 'long_text', 'single_choice', 'multiple_choice', 'date', 'file'];
  if (!validTypes.includes(column.columnType)) {
    return `Column ${index + 1}: invalid columnType "${column.columnType}".`;
  }
  if (column.sortOrder < 1) {
    return `Column ${index + 1}: sortOrder must be positive.`;
  }
  if (column.columnType === 'single_choice' || column.columnType === 'multiple_choice') {
    if (!column.options || !Array.isArray(column.options) || column.options.length === 0) {
      return `Column ${index + 1}: options are required for ${column.columnType}.`;
    }
    for (const opt of column.options) {
      if (!opt || !opt.trim()) {
        return `Column ${index + 1}: options must not contain empty strings.`;
      }
    }
  } else {
    if (column.options !== null && column.options !== undefined) {
      return `Column ${index + 1}: options must be null for columnType "${column.columnType}".`;
    }
  }
  return null;
}

function normalizeColumnOptions(
  columnType: string,
  options: string[] | null | undefined,
): string[] | null {
  if (columnType === 'single_choice' || columnType === 'multiple_choice') {
    return (options || []).map((opt) => opt.trim());
  }
  return null;
}

function columnsMatchExisting(
  existing: Array<Record<string, unknown>>,
  incoming: ColumnInput[],
): boolean {
  if (existing.length !== incoming.length) return false;

  for (let i = 0; i < existing.length; i++) {
    const oldCol = existing[i];
    const newCol = incoming[i];

    const oldLabel = String(oldCol.label || '').trim();
    const oldType = String(oldCol.column_type || '');
    const oldRequiredRaw = oldCol.is_required;
    const oldRequired =
      oldRequiredRaw === true ||
      oldRequiredRaw === 1 ||
      oldRequiredRaw === '1';
    const oldSortOrder = Number(oldCol.sort_order || 0);
    const oldOptionsRaw = oldCol.options as string | null;
    const oldOptions = normalizeColumnOptions(
      oldType,
      oldOptionsRaw ? (JSON.parse(oldOptionsRaw) as string[]) : null,
    );

    const newOptions = normalizeColumnOptions(newCol.columnType, newCol.options);

    if (
      oldLabel !== newCol.label.trim() ||
      oldType !== newCol.columnType ||
      oldRequired !== !!newCol.isRequired ||
      oldSortOrder !== newCol.sortOrder ||
      JSON.stringify(oldOptions) !== JSON.stringify(newOptions)
    ) {
      return false;
    }
  }

  return true;
}

async function attachCategoryName(wfRows: Array<Record<string, unknown>>) {
  if (wfRows.length === 0) return new Map<string, string | null>();

  // Collect all non-null category_ids
  const catIds = wfRows
    .map((r) => (r.category_id as string) || null)
    .filter((id): id is string => id !== null);
  if (catIds.length === 0) return new Map<string, string | null>();

  const placeholders = catIds.map(() => '?').join(', ');
  const catResult = await client.execute({
    sql: `SELECT id, name FROM workflow_categories WHERE id IN (${placeholders})`,
    args: catIds,
  });

  const catMap = new Map<string, string | null>();
  for (const r of catResult.rows) {
    const row = r as Record<string, unknown>;
    catMap.set(row.id as string, row.name as string);
  }
  return catMap;
}

async function attachColumns(wfRows: Array<Record<string, unknown>>) {
  if (wfRows.length === 0) return new Map<string, Array<Record<string, unknown>>>();

  const ids = wfRows.map((r) => r.id as string);
  const placeholders = ids.map(() => '?').join(', ');

  const colsResult = await client.execute({
    sql: `SELECT * FROM workflow_columns
          WHERE workflow_id IN (${placeholders})
          ORDER BY workflow_id, sort_order`,
    args: ids,
  });

  const colsMap = new Map<string, Array<Record<string, unknown>>>();
  for (const c of colsResult.rows) {
    const row = c as Record<string, unknown>;
    const wfId = row.workflow_id as string;
    if (!colsMap.has(wfId)) colsMap.set(wfId, []);
    colsMap.get(wfId)!.push({
      id: row.id,
      workflowId: row.workflow_id,
      label: row.label,
      columnType: row.column_type,
      isRequired: !!row.is_required,
      sortOrder: row.sort_order,
      options: row.options ? JSON.parse(row.options as string) : null,
      createdAt: row.created_at,
    });
  }

  return colsMap;
}

async function attachSlots(wfRows: Array<Record<string, unknown>>) {
  if (wfRows.length === 0) return [];

  const ids = wfRows.map((r) => r.id as string);
  const placeholders = ids.map(() => '?').join(', ');

  const slotsResult = await client.execute({
    sql: `SELECT was.*, ag.name AS group_name, ag.description AS group_description
          FROM workflow_approval_slots was
          JOIN approval_groups ag ON ag.id = was.group_id
          WHERE was.workflow_id IN (${placeholders})
          ORDER BY was.workflow_id, was.slot_order`,
    args: ids,
  });

  const groupIds = slotsResult.rows
    .map((r) => (r as Record<string, unknown>).group_id as string)
    .filter((v, i, a) => a.indexOf(v) === i);
  const memberCounts = new Map<string, number>();
  if (groupIds.length > 0) {
    const mPlaceholders = groupIds.map(() => '?').join(', ');
    const mResult = await client.execute({
      sql: `SELECT group_id, COUNT(*) AS count
            FROM approval_group_members
            WHERE group_id IN (${mPlaceholders})
            GROUP BY group_id`,
      args: groupIds,
    });
    for (const r of mResult.rows) {
      const row = r as Record<string, unknown>;
      memberCounts.set(row.group_id as string, row.count as number);
    }
  }

  const slotsMap = new Map<string, Array<Record<string, unknown>>>();
  for (const s of slotsResult.rows) {
    const row = s as Record<string, unknown>;
    const wfId = row.workflow_id as string;
    if (!slotsMap.has(wfId)) slotsMap.set(wfId, []);
    slotsMap.get(wfId)!.push({
      id: row.id,
      workflowId: row.workflow_id,
      groupId: row.group_id,
      slotOrder: row.slot_order,
      resolutionMode: row.resolution_mode,
      createdAt: row.created_at,
      group: {
        id: row.group_id,
        name: row.group_name,
        description: row.group_description,
        memberCount: memberCounts.get(row.group_id as string) || 0,
      },
    });
  }

  return wfRows.map((row) => {
    const wfId = row.id as string;
    const workflow = formatWorkflow(row);
    const slots = slotsMap.get(wfId) || [];
    return {
      ...workflow,
      steps: workflow.steps,
      slots,
    };
  });
}

export async function listWorkflows(
  orgId: string | null,
  _userRole: string,
  _userId: string,
) {
  let result;
  if (orgId) {
    result = await client.execute({
      sql: 'SELECT * FROM workflows WHERE organization_id = ? ORDER BY created_at DESC',
      args: [orgId],
    });
  } else {
    result = await client.execute(
      'SELECT * FROM workflows ORDER BY created_at DESC',
    );
  }

  const wfRows = result.rows as Array<Record<string, unknown>>;
  const withSlots = await attachSlots(wfRows);
  const colsMap = await attachColumns(wfRows);
  const catMap = await attachCategoryName(wfRows);

  return withSlots.map((wf) => {
    const cols = colsMap.get(wf.id as string) || [];
    return { ...wf, columns: cols, categoryName: catMap.get(wf.categoryId as string) || null };
  });
}

export async function getWorkflowById(workflowId: string) {
  const result = await client.execute({
    sql: 'SELECT * FROM workflows WHERE id = ?',
    args: [workflowId],
  });

  if (result.rows.length === 0) return null;

  const wfRows = [result.rows[0] as Record<string, unknown>];
  const workflows = await attachSlots(wfRows);
  const colsMap = await attachColumns(wfRows);
  const wf = workflows[0];
  const cols = colsMap.get(wf.id as string) || [];
  const catName = await (async () => {
    if (!wf.categoryId) return null;
    const catResult = await client.execute({
      sql: 'SELECT name FROM workflow_categories WHERE id = ?',
      args: [wf.categoryId as string],
    });
    return catResult.rows.length > 0 ? (catResult.rows[0] as Record<string, unknown>).name as string : null;
  })();
  return { ...wf, columns: cols, categoryName: catName };
}

export async function createWorkflow(params: CreateWorkflowParams) {
  if (params.columns) {
    const seenOrders = new Set<number>();
    for (let i = 0; i < params.columns.length; i++) {
      const col = params.columns[i];
      const err = validateColumn(col, i);
      if (err) throw new Error(err);
      if (seenOrders.has(col.sortOrder)) {
        throw new Error(`Column ${i + 1}: duplicate sortOrder ${col.sortOrder}.`);
      }
      seenOrders.add(col.sortOrder);
    }
  }

  const result = await client.execute({
    sql: `INSERT INTO workflows (name, description, created_by, organization_id, status, category_id, instructions)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      params.name,
      params.description || '',
      params.createdBy,
      params.organizationId,
      params.status || 'draft',
      params.categoryId ?? null,
      params.instructions ?? null,
    ],
  });

  const workflow = result.rows[0] as Record<string, unknown>;
  const workflowId = workflow.id as string;

  if (params.slots && params.slots.length > 0) {
    for (let i = 0; i < params.slots.length; i++) {
      const slot = params.slots[i];
      await client.execute({
        sql: `INSERT INTO workflow_approval_slots (workflow_id, group_id, slot_order, resolution_mode)
              VALUES (?, ?, ?, ?)`,
        args: [workflowId, slot.groupId, i + 1, slot.resolutionMode || 'all'],
      });
    }
  }

  if (params.columns && params.columns.length > 0) {
    for (const col of params.columns) {
      await client.execute({
        sql: `INSERT INTO workflow_columns (workflow_id, label, column_type, is_required, sort_order, options)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          workflowId,
          col.label.trim(),
          col.columnType,
          col.isRequired ? 1 : 0,
          col.sortOrder,
          col.options ? JSON.stringify(col.options) : null,
        ],
      });
    }
  }

  return getWorkflowById(workflowId);
}

export async function updateWorkflow(workflowId: string, params: UpdateWorkflowParams) {
  // Build dynamic SET clause for scalar fields
  const scalarSets: string[] = [];
  const scalarArgs: string[] = [];

  if (params.name !== undefined) {
    scalarSets.push('name = ?');
    scalarArgs.push(params.name);
  }
  if (params.description !== undefined) {
    scalarSets.push('description = ?');
    scalarArgs.push(params.description);
  }
  if (params.status !== undefined) {
    scalarSets.push('status = ?');
    scalarArgs.push(params.status);
  }
  if (params.categoryId !== undefined) {
    scalarSets.push('category_id = ?');
    scalarArgs.push((params.categoryId ?? null) as any);
  }
  if (params.instructions !== undefined) {
    scalarSets.push('instructions = ?');
    scalarArgs.push(params.instructions as string);
  }

  if (scalarSets.length > 0) {
    scalarSets.push("updated_at = datetime('now')");
    scalarArgs.push(workflowId);

    await client.execute({
      sql: `UPDATE workflows SET ${scalarSets.join(', ')} WHERE id = ?`,
      args: scalarArgs,
    });
  }

  if (params.slots !== undefined) {
    await client.execute({
      sql: 'DELETE FROM workflow_approval_slots WHERE workflow_id = ?',
      args: [workflowId],
    });

    for (let i = 0; i < params.slots.length; i++) {
      const slot = params.slots[i];
      await client.execute({
        sql: `INSERT INTO workflow_approval_slots (workflow_id, group_id, slot_order, resolution_mode)
              VALUES (?, ?, ?, ?)`,
        args: [workflowId, slot.groupId, i + 1, slot.resolutionMode || 'all'],
      });
    }
  }

  if (params.columns !== undefined) {
    const seenOrders = new Set<number>();
    for (let i = 0; i < params.columns.length; i++) {
      const col = params.columns[i];
      const err = validateColumn(col, i);
      if (err) throw new Error(err);
      if (seenOrders.has(col.sortOrder)) {
        throw new Error(`Column ${i + 1}: duplicate sortOrder ${col.sortOrder}.`);
      }
      seenOrders.add(col.sortOrder);
    }

    const existingColumnsResult = await client.execute({
      sql: `SELECT label, column_type, is_required, sort_order, options
            FROM workflow_columns
            WHERE workflow_id = ?
            ORDER BY sort_order`,
      args: [workflowId],
    });

    const incomingColumns = [...params.columns].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const existingColumns = existingColumnsResult.rows as Array<Record<string, unknown>>;
    const hasColumnChanges = !columnsMatchExisting(existingColumns, incomingColumns);

    if (hasColumnChanges) {
      const requestsResult = await client.execute({
        sql: 'SELECT id FROM approval_requests WHERE workflow_id = ? LIMIT 1',
        args: [workflowId],
      });

      if (requestsResult.rows.length > 0) {
        throw new Error('Workflow already has submitted requests. Custom fields cannot be changed.');
      }
    }

    if (hasColumnChanges) {
      await client.execute({
        sql: 'DELETE FROM workflow_columns WHERE workflow_id = ?',
        args: [workflowId],
      });

      for (const col of incomingColumns) {
        await client.execute({
          sql: `INSERT INTO workflow_columns (workflow_id, label, column_type, is_required, sort_order, options)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            workflowId,
            col.label.trim(),
            col.columnType,
            col.isRequired ? 1 : 0,
            col.sortOrder,
            col.options ? JSON.stringify(col.options) : null,
          ],
        });
      }
    }
  }

  if (params.steps) {
    await client.execute({
      sql: 'DELETE FROM workflow_steps WHERE workflow_id = ?',
      args: [workflowId],
    });
    for (const step of params.steps) {
      await client.execute({
        sql: `INSERT INTO workflow_steps (workflow_id, approver_id, step_order)
              VALUES (?, ?, ?)`,
        args: [workflowId, step.approverId, step.order],
      });
    }
  }

  return getWorkflowById(workflowId);
}

export async function deleteWorkflow(workflowId: string) {
  await client.execute({
    sql: 'DELETE FROM workflow_columns WHERE workflow_id = ?',
    args: [workflowId],
  });
  await client.execute({
    sql: 'DELETE FROM workflow_approval_slots WHERE workflow_id = ?',
    args: [workflowId],
  });
  await client.execute({
    sql: 'DELETE FROM workflow_steps WHERE workflow_id = ?',
    args: [workflowId],
  });
  await client.execute({
    sql: 'DELETE FROM workflows WHERE id = ?',
    args: [workflowId],
  });
}

function formatWorkflow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    createdBy: row.created_by as string,
    status: row.status as string,
    categoryId: (row.category_id as string) || null,
    instructions: (row.instructions as string) || null,
    organizationId: (row.organization_id as string) || null,
    steps: [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
