# Approval Groups — Implementation Plan

**Date:** 2026-07-25

**Status:** Pending Review

---

## Overview

This plan introduces **Approval Groups** as a new first-class entity in the approval workflow system. Instead of assigning individual approvers directly to workflow steps, Administrators pre-define reusable groups of one or more users. When creating or editing a Workflow, Administrators then attach one or more Approval Groups in a specific order. Each group slot dictates whether the **FIRST** member to act or **ALL** members must act before the workflow advances to the next group.

---

## Requirements Summary

| # | Requirement |
|---|------------|
| R1 | Administrators can **create, read, update, and delete** Approval Groups. |
| R2 | Each Approval Group contains **one or more users** (members). |
| R3 | When creating/editing a Workflow, the Administrator assigns one or more Approval Groups **in a specific order** (slot 1, slot 2, …). |
| R4 | The order is enforced: **all required actions in slot N must be completed before slot N+1 becomes active**. |
| R5 | Each Approval Group (or each slot assignment) has a **resolution mode**: `first` (only the first member to act decides) or `all` (every member must approve). |
| R6 | Only users with the `admin` role can manage Approval Groups. |
| R7 | An Approval Group is **reusable** — it can be assigned to multiple Workflows. |
| R8 | When a request is submitted against a Workflow, it is routed to the members of the first Approval Group slot. |

---

## Data Model Changes

### New Table: `approval_groups`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `name` | TEXT | Display name (e.g. "Initial Approval") |
| `description` | TEXT | Optional description |
| `created_by` | TEXT (FK → users.id) | Admin who created the group |
| `created_at` | TEXT (ISO 8601) | Creation timestamp |
| `updated_at` | TEXT (ISO 8601) | Last update timestamp |

### New Table: `approval_group_members`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `group_id` | TEXT (FK → approval_groups.id) | Parent group |
| `user_id` | TEXT (FK → users.id) | Member user |
| `added_at` | TEXT (ISO 8601) | When the member was added |

*Unique constraint on (`group_id`, `user_id`) — a user cannot be added twice to the same group.*

### New Table: `workflow_approval_slots`

Replaces the simpler `workflow_steps` table (or `WorkflowStep` type in the scaffold plan). Each slot ties an Approval Group to a Workflow at a specific ordinal position with a resolution mode.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `workflow_id` | TEXT (FK → workflows.id) | Parent workflow |
| `group_id` | TEXT (FK → approval_groups.id) | The Approval Group for this step |
| `slot_order` | INTEGER | 1-based ordering (1, 2, 3, …) |
| `resolution_mode` | TEXT | `'first'` or `'all'` |
| `created_at` | TEXT (ISO 8601) | When the slot was created |

*Unique constraint on (`workflow_id`, `slot_order`) — no two slots can have the same order in the same workflow.*

### Updated Table: `approval_steps`

Once an approval request is submitted, the runtime steps are created by expanding each `workflow_approval_slot` against its Approval Group members. The existing `approval_steps` table is updated:

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `request_id` | TEXT (FK → approval_requests.id) | Parent request |
| `slot_order` | INTEGER | Which Workflow slot this step belongs to |
| `group_id` | TEXT (FK → approval_groups.id) | The group at the time of request creation |
| `approver_id` | TEXT (FK → users.id) | Individual approver assigned |
| `resolution_mode` | TEXT | Snapshot of the slot's resolution mode (`'first'` / `'all'`) |
| `status` | TEXT | `'pending'`, `'approved'`, `'rejected'`, `'skipped'` |
| `comment` | TEXT | Optional comment from the approver |
| `acted_at` | TEXT (ISO 8601) | When the approver acted |

### Migration SQL (DDL)

```sql
-- Approval Groups
CREATE TABLE IF NOT EXISTS approval_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Group Members
CREATE TABLE IF NOT EXISTS approval_group_members (
  id        TEXT PRIMARY KEY,
  group_id  TEXT NOT NULL REFERENCES approval_groups(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id),
  added_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, user_id)
);

-- Workflow Approval Slots (replaces old workflow_steps concepts)
CREATE TABLE IF NOT EXISTS workflow_approval_slots (
  id              TEXT PRIMARY KEY,
  workflow_id     TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  group_id        TEXT NOT NULL REFERENCES approval_groups(id),
  slot_order      INTEGER NOT NULL,
  resolution_mode TEXT NOT NULL CHECK(resolution_mode IN ('first', 'all')) DEFAULT 'all',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workflow_id, slot_order)
);

-- Update approval_steps to add slot/group columns
-- (If starting fresh, use the schema above; if migrating, ALTER TABLE ADD COLUMN)
```

---

## ERD Relationships

```
┌──────────┐       ┌──────────────────────┐       ┌─────────────────────┐
│  users   │───<   │ approval_group_members│   >───│  approval_groups    │
└──────────┘       └──────────────────────┘       └─────────────────────┘
                                                            │
                                                     (has many)
                                                            │
                                                    ┌───────┴──────────┐
┌──────────┐       ┌──────────────────────┐       ┌─────────────────────┐
│  users   │───>   │  approval_requests   │        │workflow_approval_   │
└──────────┘       └─────────────────────┬┘        │      slots          │
                                          │         └─────────────────────┘
                                          │                   │
                                          │  (expands into)    │
                                          │                   │
                                          ▼                   │
                                 ┌──────────────────────┐     │
                                 │   approval_steps     │ <───┘
                                 │ (runtime instances)  │
                                 └──────────────────────┘
```

---

## API Endpoints

All endpoints under `/api/approval-groups` are **admin-only** (gated by `authenticateToken` + `req.user.role === 'admin'`).

### Approval Groups CRUD

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/approval-groups` | List all approval groups (admin only). Each returns its members array. |
| `POST` | `/api/approval-groups` | Create a new approval group. Body: `{ name, description, memberIds }`. |
| `GET` | `/api/approval-groups/:id` | Get a single approval group with its members. |
| `PATCH` | `/api/approval-groups/:id` | Update group name, description, or member list. Body: `{ name?, description?, memberIds? }`. |
| `DELETE` | `/api/approval-groups/:id` | Delete a group. Fails with `409` if the group is currently assigned to any Workflow slot (or cascade handles it — decide during implementation). |

### Workflow Endpoints (Updated)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/workflows` | Create workflow. Body extended: `{ name, description, slots: [{ groupId, resolutionMode }] }`. Slots array order maps to `slot_order`. |
| `PATCH` | `/api/workflows/:id` | Update workflow (slots can be reordered, added, removed). |
| `GET` | `/api/workflows/:id` | Returns workflow with expanded slots → each slot includes the group name and member summary. |

### Approval Submission & Processing (Updated)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/approvals` | Submits a request. Server generates `approval_steps` rows for all members of slot 1 only. Slot 1 status becomes `in_review`. |
| `PATCH` | `/api/approvals/:id/step/:stepId` | Approver acts on their step. After the action, the server evaluates the **slot's resolution rules** and advances to the next slot if satisfied. |

---

## Resolution Logic (Slot Advancement)

When an approver acts on a step within a slot:

1. **If `resolution_mode = 'first'`**: As soon as ONE member approves, all other pending steps in that same slot are marked `skipped`. A rejection by any member still rejects the entire slot (and thus the request). The slot is considered complete and the next slot's steps are generated (if any remain).

2. **If `resolution_mode = 'all'`**: ALL members in the slot must `approve`. If ANY member rejects, the slot (and entire request) is rejected. The slot is only complete when every member's step is `approved`.

3. **Rejection is terminal**: Regardless of resolution mode, if any approver in any slot rejects, the entire approval request is marked `rejected`. No further slots are activated.

4. **Final slot completion**: When the last slot is fully resolved (all required approvals obtained), the entire request is marked `approved`.

### Decision Table

| Resolution Mode | Event | Outcome |
|----------------|-------|---------|
| `first` | One member approves | Slot resolved → advance to next slot (or approve request if last) |
| `first` | One member rejects | Slot/request rejected |
| `all` | All members approve | Slot resolved → advance to next slot (or approve request if last) |
| `all` | Any member rejects | Slot/request rejected |
| Either | N/A (pending) | Slot remains `in_review` |

---

## Frontend Pages & Components

### 1. Approval Groups Management Page (`/admin/approval-groups` or part of Admin panel)

- **List view**: Table of all groups with name, member count, and action buttons (Edit, Delete).
- **Create / Edit modal or page**: Form with:
  - Name (text input)
  - Description (textarea, optional)
  - Member selector: multi-select dropdown or checkbox list of all users (exclude the current approach if impractical; use a searchable user picker).
- **Delete**: Confirmation dialog; warns if the group is assigned to workflows.

### 2. Workflow Create / Edit Page (Updated)

When creating or editing a Workflow, the Administrator sees a **Slot Builder** section:

- An ordered list of "Approval Slots" (numbered 1, 2, 3, …).
- Each slot row has:
  - **Group Selector**: Dropdown to choose an existing Approval Group.
  - **Resolution Mode Toggle**: Radio buttons or segmented control — "First to Approve" vs. "All Members Must Approve".
  - **Drag handle** (optional stretch goal) to reorder slots.
- "Add Slot" button to append a new empty slot.
- "Remove" button on each slot to delete it.
- Validation: at least one slot is required; each slot must have a selected group.

### 3. Approval Request Detail (Updated)

The existing request detail page should show the grouped structure:

```
Slot 1: Initial Approval (First to Approve) — [status badge]
  ├── Jane Doe — Approved — 2026-07-25 10:00 AM
  ├── John Smith — Skipped
  └── Bob Lee — Pending

Slot 2: Final Approval (All must approve) — [status badge]
  └── Alice Admin — Pending
```

### 4. My Approvals / Dashboard (Updated)

Approvers see individual steps assigned to them, grouped by slot. The grouping helps an approver understand context (e.g., "I'm in Slot 2: Final Approval — I'm the only approver, and my decision is final.").

---

## Implementation Order

### Phase 1 — Database & Models
1. Write the migration SQL for `approval_groups`, `approval_group_members`, `workflow_approval_slots`.
2. Update `approval_steps` schema to include `slot_order`, `group_id`, `resolution_mode`.
3. Create model files (`server/src/models/ApprovalGroup.ts`, update existing models).

> **⚠️  SEED STEP:** After implementing the database schema changes, you **must** re-run the seed script to create the new tables in the database:
> ```bash
> cd server && npm run db:seed
> ```
> This executes `server/src/config/seed.ts` which contains all `CREATE TABLE IF NOT EXISTS` statements, including the three new tables (`approval_groups`, `approval_group_members`, `workflow_approval_slots`) and the updated `approval_steps` schema. If this step is skipped, the `/api/approval-groups` endpoint will return a **500 error** because the tables don't exist yet.

### Phase 2 — Backend: Approval Groups API
4. Create `server/src/routes/approvalGroups.ts` with full CRUD.
5. Create `server/src/controllers/approvalGroupController.ts`.
6. Register routes in `server/src/app.ts` behind admin middleware.
7. Add Approval Group types to `server/src/types/index.ts` and `client/src/types/index.ts`.

### Phase 2.5 — Test Approval Groups CRUD Endpoints

Before moving on to frontend or workflow changes, verify all five CRUD endpoints work correctly using `curl` (or any HTTP client). This catches bugs early — e.g., missing tables, async/await mistakes in the service layer, or validation issues.

> **Prerequisite:** The server must be running (`npm run dev`) and the database must be seeded (`npm run db:seed`). All commands below use `SUPER_ADMIN_TOKEN` — replace with a valid admin JWT for your environment.

**1. List groups (expect `[]` initially):**
```bash
curl -s http://localhost:3001/api/approval-groups \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```

**2. Create a group:**
```bash
curl -s -X POST http://localhost:3001/api/approval-groups \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Initial Approval",
    "description": "First round reviewers",
    "memberIds": ["<user-id-1>", "<user-id-2>"]
  }' | jq
```
Verify the response includes `id`, `name`, `description`, `createdBy`, `members` array (with `id`, `name`, `email`, `role` for each member), `createdAt`, and `updatedAt`. If `name` or `description` are missing or `"An internal server error occurred"`, check `docs/fixes/async-format-group-bug.md`.

**3. Get single group:**
```bash
curl -s http://localhost:3001/api/approval-groups/<group-id> \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Confirm the response matches the create response.

**4. Update group (name, description, or members):**
```bash
curl -s -X PATCH http://localhost:3001/api/approval-groups/<group-id> \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Group Name",
    "description": "Updated description",
    "memberIds": ["<user-id-1>", "<user-id-3>"]
  }' | jq
```
Verify the updated fields and member list are reflected.

**5. Delete a group:**
```bash
# Delete (fails with message if assigned to a workflow)
curl -s -X DELETE http://localhost:3001/api/approval-groups/<group-id> \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect `{"message":"Approval group deleted successfully."}`.

**6. Access control check (non-admin should be rejected):**
```bash
# Use a non-admin user's token
curl -s http://localhost:3001/api/approval-groups \
  -H "Authorization: Bearer $NON_ADMIN_TOKEN"
```
Expect `{"message":"Admin access required."}` with status 403.

**Checklist:**
- [ ] `GET /api/approval-groups` returns empty array or list
- [ ] `POST /api/approval-groups` creates group with name, description, and members
- [ ] `GET /api/approval-groups/:id` returns single group with members
- [ ] `PATCH /api/approval-groups/:id` updates and returns modified group
- [ ] `DELETE /api/approval-groups/:id` deletes group
- [ ] Non-admin requests get 403
- [ ] No 500 errors on any endpoint

### Phase 3 — Backend: Update Workflow API
8. Update `POST /api/workflows` and `PATCH /api/workflows/:id` to accept and persist `slots` array.
9. Update `GET /api/workflows/:id` to return expanded slot/group data.
10. Add validation: slot order uniqueness, group existence, at least one slot.

### Phase 4 — Backend: Update Approval Submission & Processing
11. Update `POST /api/approvals` to generate `approval_steps` based on slot 1's group members and resolution mode.
12. Implement slot-advancement logic in `PATCH /api/approvals/:id/step/:stepId`:
    - On each step action, evaluate the resolution rules for that slot.
    - If the slot is resolved (approved), generate steps for the next slot.
    - If the slot is resolved (rejected), reject the entire request.
    - If it's the last slot and all approved, approve the request.
13. Update `GET /api/approvals/:id` to return steps grouped by slot.

### Phase 5 — Frontend: Approval Groups Management
14. Add `ApprovalGroupsPage.tsx` (or a section in Admin panel).
15. Add group creation/edit form with user multi-select.
16. Add group list with delete capability.

### Phase 6 — Frontend: Workflow Slot Builder
17. Update `Workflows.tsx` (create/edit forms) to include the slot builder UI.
18. Add group dropdown + resolution mode toggle per slot.
19. Add add/remove/reorder functionality for slots.

### Phase 7 — Frontend: Updated Request Views
20. Update `Dashboard.tsx` and `WorkflowDetail.tsx` to show grouped approval steps.
21. Add slot-level status indicators.

### Phase 8 — Testing & Polish
22. Test full lifecycle: create group → create workflow with slots → submit request → approve step by step → verify slot advancement.
23. Test edge cases: group member removal after request creation, group deletion while assigned to workflow, all rejection paths, concurrent approvals in `all` mode.

---

## TypeScript Type Changes

### Server Types (`server/src/types/index.ts`) — Additions

```ts
export type ResolutionMode = 'first' | 'all';

export interface ApprovalGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  members?: User[]; // populated on read
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

// Updated ApprovalStep
export interface ApprovalStep {
  id: string;
  requestId: string;
  slotOrder: number;
  groupId: string;
  approverId: string;
  resolutionMode: ResolutionMode;
  status: ApprovalStepStatus;
  comment?: string;
  actedAt?: Date;
}
```

### Client Types (`client/src/types/index.ts`) — Additions

```ts
export type ResolutionMode = 'first' | 'all';

export interface ApprovalGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: UserListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalSlotConfig {
  groupId: string;
  resolutionMode: ResolutionMode;
  // Populated on read:
  groupName?: string;
  memberCount?: number;
}

// Updated Workflow
export interface Workflow {
  // ...existing fields...
  slots: ApprovalSlotConfig[];
}

// Updated ApprovalStep
export interface ApprovalStep {
  // ...existing fields...
  slotOrder: number;
  groupId: string;
  groupName?: string;
  resolutionMode: ResolutionMode;
}
```

---

## Security & Access Control

- **All `/api/approval-groups` endpoints**: Require `authenticateToken` middleware + `req.user.role === 'admin'`.
- **Workflow slot management**: Protected under existing workflow admin-only routes.
- **Approval step actions**: The approver must be a member of the relevant group for the step they're acting on. Verify `req.user.id` matches the step's `approverId`.
- **Group member changes after request submission**: The `approval_steps` table stores a snapshot of approvers at request-creation time. Adding/removing group members does not retroactively affect already-in-flight requests. State clearly in the UI: "Changes to group membership only apply to new requests."

---

## Edge Cases & Design Decisions

1. **What happens if a group is deleted while assigned to a workflow?**
   - Option A: Cascade deletion — remove the group and all its workflow slot assignments (risky).
   - **Option B (recommended):** Prevent deletion if the group is referenced by any `workflow_approval_slots`. Return `409 Conflict` with a message listing the affected workflows.

2. **What happens if all members are removed from a group that is assigned to a workflow?**
   - The workflow can still exist but new requests will fail at slot generation with a clear error: "Approval Group 'X' has no members. Add members to the group before submitting requests."

3. **Can an admin assign the same group to multiple slots in the same workflow?**
   - Yes. This is valid (e.g., "Initial Approval" group might review a draft, then again as "Post-Implementation Review"). Each slot is independent with its own resolution mode and order.

4. **Can a user be in multiple groups?**
   - Yes. A user can be a member of any number of Approval Groups.

5. **What about the existing `approver` role?**
   - The `approver` role is retained for permission gating (users with the `approver` role can act on approval steps assigned to them). Group membership is independent of role — any user (regardless of role) can be added to an Approval Group. However, in practice, most members will have the `approver` role to see approval-related UI.

6. **Request cancellation:** Cancelling a request marks all pending steps as `cancelled` and the request as `cancelled`, regardless of the current slot.

---

## Open Questions for Review

1. **Rejection behavior with `all` mode**: If the resolution mode is `all` and one member rejects, should we skip the remaining pending members in that slot or leave them as `pending`? **Proposed**: Mark all other pending steps in that slot as `skipped` for consistency.

2. **Slot reordering after request submission**: Should we allow? **Proposed**: No — once a request is submitted, the slot structure is frozen. Any edits to the workflow only affect future requests.

3. **UI location for Approval Groups**: **Resolved** — This will be a new top-level nav item "Approval Groups" visible only to administrators, alongside Workflows and Admin in the main navigation. This makes groups easy to discover and manage without navigating through nested admin pages.

4. **Should "first to approve" reject the entire request if the first action is a rejection?** **Proposed**: Yes — rejection by any approver in any slot is always terminal.

---

## Appendix: Example Flow

1. Admin creates Approval Group "Initial Approval" with members [Alice, Bob, Charlie].
2. Admin creates Approval Group "Final Approval" with member [Diana].
3. Admin creates Workflow "Expense Reports":
   - Slot 1: "Initial Approval" group, resolution mode = `first`
   - Slot 2: "Final Approval" group, resolution mode = `all`
4. User submits an expense report.
5. System creates `approval_steps` for Slot 1: Alice, Bob, Charlie — all `pending`.
6. Alice approves → Slot 1 resolved (mode `first`) → Bob and Charlie marked `skipped`.
7. System creates `approval_steps` for Slot 2: Diana — `pending`.
8. Diana approves → Slot 2 resolved (mode `all`, only member) → Request marked `approved`.