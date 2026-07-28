import client from '../config/database';

interface FieldInput {
  columnId: string;
  value: string | null;
}

interface SubmitApprovalParams {
  workflowId: string;
  requesterId: string;
  fields?: FieldInput[];
}

async function attachFieldsAndRequester(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return [];

  const requestIds = rows.map((r) => r.id as string);

  // Fetch all steps for these requests
  const placeholders = requestIds.map(() => '?').join(', ');
  const stepsResult = await client.execute({
    sql: `SELECT s.id, s.request_id, s.slot_order, s.group_id, s.approver_id,
                  s.resolution_mode, s.step_order, s.status, s.comment, s.acted_at,
                  u.name AS approver_name, ag.name AS group_name
           FROM approval_steps s
           LEFT JOIN users u ON u.id = s.approver_id
           LEFT JOIN approval_groups ag ON ag.id = s.group_id
           WHERE s.request_id IN (${placeholders})
           ORDER BY s.request_id, s.slot_order, s.step_order`,
    args: requestIds,
  });

  const stepsMap = new Map<string, Array<Record<string, unknown>>>();
  for (const s of stepsResult.rows) {
    const row = s as Record<string, unknown>;
    const reqId = row.request_id as string;
    if (!stepsMap.has(reqId)) stepsMap.set(reqId, []);
    stepsMap.get(reqId)!.push(row);
  }

  // Fetch fields for these requests
  const fieldsResult = await client.execute({
    sql: `SELECT arf.id, arf.request_id, arf.column_id, arf.value,
                  wc.label, wc.column_type
           FROM approval_request_fields arf
           LEFT JOIN workflow_columns wc ON wc.id = arf.column_id
           WHERE arf.request_id IN (${placeholders})
           ORDER BY arf.created_at`,
    args: requestIds,
  });

  const fieldsMap = new Map<string, Array<Record<string, unknown>>>();
  for (const f of fieldsResult.rows) {
    const row = f as Record<string, unknown>;
    const reqId = row.request_id as string;
    if (!fieldsMap.has(reqId)) fieldsMap.set(reqId, []);
    fieldsMap.get(reqId)!.push(row);
  }

  return rows.map((row) => {
    const reqId = row.id as string;
    const steps = (stepsMap.get(reqId) || []).map((s) => ({
      id: s.id as string,
      requestId: s.request_id as string,
      slotOrder: s.slot_order as number,
      groupId: s.group_id as string,
      groupName: s.group_name as string || undefined,
      approverId: s.approver_id as string,
      approverName: s.approver_name as string || undefined,
      resolutionMode: s.resolution_mode as string,
      stepOrder: s.step_order as number,
      status: s.status as string,
      comment: s.comment as string || undefined,
      actedAt: s.acted_at as string || undefined,
    }));

    const fields = (fieldsMap.get(reqId) || []).map((f) => ({
      id: f.id as string,
      requestId: f.request_id as string,
      columnId: f.column_id as string,
      label: (f.label as string) || '(column removed)',
      columnType: (f.column_type as string) || 'text',
      value: f.value as string | null,
    }));

    return {
      id: row.id as string,
      workflowId: row.workflow_id as string,
      workflowName: (row.workflow_name as string) || 'Unknown Workflow',
      requesterId: row.requester_id as string,
      requesterName: (row.requester_name as string) || undefined,
      status: row.status as string,
      steps,
      fields,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  });
}

export async function listApprovals(userId: string, userRole: string, orgId: string | null) {
  let result;

  if (userRole === 'super_admin' && !orgId) {
    // Super admin sees all
    result = await client.execute(
      `SELECT ar.*, w.name AS workflow_name, u.name AS requester_name
       FROM approval_requests ar
       JOIN workflows w ON w.id = ar.workflow_id
       LEFT JOIN users u ON u.id = ar.requester_id
       ORDER BY ar.created_at DESC`,
    );
  } else if (orgId) {
    // Scoped to organization (admin within org or super_admin viewing specific org)
    if (userRole === 'admin' || userRole === 'super_admin') {
      result = await client.execute({
        sql: `SELECT ar.*, w.name AS workflow_name, u.name AS requester_name
             FROM approval_requests ar
             JOIN workflows w ON w.id = ar.workflow_id
             LEFT JOIN users u ON u.id = ar.requester_id
             WHERE ar.organization_id = ?
             ORDER BY ar.created_at DESC`,
        args: [orgId],
      });
    } else {
      result = await client.execute({
        sql: `SELECT DISTINCT ar.*, w.name AS workflow_name, u.name AS requester_name
              FROM approval_requests ar
              JOIN workflows w ON w.id = ar.workflow_id
              LEFT JOIN users u ON u.id = ar.requester_id
              LEFT JOIN approval_steps ast ON ast.request_id = ar.id
              WHERE ar.organization_id = ? AND (ar.requester_id = ? OR ast.approver_id = ?)
              ORDER BY ar.created_at DESC`,
        args: [orgId, userId, userId],
      });
    }
  } else {
    // Fallback (shouldn't normally happen for non-super_admin users)
    result = await client.execute({
      sql: `SELECT DISTINCT ar.*, w.name AS workflow_name, u.name AS requester_name
            FROM approval_requests ar
            JOIN workflows w ON w.id = ar.workflow_id
            LEFT JOIN users u ON u.id = ar.requester_id
            LEFT JOIN approval_steps ast ON ast.request_id = ar.id
            WHERE ar.requester_id = ? OR ast.approver_id = ?
            ORDER BY ar.created_at DESC`,
      args: [userId, userId],
    });
  }

  return attachFieldsAndRequester(result.rows as Array<Record<string, unknown>>);
}

export async function getApprovalById(approvalId: string) {
  const result = await client.execute({
    sql: `SELECT ar.*, w.name AS workflow_name, u.name AS requester_name
          FROM approval_requests ar
          JOIN workflows w ON w.id = ar.workflow_id
          LEFT JOIN users u ON u.id = ar.requester_id
          WHERE ar.id = ?`,
    args: [approvalId],
  });

  if (result.rows.length === 0) return null;

  const formatted = await attachFieldsAndRequester(
    [result.rows[0] as Record<string, unknown>],
  );
  return formatted[0];
}

export async function submitApproval(params: SubmitApprovalParams) {
  // Check workflow status — only active workflows accept submissions
  const wfStatusResult = await client.execute({
    sql: 'SELECT status FROM workflows WHERE id = ?',
    args: [params.workflowId],
  });
  if (wfStatusResult.rows.length === 0) {
    throw new Error('Workflow not found.');
  }
  const wfStatus = (wfStatusResult.rows[0] as Record<string, unknown>).status as string;
  if (wfStatus !== 'active') {
    throw new Error('Cannot submit to a workflow that is not active.');
  }

  // Validate fields against workflow columns if fields are provided
  if (params.fields && params.fields.length > 0) {
    const columns = await client.execute({
      sql: `SELECT * FROM workflow_columns WHERE workflow_id = ? ORDER BY sort_order`,
      args: [params.workflowId],
    });

    const columnMap = new Map<string, Record<string, unknown>>();
    for (const c of columns.rows) {
      const col = c as Record<string, unknown>;
      columnMap.set(col.id as string, col);
    }

    for (const field of params.fields) {
      const col = columnMap.get(field.columnId);
      if (!col) {
        throw new Error(`Column "${field.columnId}" does not belong to this workflow.`);
      }

      const isRequired = !!(col.is_required as number);
      const columnType = col.column_type as string;

      if (isRequired && (!field.value || !field.value.trim())) {
        throw new Error(`Field "${col.label as string}" is required.`);
      }

      // Validate choice types
      if (columnType === 'single_choice' && field.value) {
        const options = col.options ? JSON.parse(col.options as string) as string[] : [];
        if (!options.includes(field.value)) {
          throw new Error(`Value "${field.value}" is not a valid option for "${col.label as string}".`);
        }
      }

      if (columnType === 'multiple_choice' && field.value) {
        const options = col.options ? JSON.parse(col.options as string) as string[] : [];
        let selected: string[];
        try {
          selected = JSON.parse(field.value);
        } catch {
          throw new Error(`Invalid format for multiple_choice field "${col.label as string}".`);
        }
        if (!Array.isArray(selected)) {
          throw new Error(`Invalid format for multiple_choice field "${col.label as string}".`);
        }
        for (const val of selected) {
          if (!options.includes(val)) {
            throw new Error(`Value "${val}" is not a valid option for "${col.label as string}".`);
          }
        }
      }
    }
  }

  // Get workflow slots
  const slots = await client.execute({
    sql: `SELECT was.*, ag.name AS group_name
          FROM workflow_approval_slots was
          JOIN approval_groups ag ON ag.id = was.group_id
          WHERE was.workflow_id = ?
          ORDER BY was.slot_order`,
    args: [params.workflowId],
  });

  // Fallback to legacy steps if no slots defined
  if (slots.rows.length === 0) {
    const steps = await client.execute({
      sql: 'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order',
      args: [params.workflowId],
    });

    if (steps.rows.length === 0) {
      throw new Error('Cannot submit request: workflow has no approval steps or slots.');
    }

    // Get workflow org_id for legacy path
    const wfLegacyResult = await client.execute({
      sql: 'SELECT organization_id FROM workflows WHERE id = ?',
      args: [params.workflowId],
    });
    const wfLegacyOrgId: string | null = wfLegacyResult.rows.length > 0
      ? ((wfLegacyResult.rows[0] as Record<string, unknown>).organization_id as string) || null
      : null;

    // Legacy path: create request and steps
    const reqResult = await client.execute({
      sql: `INSERT INTO approval_requests (workflow_id, requester_id, status, organization_id)
            VALUES (?, ?, 'pending', ?)
            RETURNING *`,
      args: [params.workflowId, params.requesterId, wfLegacyOrgId],
    });

    const request = reqResult.rows[0] as Record<string, unknown>;
    const requestId = request.id as string;

    for (const step of steps.rows) {
      const s = step as Record<string, unknown>;
      await client.execute({
        sql: `INSERT INTO approval_steps (request_id, slot_order, group_id, approver_id, resolution_mode, step_order, status)
              VALUES (?, 0, NULL, ?, 'all', ?, 'pending')`,
        args: [requestId, s.approver_id as string, s.step_order as number],
      });
    }

    await client.execute({
      sql: "UPDATE approval_requests SET status = 'in_review', updated_at = datetime('now') WHERE id = ?",
      args: [requestId],
    });

    // Persist field values
    if (params.fields) {
      for (const field of params.fields) {
        await client.execute({
          sql: `INSERT INTO approval_request_fields (request_id, column_id, value)
                VALUES (?, ?, ?)`,
          args: [requestId, field.columnId, field.value],
        });
      }
    }

    return getApprovalById(requestId);
  }

  // Slot-based path
  const firstSlot = slots.rows[0] as Record<string, unknown>;
  const firstSlotGroupId = firstSlot.group_id as string;

  const membersCheck = await client.execute({
    sql: `SELECT user_id FROM approval_group_members WHERE group_id = ?`,
    args: [firstSlotGroupId],
  });

  if (membersCheck.rows.length === 0) {
    const groupName = firstSlot.group_name as string;
    throw new Error(
      `Cannot submit request: Approval Group "${groupName}" (Slot 1) has no members. Add members to the group before submitting requests.`,
    );
  }

    // Get workflow org_id
    const wfResult = await client.execute({
      sql: 'SELECT organization_id FROM workflows WHERE id = ?',
      args: [params.workflowId],
    });
    const wfOrgId: string | null = wfResult.rows.length > 0
      ? ((wfResult.rows[0] as Record<string, unknown>).organization_id as string) || null
      : null;

    // Create the request
    const reqResult = await client.execute({
      sql: `INSERT INTO approval_requests (workflow_id, requester_id, status, organization_id)
            VALUES (?, ?, 'pending', ?)
            RETURNING *`,
      args: [params.workflowId, params.requesterId, wfOrgId],
    });

  const request = reqResult.rows[0] as Record<string, unknown>;
  const requestId = request.id as string;

  // Generate steps for slot 1 only
  const resolutionMode = firstSlot.resolution_mode as string;
  for (let i = 0; i < membersCheck.rows.length; i++) {
    const m = membersCheck.rows[i] as Record<string, unknown>;
    await client.execute({
      sql: `INSERT INTO approval_steps (request_id, slot_order, group_id, approver_id, resolution_mode, step_order, status)
            VALUES (?, 1, ?, ?, ?, ?, 'pending')`,
      args: [requestId, firstSlotGroupId, m.user_id as string, resolutionMode, i],
    });
  }

  // Update status to in_review
  await client.execute({
    sql: "UPDATE approval_requests SET status = 'in_review', updated_at = datetime('now') WHERE id = ?",
    args: [requestId],
  });

  // Persist field values
  if (params.fields) {
    for (const field of params.fields) {
      // If this field value references a file upload (fieldId), update the existing row
      // to link it to this requestId, otherwise insert a new row
      const uploadCheck = await client.execute({
        sql: `SELECT id FROM approval_request_fields WHERE id = ? AND request_id = '00000000000000000000000000000000'`,
        args: [field.value],
      });
      if (uploadCheck.rows.length > 0) {
        await client.execute({
          sql: `UPDATE approval_request_fields SET request_id = ?, column_id = ? WHERE id = ?`,
          args: [requestId, field.columnId, field.value],
        });
      } else {
        await client.execute({
          sql: `INSERT INTO approval_request_fields (request_id, column_id, value)
                VALUES (?, ?, ?)`,
          args: [requestId, field.columnId, field.value],
        });
      }
    }
  }

  return getApprovalById(requestId);
}

async function advanceToNextSlot(requestId: string, currentSlotOrder: number) {
  const requestResult = await client.execute({
    sql: 'SELECT workflow_id FROM approval_requests WHERE id = ?',
    args: [requestId],
  });

  if (requestResult.rows.length === 0) return;

  const requestRow = requestResult.rows[0] as Record<string, unknown>;
  const workflowId = requestRow.workflow_id as string;

  const nextSlotOrder = currentSlotOrder + 1;

  const nextSlot = await client.execute({
    sql: `SELECT was.* FROM workflow_approval_slots was
          WHERE was.workflow_id = ? AND was.slot_order = ?
          ORDER BY was.slot_order`,
    args: [workflowId, nextSlotOrder],
  });

  if (nextSlot.rows.length === 0) {
    await client.execute({
      sql: "UPDATE approval_requests SET status = 'approved', updated_at = datetime('now') WHERE id = ?",
      args: [requestId],
    });
    return;
  }

  const slot = nextSlot.rows[0] as Record<string, unknown>;
  const slotGroupId = slot.group_id as string;
  const resolutionMode = slot.resolution_mode as string;

  const membersCheck = await client.execute({
    sql: `SELECT user_id FROM approval_group_members WHERE group_id = ?`,
    args: [slotGroupId],
  });

  if (membersCheck.rows.length === 0) {
    const groupName = (slot as Record<string, unknown>).group_name as string || 'Unknown';
    await client.execute({
      sql: "UPDATE approval_requests SET status = 'rejected', updated_at = datetime('now') WHERE id = ?",
      args: [requestId],
    });
    await client.execute({
      sql: `INSERT INTO approval_steps (request_id, slot_order, group_id, approver_id, resolution_mode, step_order, status, comment, acted_at)
            VALUES (?, ?, ?, 'system', ?, 0, 'rejected', 'Auto-rejected: group has no members.', datetime('now'))`,
      args: [requestId, nextSlotOrder, slotGroupId, resolutionMode],
    });
    return;
  }

  for (let i = 0; i < membersCheck.rows.length; i++) {
    const m = membersCheck.rows[i] as Record<string, unknown>;
    await client.execute({
      sql: `INSERT INTO approval_steps (request_id, slot_order, group_id, approver_id, resolution_mode, step_order, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      args: [requestId, nextSlotOrder, slotGroupId, m.user_id as string, resolutionMode, i],
    });
  }
}

async function evaluateSlot(requestId: string, slotOrder: number) {
  const steps = await client.execute({
    sql: `SELECT * FROM approval_steps
          WHERE request_id = ? AND slot_order = ?
          ORDER BY step_order`,
    args: [requestId, slotOrder],
  });

  if (steps.rows.length === 0) return;

  const firstStep = steps.rows[0] as Record<string, unknown>;
  const resolutionMode = firstStep.resolution_mode as string;

  if (resolutionMode === 'first') {
    const hasApproved = steps.rows.some(
      (s) => (s as Record<string, unknown>).status === 'approved',
    );
    const hasRejected = steps.rows.some(
      (s) => (s as Record<string, unknown>).status === 'rejected',
    );

    if (hasApproved) {
      await client.execute({
        sql: `UPDATE approval_steps SET status = 'skipped', acted_at = datetime('now')
              WHERE request_id = ? AND slot_order = ? AND status = 'pending'`,
        args: [requestId, slotOrder],
      });
      await advanceToNextSlot(requestId, slotOrder);
    } else if (hasRejected) {
      await client.execute({
        sql: `UPDATE approval_steps SET status = 'skipped', acted_at = datetime('now')
              WHERE request_id = ? AND slot_order = ? AND status = 'pending'`,
        args: [requestId, slotOrder],
      });
    }
  } else {
    const allApproved = steps.rows.every(
      (s) => (s as Record<string, unknown>).status === 'approved',
    );
    const anyRejected = steps.rows.some(
      (s) => (s as Record<string, unknown>).status === 'rejected',
    );

    if (allApproved) {
      await advanceToNextSlot(requestId, slotOrder);
    } else if (anyRejected) {
      await client.execute({
        sql: `UPDATE approval_steps SET status = 'skipped', acted_at = datetime('now')
              WHERE request_id = ? AND slot_order = ? AND status = 'pending'`,
        args: [requestId, slotOrder],
      });
    }
  }
}

export async function actOnStep(
  requestId: string,
  stepId: string,
  action: 'approved' | 'rejected',
  userId: string,
  comment?: string,
) {
  const step = await client.execute({
    sql: 'SELECT * FROM approval_steps WHERE id = ? AND request_id = ?',
    args: [stepId, requestId],
  });

  if (step.rows.length === 0) {
    throw new Error('Step not found.');
  }

  const stepRow = step.rows[0] as Record<string, unknown>;

  if (stepRow.approver_id !== userId) {
    throw new Error('You are not authorized to act on this step.');
  }

  if (stepRow.status !== 'pending') {
    throw new Error('This step has already been acted upon.');
  }

  await client.execute({
    sql: `UPDATE approval_steps SET status = ?, comment = ?, acted_at = datetime('now')
          WHERE id = ?`,
    args: [action, comment || null, stepId],
  });

  const slotOrder = stepRow.slot_order as number;

  if (action === 'rejected') {
    await client.execute({
      sql: "UPDATE approval_requests SET status = 'rejected', updated_at = datetime('now') WHERE id = ?",
      args: [requestId],
    });
    await client.execute({
      sql: `UPDATE approval_steps SET status = 'skipped', acted_at = datetime('now')
            WHERE request_id = ? AND status = 'pending'`,
      args: [requestId],
    });
  } else {
    await evaluateSlot(requestId, slotOrder);
  }

  return getApprovalById(requestId);
}

export async function cancelApproval(requestId: string, userId: string) {
  const request = await client.execute({
    sql: 'SELECT * FROM approval_requests WHERE id = ?',
    args: [requestId],
  });

  if (request.rows.length === 0) {
    throw new Error('Request not found.');
  }

  const row = request.rows[0] as Record<string, unknown>;

  if (row.requester_id !== userId) {
    throw new Error('Only the requester can cancel this request.');
  }

  if (row.status === 'approved' || row.status === 'cancelled') {
    throw new Error('Cannot cancel a completed or already cancelled request.');
  }

  await client.execute({
    sql: "UPDATE approval_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?",
    args: [requestId],
  });

  await client.execute({
    sql: `UPDATE approval_steps SET status = 'skipped', acted_at = datetime('now')
          WHERE request_id = ? AND status = 'pending'`,
    args: [requestId],
  });

  return getApprovalById(requestId);
}