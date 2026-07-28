# Phase 1 — Quick Wins: Completed

**Date:** 2026-07-26

**Status:** ✅ Complete

**Related Plan:** `docs/plans/workflow-plan.md`

---

## Overview

Phase 1 implemented three enhancements to the workflow creation and management experience:

1. **Workflow Status (Draft/Active/Archived)** — Lifecycle control for workflows
2. **Category / Department Tagging** — Organizational grouping and filtering
3. **Help Text / Submission Instructions** — User-facing guidance on the submission form

---

## Detailed Changes

### 1. Workflow Status (Draft/Active/Archived)

| Layer | Change |
|-------|--------|
| **TypeScript types** (server) | `WorkflowStatus` union expanded from `'active' \| 'archived'` to `'draft' \| 'active' \| 'archived'` |
| **TypeScript types** (client) | Same type expansion; `Workflow` interface updated |
| **DB schema** | `status` default changed from `'active'` to `'draft'`; CHECK constraint updated |
| **Migration** | `seed.ts` recreates the `workflows` table with updated constraint and backfills existing rows (existing workflows default to `'active'` for backward compatibility) |
| **Validation** | `createWorkflowSchema` accepts `status` (optional, defaults to `'draft'`); `updateWorkflowSchema` accepts `status` (optional) |
| **Service** | `createWorkflow()` inserts status; `updateWorkflow()` patches status dynamically |
| **Create form** | Status dropdown: Draft ("Not visible to users") / Active ("Accepting submissions") / Archived ("Read-only history") |
| **Edit form** | Status dropdown pre-filled with current value |
| **Workflow list** | Non-admin users only see `active` workflows; status badges color-coded (slate=draft, green=active, amber=archived) |
| **Workflow detail** | Color-coded status badge; draft shows yellow warning banner; archived shows yellow warning banner; submit button disabled for non-active workflows |
| **Backend enforcement** | `submitApproval()` in `approvalService.ts` queries workflow status and rejects with `"Cannot submit to a workflow that is not active."` if not `'active'` |

### 2. Category / Department Tagging

| Layer | Change |
|-------|--------|
| **DB** | New `category` column: `TEXT NOT NULL DEFAULT 'Other'` |
| **Migration** | `ensureColumns` in `seed.ts` adds column if missing |
| **Client types** | New `WorkflowCategory` type: `'Finance' \| 'HR' \| 'IT' \| 'Legal' \| 'Operations' \| 'Other'`; exported `workflowCategories` constant array |
| **Validation** | `createWorkflowSchema` accepts `category` (optional, defaults to `'Other'`) |
| **Service** | `createWorkflow()` and `updateWorkflow()` read/write category; `formatWorkflow()` maps `row.category` |
| **Create/Edit forms** | Category dropdown with all six options |
| **Workflow list** | Category filter pill bar (All / Finance / HR / IT / Legal / Operations / Other); category chip shown on each workflow card |
| **Workflow detail** | Category badge next to workflow name |

### 3. Help Text / Submission Instructions

| Layer | Change |
|-------|--------|
| **DB** | New `instructions` column: `TEXT` (nullable) |
| **Migration** | `ensureColumns` in `seed.ts` adds column if missing |
| **Client types** | `Workflow` interface now includes `instructions: string \| null` |
| **Validation** | `createWorkflowSchema` accepts `instructions` (optional, defaults to `null`); `updateWorkflowSchema` accepts `instructions` (nullable, optional) |
| **Service** | `createWorkflow()` and `updateWorkflow()` handle instructions; `formatWorkflow()` maps `row.instructions \|\| null` |
| **Create/Edit forms** | Textarea labeled "Submission Instructions" with placeholder and helper text |
| **Workflow detail** | Instructions rendered in a highlighted card with accent-colored left border, between the header and the approval slots |

---

## Files Modified

### Server
| File | Changes |
|------|---------|
| `server/src/types/index.ts` | `WorkflowStatus` + `draft`; `Workflow` interface + `category`, `instructions` |
| `server/src/middleware/validation.ts` | `createWorkflowSchema` + `status`, `category`, `instructions`; `updateWorkflowSchema` + `status`, `category`, `instructions` |
| `server/src/config/seed.ts` | `workflows` table CHECK constraint updated; `ensureColumns` for `category` + `instructions`; migration block recreates table for existing DBs |
| `server/src/services/workflowService.ts` | `CreateWorkflowParams` + `status`, `category`, `instructions`; `UpdateWorkflowParams` + `status`, `category`, `instructions`; INSERT now includes new columns; scalar UPDATE block handles all five scalar fields; `formatWorkflow()` returns `category` + `instructions` |
| `server/src/services/approvalService.ts` | `submitApproval()` checks workflow status before allowing submission |

### Client
| File | Changes |
|------|---------|
| `client/src/types/index.ts` | `WorkflowStatus` + `draft`; `WorkflowCategory` type; `workflowCategories` array; `Workflow` interface + `category`, `instructions` |
| `client/src/pages/Workflows.tsx` | Status dropdown + Category dropdown + Instructions textarea on create form; category filter pills; non-admin filtering for non-active workflows; color-coded status badges |
| `client/src/pages/WorkflowEdit.tsx` | Status dropdown + Category dropdown + Instructions textarea; form pre-fills from workflow data |
| `client/src/pages/WorkflowDetail.tsx` | Color-coded status badge; draft/archived warning banners; instructions render block; disabled submit button for non-active workflows; category badge |

---

## Compilation

- ✅ Server: `npx tsc --noEmit` — zero errors
- ✅ Client: `npx tsc --noEmit` — zero errors

---

## Migration Instructions

Run the seed script to apply database changes:

```bash
cd server
npm run db:seed
```

This will:
- Add `category` and `instructions` columns to the `workflows` table (if missing)
- Recreate the `workflows` table with the updated `status` CHECK constraint (if needed)
- Existing workflows retain their current status (`'active'`) and get `category = 'Other'`

No manual SQL intervention is needed.