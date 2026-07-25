import client from '../config/database';

interface CreateApprovalGroupParams {
  name: string;
  description: string;
  memberIds: string[];
  createdBy: string;
}

interface UpdateApprovalGroupParams {
  name?: string;
  description?: string;
  memberIds?: string[];
}

function formatGroup(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function attachMembers(
  groups: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  if (groups.length === 0) return [];

  const groupIds = groups.map((g) => g.id as string);
  const placeholders = groupIds.map(() => '?').join(', ');

  const membersResult = await client.execute({
    sql: `SELECT agm.group_id, u.id, u.email, u.name, u.role
          FROM approval_group_members agm
          JOIN users u ON u.id = agm.user_id
          WHERE agm.group_id IN (${placeholders})
          ORDER BY agm.added_at`,
    args: groupIds,
  });

  const membersMap = new Map<string, Array<Record<string, unknown>>>();
  for (const m of membersResult.rows) {
    const gId = m.group_id as string;
    if (!membersMap.has(gId)) membersMap.set(gId, []);
    membersMap.get(gId)!.push({
      id: m.id,
      email: m.email,
      name: m.name,
      role: m.role,
    });
  }

  return groups.map((g) => {
    const gId = g.id as string;
    return {
      ...formatGroup(g),
      members: membersMap.get(gId) || [],
    };
  });
}

export async function listApprovalGroups() {
  const result = await client.execute(
    'SELECT * FROM approval_groups ORDER BY created_at DESC',
  );

  return attachMembers(result.rows as Array<Record<string, unknown>>);
}

export async function getApprovalGroupById(groupId: string) {
  const result = await client.execute({
    sql: 'SELECT * FROM approval_groups WHERE id = ?',
    args: [groupId],
  });

  if (result.rows.length === 0) return null;

  const formatted = await attachMembers([result.rows[0] as Record<string, unknown>]);
  return formatted[0];
}

export async function createApprovalGroup(params: CreateApprovalGroupParams) {
  const result = await client.execute({
    sql: `INSERT INTO approval_groups (name, description, created_by)
          VALUES (?, ?, ?)
          RETURNING *`,
    args: [params.name, params.description || '', params.createdBy],
  });

  const group = result.rows[0] as Record<string, unknown>;
  const groupId = group.id as string;

  // Add members
  for (const userId of params.memberIds) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO approval_group_members (group_id, user_id)
            VALUES (?, ?)`,
      args: [groupId, userId],
    });
  }

  return getApprovalGroupById(groupId);
}

export async function updateApprovalGroup(
  groupId: string,
  params: UpdateApprovalGroupParams,
) {
  // Update group fields
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

    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      args.push(groupId);

      await client.execute({
        sql: `UPDATE approval_groups SET ${sets.join(', ')} WHERE id = ?`,
        args,
      });
    }
  }

  // Update members if provided
  if (params.memberIds) {
    // Remove existing members
    await client.execute({
      sql: 'DELETE FROM approval_group_members WHERE group_id = ?',
      args: [groupId],
    });

    // Add new members
    for (const userId of params.memberIds) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO approval_group_members (group_id, user_id)
              VALUES (?, ?)`,
        args: [groupId, userId],
      });
    }
  }

  return getApprovalGroupById(groupId);
}

export async function deleteApprovalGroup(groupId: string) {
  // Check if group is assigned to any workflow slots
  const slotsCheck = await client.execute({
    sql: `SELECT was.id, w.name AS workflow_name
          FROM workflow_approval_slots was
          JOIN workflows w ON w.id = was.workflow_id
          WHERE was.group_id = ?`,
    args: [groupId],
  });

  if (slotsCheck.rows.length > 0) {
    const workflows = slotsCheck.rows
      .map((r) => (r as Record<string, unknown>).workflow_name as string)
      .join(', ');
    throw new Error(
      `Cannot delete group: it is assigned to the following workflows: ${workflows}. Remove the group from these workflows first.`,
    );
  }

  // Delete members (cascade), then group
  await client.execute({
    sql: 'DELETE FROM approval_groups WHERE id = ?',
    args: [groupId],
  });
}

export async function getGroupsAssignedToWorkflow(workflowId: string) {
  const result = await client.execute({
    sql: `SELECT was.*, ag.name AS group_name
          FROM workflow_approval_slots was
          JOIN approval_groups ag ON ag.id = was.group_id
          WHERE was.workflow_id = ?
          ORDER BY was.slot_order`,
    args: [workflowId],
  });

  return (result.rows as Array<Record<string, unknown>>).map((r) => ({
    id: r.id,
    workflowId: r.workflow_id,
    groupId: r.group_id,
    slotOrder: r.slot_order,
    resolutionMode: r.resolution_mode,
    createdAt: r.created_at,
    groupName: r.group_name,
  }));
}