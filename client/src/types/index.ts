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

// ---- Organizations ---- //
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
}

// ---- User & Auth ---- //
export type UserRole = 'user' | 'approver' | 'admin' | 'super_admin';

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string | null;
  organizationName?: string | null;
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
  createdAt: string;
  updatedAt: string;
  members?: { id: string; email: string; name: string; role: string }[];
  organizationId?: string | null;
}

// ---- Workflows ---- //
export type WorkflowStatus = 'draft' | 'active' | 'archived';
export type ResolutionMode = 'first' | 'all';
export type ColumnType = 'text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'date' | 'file';

export interface ApprovalSlotConfig {
  id?: string;
  groupId: string;
  resolutionMode: ResolutionMode;
  slotOrder?: number;
}

export interface WorkflowColumn {
  id: string;
  workflowId: string;
  label: string;
  columnType: ColumnType;
  isRequired: boolean;
  sortOrder: number;
  options: string[] | null;
  createdAt: string;
}

export interface WorkflowApprovalSlot {
  id: string;
  workflowId: string;
  groupId: string;
  slotOrder: number;
  resolutionMode: ResolutionMode;
  createdAt: string;
  group?: {
    id: string;
    name: string;
    description: string;
    memberCount: number;
  };
}

export interface WorkflowCategory {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  status: WorkflowStatus;
  categoryId: string | null;
  categoryName: string | null;
  instructions: string | null;
  steps?: { id: string; order: number; approverId: string; approverName?: string }[];
  slots?: WorkflowApprovalSlot[];
  columns?: WorkflowColumn[];
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Approval Requests ---- //
export type ApprovalStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'cancelled';

export const statusLabel: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const statusBadgeVariant: Record<ApprovalStatus, 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'slate'> = {
  pending: 'amber',
  in_review: 'blue',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
};

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
  status: string;
  comment?: string;
  actedAt?: string;
}

export interface ApprovalRequestField {
  id: string;
  requestId: string;
  columnId: string;
  label: string;
  columnType: ColumnType;
  value: string | null;
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  workflowName: string;
  requesterId: string;
  requesterName?: string;
  status: ApprovalStatus;
  steps?: ApprovalStep[];
  fields?: ApprovalRequestField[];
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;
}