// ---- Login Mode ---- //
export type LoginMode = 'select' | 'password' | 'maintenance';

export interface SettingResponse {
  key: string;
  value: string;
}

export interface InfoResponse {
  version: string;
  loginModeOverride: LoginMode | null;
}

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

// ---- User & Auth ---- //
export type UserRole = 'user' | 'approver' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

// ---- Approval Groups ---- //
export interface ApprovalGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: UserListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalSlotGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

export interface ApprovalSlotConfig {
  id?: string;
  workflowId?: string;
  groupId: string;
  resolutionMode: 'first' | 'all';
  slotOrder?: number;
  createdAt?: string;
  group?: ApprovalSlotGroup;
}

// ---- Workflows ---- //
export type WorkflowStatus = 'active' | 'archived';

export interface WorkflowStepConfig {
  id: string;
  order: number;
  approverId: string;
  approverName?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  steps: WorkflowStepConfig[];
  slots: ApprovalSlotConfig[];
  columns: WorkflowColumn[];
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

// ---- Approvals ---- //
export type ApprovalRequestStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type ApprovalStepStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'skipped';

export type ResolutionMode = 'first' | 'all';

export type ColumnType = 'text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'date' | 'file';

export interface WorkflowColumn {
  id: string;
  label: string;
  columnType: ColumnType;
  isRequired: boolean;
  sortOrder: number;
  options: string[] | null;
  createdAt?: string;
}

export interface ApprovalRequestField {
  id: string;
  requestId: string;
  columnId: string;
  label: string;
  columnType: ColumnType;
  value: string | null;
}

export interface ApprovalStep {
  id: string;
  requestId: string;
  slotOrder: number;
  groupId: string;
  groupName?: string;
  approverId: string;
  approverName?: string;
  resolutionMode: ResolutionMode;
  stepOrder: number;
  status: ApprovalStepStatus;
  comment?: string;
  actedAt?: string;
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  workflowName: string;
  requesterId: string;
  requesterName: string;
  status: ApprovalRequestStatus;
  steps: ApprovalStep[];
  fields: ApprovalRequestField[];
  createdAt: string;
  updatedAt: string;
}

export interface SubmitApprovalPayload {
  workflowId: string;
  fields: { columnId: string; value: string | null }[];
}

export interface StepActionPayload {
  action: 'approved' | 'rejected';
  comment?: string;
}

// ---- Status badge helpers ---- //
export const statusBadgeVariant: Record<
  ApprovalRequestStatus,
  'blue' | 'amber' | 'green' | 'red' | 'slate'
> = {
  pending: 'amber',
  in_review: 'blue',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
};

export const stepBadgeVariant: Record<
  ApprovalStepStatus,
  'blue' | 'amber' | 'green' | 'red' | 'slate'
> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  skipped: 'slate',
};

export const statusLabel: Record<ApprovalRequestStatus, string> = {
  pending: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const stepStatusLabel: Record<ApprovalStepStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  skipped: 'Skipped',
};