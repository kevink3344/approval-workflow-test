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
  slots?: { groupId: string; resolutionMode: string }[];
  columns?: ColumnInput[];
}

interface UpdateWorkflowParams {
  name?: string;
  description?: string;
  slots?: { groupId: string; resolutionMode: string }[];
  steps?: { approverId: string; order: number }[]; // kept for backward compat
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

async function attachSteps(workflowRows: Array<Record<string, unknown>>) {
  if (workflowRows.length === 0) return [];

  const ids = workflowRows.map((r) => r.id as string);
  const placeholders = ids.map(() => '?').join(', ');

  const stepsResult = await client.execute({
    sql: `SELECT id, workflow_id, step_order, approver_id
          FROM workflow_steps
          WHERE workflow_id IN (${placeholders})
          ORDER BY workflow_id, step_order`,
    args: ids,
  });

  const stepsMap = new Map<string, Array<Record<string, unknown>>>();
  for (const s of stepsResult.rows) {
    const wfId = s.workflow_id as string;
    if (!stepsMap.has(wfId)) stepsMap.set(wfId, []);
    stepsMap.get(wfId)!.push(s);
  }

  return workflowRows.map((row) => {
    const wfId = row.id as string;
    const steps = (stepsMap.get(wfId) || []).map((s) => ({
      id: s.id,
      order: s.step_order,
      approverId: s.approver_id,
    }));
    return formatWorkflow(row, steps);
  });
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
    const workflow = formatWorkflow(row, []);
    const slots = slotsMap.get(wfId) || [];
    return {
      ...workflow,
      steps: workflow.steps,
      slots,
    };
  });
}

export async function listWorkflows(_userRole: string, _userId: string) {
  const result = await client.execute(
    'SELECT * FROM workflows ORDER BY created_at DESC',
  );

  const wfRows = result.rows as Array<Record<string, unknown>>;
  const withSlots = await attachSlots(wfRows);
  const colsMap = await attachColumns(wfRows);

  return withSlots.map((wf) => {
    const cols = colsMap.get(wf.id as string) || [];
    return { ...wf, columns: cols };
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
  return { ...wf, columns: cols };
}

export async function createWorkflow(params: CreateWorkflowParams) {
  // Validate columns if provided
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
    sql: `INSERT INTO workflows (name, description, created_by)
          VALUES (?, ?, ?)
          RETURNING *`,
    args: [params.name, params.description || '', params.createdBy],
  });

  const workflow = result.rows[0] as Record<string, unknown>;
  const workflowId = workflow.id as string;

  // Create slots if provided
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

  // Create columns if provided
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
  if (params.name !== undefined || params.description !== undefined) {
    const sets: string[] = [];
    const args: string[] = [];

    if (params.name !== undefined) {
      sets.push('name = ?');
      args.push(params.name);
    }
    if (params.description !== undefined) {
      sets.push('description = ?');
      args.push(params.description);
    }

    sets.push("updated_at = datetime('now')");
    args.push(workflowId);

    await client.execute({
      sql: `UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`,
      args,
    });
  }

  // Handle slots if provided
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

  // Handle columns if provided
  if (params.columns !== undefined) {
    // Validate
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

    // Delete existing columns (cascade will not affect approval_request_fields since we don't cascade)
    await client.execute({
      sql: 'DELETE FROM workflow_columns WHERE workflow_id = ?',
      args: [workflowId],
    });

    // Create new columns
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

  // Handle old-style steps if provided (backward compat)
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
  // Explicitly delete columns first (though CASCADE on FK handles it, being explicit)
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

function formatWorkflow(row: Record<string, unknown>, steps: Array<Record<string, unknown>>) {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    createdBy: row.created_by as string,
    status: row.status as string,
    steps: steps.map((s) => ({
      id: s.id as string,
      order: s.order as number,
      approverId: s.approverId as string,
    })),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}