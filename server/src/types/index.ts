export type UserRole = 'user' | 'approver' | 'admin' | 'super_admin';

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

export type WorkflowStatus = 'draft' | 'active' | 'archived';

export type ResolutionMode = 'first' | 'all';

export type ColumnType = 'text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'date' | 'file';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userCount?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  organizationId: string | null;
  organizationName?: string | null;
  createdAt: Date;
}

// ---- Approval Groups ---- //

export interface ApprovalGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  members?: User[]; // populated on read
}

export interface ApprovalGroupMember {
  id: string;
  groupId: string;
  userId: string;
  addedAt: Date;
}

// ---- Workflow Categories ---- //

export interface WorkflowCategory {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---- Workflows (updated) ---- //

export interface Workflow {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  status: WorkflowStatus;
  categoryId: string | null;
  categoryName?: string | null;
  instructions: string | null;
  organizationId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  slots?: WorkflowApprovalSlot[]; // populated on read (replaces steps)
  columns?: WorkflowColumn[]; // populated on read
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  order: number;
  approverId: string;
}

export interface WorkflowApprovalSlot {
  id: string;
  workflowId: string;
  groupId: string;
  slotOrder: number;
  resolutionMode: ResolutionMode;
  createdAt: Date;
  group?: ApprovalGroup; // populated on read
}

export interface WorkflowColumn {
  id: string;
  workflowId: string;
  label: string;
  columnType: ColumnType;
  isRequired: boolean;
  sortOrder: number;
  options: string[] | null;
  createdAt: Date;
}

// ---- Approval Requests (updated) ---- //

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  requesterId: string;
  status: ApprovalRequestStatus;
  organizationId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  fields?: ApprovalRequestField[]; // populated on read
}

export interface ApprovalStep {
  id: string;
  requestId: string;
  slotOrder: number;
  groupId: string;
  approverId: string;
  resolutionMode: ResolutionMode;
  stepOrder: number;
  status: ApprovalStepStatus;
  comment?: string;
  actedAt?: Date;
}

export interface ApprovalRequestField {
  id: string;
  requestId: string;
  columnId: string;
  value: string | null;
  fileData: Buffer | null;
  fileMimeType: string | null;
  createdAt: Date;
  // Populated on read from join:
  label?: string;
  columnType?: ColumnType;
}

// JWT payload
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
}