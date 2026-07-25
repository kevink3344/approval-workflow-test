# Approval Groups — Implementation Completed

**Date:** 2026-07-25

**Status:** Completed

---

## Summary

The Approval Groups feature has been fully implemented across the backend and frontend. This introduces **Approval Groups** as a first-class entity, allowing administrators to pre-define reusable groups of users and assign them to workflow slots with configurable resolution modes (`first` or `all`).

---

## Files Created

| File | Description |
|------|-------------|
| `server/src/services/approvalGroupService.ts` | CRUD operations for approval groups with member management |
| `server/src/controllers/approvalGroupController.ts` | Express controllers for approval group API endpoints |
| `server/src/routes/approvalGroups.ts` | Router for `/api/approval-groups` (admin-only) |
| `client/src/pages/ApprovalGroups.tsx` | Full management page — create, edit, delete groups with member selection |

## Files Modified

| File | Changes |
|------|---------|
| `server/src/types/index.ts` | Added `ResolutionMode`, `ApprovalGroup`, `ApprovalGroupMember`, `WorkflowApprovalSlot`, updated `ApprovalStep` |
| `server/src/config/seed.ts` | Added DDL for `approval_groups`, `approval_group_members`, `workflow_approval_slots` tables; updated `approval_steps` schema |
| `server/src/middleware/validation.ts` | Added `createApprovalGroupSchema`, `updateApprovalGroupSchema`; updated `createWorkflowSchema` and `updateWorkflowSchema` to accept `slots` |
| `server/src/app.ts` | Registered `/api/approval-groups` route |
| `server/src/services/workflowService.ts` | Added `attachSlots()` to populate slot/group data; `createWorkflow` and `updateWorkflow` now handle `slots` array |
| `server/src/services/approvalService.ts` | Complete rewrite: slot-based submission, slot-advancement logic (`evaluateSlot`/`advanceToNextSlot`), legacy step fallback |
| `server/src/controllers/workflowController.ts` | `create` handler now passes `slots` from request body |
| `server/src/routes/users.ts` | Added `GET /` (admin-only) for user list needed by group member picker |
| `client/src/types/index.ts` | Added `ApprovalGroup`, `ApprovalSlotGroup`, `ApprovalSlotConfig`, `ResolutionMode`; updated `ApprovalStep` and `Workflow` |
| `client/src/App.tsx` | Added `/approval-groups` route with `adminOnly` protection |
| `client/src/components/Layout.tsx` | Added "Approval Groups" nav item (admin-only, desktop + mobile) |
| `client/src/pages/Workflows.tsx` | Added **Slot Builder** UI: add/remove slots, group selector, resolution mode toggle |
| `client/src/pages/WorkflowDetail.tsx` | Displays approval slots with group name, member count, and resolution mode |
| `client/src/pages/Dashboard.tsx` | Steps grouped by slot in the detail modal; approve/reject buttons for assigned pending steps; cancel request support |

---

## Requirements Fulfilled

| # | Requirement | Status |
|---|-------------|--------|
| R1 | Admin CRUD for Approval Groups | ✅ `/api/approval-groups` with full CRUD |
| R2 | Each group contains one or more users | ✅ `approval_group_members` table, enforced via validation |
| R3 | Admin assigns groups to workflow slots in order | ✅ Slot builder UI in Workflows page |
| R4 | Slot order enforced: slot N+1 only activates after slot N completes | ✅ `advanceToNextSlot()` generates steps for next slot only |
| R5 | Resolution modes: `first` and `all` | ✅ Per-slot resolution mode toggle |
| R6 | Admin-only group management | ✅ All `/api/approval-groups` behind `requireAdmin` |
| R7 | Groups are reusable across workflows | ✅ Groups referenced by ID in `workflow_approval_slots` |
| R8 | Request routed to slot 1 members on submission | ✅ `submitApproval()` generates steps for slot 1 only |

---

## Resolution Logic Implemented

- **`first` mode:** First approver to act decides — other pending steps skipped; rejection is terminal
- **`all` mode:** All members must approve; any rejection is terminal
- **Slot advancement:** On slot completion (approve), next slot's steps are generated; on last slot approval, request marked `approved`
- **Rejection:** Always terminal — all pending steps across all slots are skipped, request marked `rejected`
- **Cancellation:** Requester can cancel in-review requests; all pending steps skipped, request marked `cancelled`
- **Empty group handling:** Submission blocked if slot 1 has no members; auto-reject if a later slot's group has no members
- **Deletion protection:** Cannot delete a group assigned to any workflow — 409 error with workflow names

---

## API Endpoints

### Approval Groups (all admin-only)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/approval-groups` | List all groups with members |
| `POST` | `/api/approval-groups` | Create group with member IDs |
| `GET` | `/api/approval-groups/:id` | Get single group with members |
| `PATCH` | `/api/approval-groups/:id` | Update group (name, description, members) |
| `DELETE` | `/api/approval-groups/:id` | Delete group (fails if assigned to workflow) |

### Updated Workflow Endpoints
| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/workflows` | Now accepts `slots: [{ groupId, resolutionMode }]` |
| `GET` | `/api/workflows` | Returns expanded `slots` with group info and member counts |
| `GET` | `/api/workflows/:id` | Returns expanded `slots` with group info |

### Updated Approval Endpoints
| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/approvals` | Generates steps from slot 1 group members |
| `PATCH` | `/api/approvals/:id/step/:stepId` | Evaluates slot resolution rules after each action |
| `GET` | `/api/approvals` | Steps include `slotOrder`, `groupId`, `groupName`, `resolutionMode` |

---

## Database Schema

**New tables:** `approval_groups`, `approval_group_members`, `workflow_approval_slots`

**Updated table:** `approval_steps` — added `slot_order`, `group_id`, `resolution_mode` columns

---

## TypeScript Verification

- ✅ Server TypeScript compiles clean (`npx tsc --noEmit`)
- ✅ Client TypeScript compiles clean (`npx tsc --noEmit`)

---

## Edge Cases Handled

1. **Group deletion while assigned:** Blocked with 409 + workflow names
2. **Empty group on submission:** Clear error message with group name
3. **Empty group on slot advancement:** Auto-reject with system comment
4. **Legacy workflows (no slots):** Full backward compatibility via fallback path
5. **Same group in multiple slots:** Supported (unique slot order per workflow)
6. **Group member changes post-submission:** Steps are a snapshot at request time