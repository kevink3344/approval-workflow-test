# Workflow Creation & Management — Enhancement Plan

**Date:** 2026-07-26

**Status:** Draft

---

## Overview

This document analyzes the current workflow creation model, identifies gaps compared to production-grade approval workflow systems, and proposes enhancements organized by priority and effort. Each enhancement is presented with its data model, API changes, frontend components, and implementation steps.

---

## 1. Current State

The following fields are already captured when creating or editing a workflow:

| Field | Description | Backend |
|---|---|---|
| **Name** | Workflow display name | `workflows.name` |
| **Description** | Free-text description (admin-facing) | `workflows.description` |
| **Approval Slots** | Ordered approval groups with `resolutionMode` (`all` / `any`) | `workflow_approval_slots` table |
| **Custom Fields (Columns)** | Dynamic form fields with types (`text`, `long_text`, `single_choice`, `multiple_choice`, `date`, `file`), sort order, and required flag | `workflow_columns` table |

The `workflows` table already has a `status` column and an `updated_at` column, but neither is exposed to the user during creation or editing.

---

## 2. Gap Analysis — What's Missing

### 2.1 Workflow Status / Lifecycle Control

| Attribute | Detail |
|---|---|
| **Priority** | High |
| **Effort** | Small |
| **Current gap** | The `workflows.status` column exists in the DB but is never set or exposed to the user. All workflows are effectively "active" on creation. |
| **Proposed solution** | Expose a **Status** field on create/edit with three options: `draft`, `active`, `archived`. Draft workflows are invisible to non-admin users. Archived workflows retain historical requests but block new submissions. |

**Data model change:** None (column already exists).

**UI changes:**
- Add a status dropdown/radio to the create form (default: `draft`).
- Add a status indicator on the workflow list and detail pages.
- Non-admin users only see `active` workflows in the submit list.

**Validation rules:**
- Only `active` workflows accept submissions.
- `archived` workflows show all historical requests as read-only.
- Admins can transition between statuses at any time.

---

### 2.2 Category / Department Tagging

| Attribute | Detail |
|---|---|
| **Priority** | High |
| **Effort** | Small |
| **Current gap** | No way to group, filter, or organize workflows beyond scanning the list by name. |
| **Proposed solution** | Add a `category` column to `workflows` with predefined options: `Finance`, `HR`, `IT`, `Legal`, `Operations`, `Other`. |

**Migration SQL:**
```sql
ALTER TABLE workflows ADD COLUMN category TEXT NOT NULL DEFAULT 'Other';
```

**API changes:**
- `POST /api/workflows` — accept `category` in body.
- `PATCH /api/workflows/:id` — accept `category`.
- `GET /api/workflows` — add optional `?category=` query filter.

**UI changes:**
- Category dropdown on create/edit form.
- Filter pills or sidebar filter on the Workflows list page.
- Category badge on workflow cards/rows.

---

### 2.3 Help Text / Submission Instructions

| Attribute | Detail |
|---|---|
| **Priority** | High |
| **Effort** | Small |
| **Current gap** | The `description` field is admin-facing and shown on the workflow management page, but there is no user-facing instruction text on the submission form. |
| **Proposed solution** | Add an `instructions` column (`TEXT`, nullable) to `workflows`. This field accepts plain text or simple Markdown and is rendered at the top of the submission form. |

**Migration SQL:**
```sql
ALTER TABLE workflows ADD COLUMN instructions TEXT;
```

**API changes:**
- `POST /api/workflows` — accept `instructions`.
- `PATCH /api/workflows/:id` — accept `instructions`.

**UI changes:**
- Rich-text or textarea field on create/edit form labeled "Submission Instructions."
- Rendered instruction block at the top of `WorkflowDetail.tsx` (the submission form).

---

### 2.4 Requester-Side Controls

| Attribute | Detail |
|---|---|
| **Priority** | Medium |
| **Effort** | Small |
| **Current gap** | No configuration for what a requester can do after submitting. Cancel behavior is not controlled per-workflow. |
| **Proposed solution** | Add two boolean flags to `workflows`:

- `allow_requester_cancel` (default: `1`) — Whether the submitter can cancel their own in-flight request.
- `allow_resubmit_rejected` (default: `1`) — Whether a rejected request can be resubmitted.

**Migration SQL:**
```sql
ALTER TABLE workflows ADD COLUMN allow_requester_cancel INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workflows ADD COLUMN allow_resubmit_rejected INTEGER NOT NULL DEFAULT 1;
```

**API changes:**
- `POST /api/workflows` — accept both flags.
- `PATCH /api/workflows/:id` — accept both flags.

**UI changes:**
- Two toggle switches in the create/edit form under an "Requester Controls" section.
- Cancel button visibility on request detail page respects `allow_requester_cancel`.
- "Resubmit" button on rejected requests respects `allow_resubmit_rejected`.

**Backend logic:**
- `PATCH /api/approvals/:id/cancel` — check `allow_requester_cancel` before allowing non-admin cancellation.
- `POST /api/approvals` (resubmit) — check `allow_resubmit_rejected` before accepting a duplicate submission.

---

### 2.5 Submission Permissions (Who Can Submit)

| Attribute | Detail |
|---|---|
| **Priority** | Medium |
| **Effort** | Medium |
| **Current gap** | Any authenticated user in the organization can submit against any active workflow. |
| **Proposed solution** | Add submission permission scoping with three modes:
- **Everyone** (default) — Current behavior.
- **Specific Groups** — Only members of chosen approval groups can submit.
- **Specific Users** — Only individually selected users can submit. |

**New table: `workflow_submission_permissions`**
```sql
CREATE TABLE IF NOT EXISTS workflow_submission_permissions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  permission_type TEXT NOT NULL CHECK(permission_type IN ('user', 'group')),
  target_id   TEXT NOT NULL,  -- user_id or group_id depending on permission_type
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workflow_id, permission_type, target_id)
);
```

**New column on `workflows`:**
```sql
ALTER TABLE workflows ADD COLUMN submission_scope TEXT NOT NULL DEFAULT 'everyone';
-- CHECK(submission_scope IN ('everyone', 'groups', 'users'))
```

**API changes:**
- `GET /api/workflows` — only return workflows the user is permitted to submit to (or all for admins).
- `POST /api/workflows` — accept `submissionScope` and `submissionPermissions[]`.
- `PATCH /api/workflows/:id` — accept updates to submission permissions.
- `POST /api/approvals` — enforce submission permission check (reject 403 if unauthorized).

**UI changes:**
- "Submission Permissions" section on create/edit form:
  - Dropdown: Everyone / Specific Groups / Specific Users
  - Conditional multi-select picker for groups or users.

---

### 2.6 Visibility / Access Control for Requests

| Attribute | Detail |
|---|---|
| **Priority** | Low |
| **Effort** | Medium |
| **Current gap** | All approvers and admins can see all requests. Certain workflows (HR, finance) may need restricted visibility. |
| **Proposed solution** | Add a `visibility` column to `workflows`:
- `public` (default) — Current behavior; all approvers/admins can see all requests.
- `restricted` — Only the requester, assigned approvers on the specific request, and admins can view the request. |

**Migration SQL:**
```sql
ALTER TABLE workflows ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
-- CHECK(visibility IN ('public', 'restricted'))
```

**API changes:**
- `GET /api/approvals` — apply visibility filter: for `restricted` workflows, only return requests where the user is the requester, an assigned approver, or an admin.
- `GET /api/approvals/:id` — enforce visibility: 403 if user is not authorized to view.

**UI changes:**
- Visibility dropdown on create/edit form (Public / Restricted).
- Badge on workflow detail page indicating visibility level.

---

### 2.7 SLA / Due Date Configuration

| Attribute | Detail |
|---|---|
| **Priority** | Low |
| **Effort** | Medium |
| **Current gap** | No deadline or escalation mechanism. Approvals can sit in a pending state indefinitely. |
| **Proposed solution** | Add an `sla_hours` column to `workflow_approval_slots` — the maximum number of hours before a step is considered overdue. This enables future features like escalation (reassign), reminder notifications, and bottleneck reporting. |

**Migration SQL:**
```sql
ALTER TABLE workflow_approval_slots ADD COLUMN sla_hours INTEGER;
```

**API changes:**
- `POST /api/workflows` and `PATCH /api/workflows/:id` — accept `slaHours` on each slot.
- Future: `GET /api/analytics/bottlenecks` (Feature 3 from roadmap) uses `sla_hours` to calculate overdue steps.

**UI changes:**
- "SLA (hours)" input next to each approval slot in the create/edit form (optional, number input).
- Future: Overdue badge on approval steps in Dashboard.

---

### 2.8 Per-Workflow Notification Overrides

| Attribute | Detail |
|---|---|
| **Priority** | Low |
| **Effort** | Medium |
| **Current gap** | Notification behavior is uniform across all workflows. No per-workflow customization. |
| **Proposed solution** | Add two notification-related columns to `workflows`:
- `notify_on_each_step` (default: `1`) — Send notification on every step change vs. only final decision.
- `cc_emails` (`TEXT`, nullable) — Comma-separated additional email addresses to CC on all notifications for this workflow. |

**Migration SQL:**
```sql
ALTER TABLE workflows ADD COLUMN notify_on_each_step INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workflows ADD COLUMN cc_emails TEXT;
```

**API changes:**
- Standard CRUD inclusion for both fields.
- Email notification service (Feature 1 from roadmap) reads these values to customize send behavior.

**UI changes:**
- "Notifications" section on create/edit form with toggle and CC email input.

---

### 2.9 Icon / Color Badge

| Attribute | Detail |
|---|---|
| **Priority** | Low |
| **Effort** | Trivial |
| **Current gap** | All workflows look identical in list views; no visual affordance for quick identification. |
| **Proposed solution** | Add two columns to `workflows`:
- `icon` (`TEXT`, nullable) — Emoji character (e.g., 💰, 📋, 🖥️).
- `color` (`TEXT`, nullable) — Hex color or Tailwind color name for a small accent bar/badge. |

**Migration SQL:**
```sql
ALTER TABLE workflows ADD COLUMN icon TEXT;
ALTER TABLE workflows ADD COLUMN color TEXT;
```

**API changes:**
- Standard CRUD inclusion.

**UI changes:**
- Emoji picker (simple) and color swatch selector on create/edit form.
- Render icon + color accent on workflow cards in the list view.

---

## 3. Consolidated Priority Matrix

| # | Enhancement | Priority | Effort | Dependencies |
|---|-------------|----------|--------|-------------|
| 1 | Workflow Status (Draft/Active/Archived) | High | Small | None (column exists) |
| 2 | Category / Department Tagging | High | Small | New column |
| 3 | Help Text / Instructions | High | Small | New column |
| 4 | Requester-Side Controls | Medium | Small | New columns |
| 5 | Submission Permissions | Medium | Medium | New table + column |
| 6 | Icon / Color Badge | Low | Trivial | New columns |
| 7 | Visibility / Access Control | Low | Medium | New column + auth logic |
| 8 | SLA / Due Dates | Low | Medium | New column on slots |
| 9 | Per-Workflow Notifications | Low | Medium | New columns (needs Feature 1) |

---

## 4. Recommended Implementation Order

### Phase 1 — Quick Wins (1-2 hours total)
1. **Workflow Status** — Expose existing `status` column; add dropdown to create/edit form; filter list for non-admins.
2. **Category** — Add column, add dropdown, add filter UI.
3. **Help Text / Instructions** — Add column, add textarea, render on submission form.

### Phase 2 — Requester Experience (2-3 hours)
4. **Requester-Side Controls** — Two boolean flags; enforce in cancel/resubmit endpoints.
5. **Icon / Color Badge** — Two trivial columns; emoji picker + color selector.

### Phase 3 — Enterprise Features (3-5 hours)
6. **Submission Permissions** — New table, permission check in queries and submission endpoint.
7. **Visibility / Access Control** — Column + query filtering.

### Phase 4 — Advanced (future, after Features 1-3 from roadmap)
8. **SLA / Due Dates** — Depends on notification and analytics features.
9. **Per-Workflow Notifications** — Depends on email notification feature (Feature 1).

---

## 5. Open Questions for Review

1. **Categories:** Should categories be a free-text field or a hardcoded enum? If an enum, what is the full list? **Proposed:** Start with an enum (`Finance`, `HR`, `IT`, `Legal`, `Operations`, `Other`) with the option to make it configurable later.

2. **Workflow status transitions:** Should the status be freely changeable, or should it follow a state machine (draft → active → archived only)? **Proposed:** Free change; draft → archived is useful for abandoning WIP workflows.

3. **Submission permissions:** Should the default be "everyone" (current behavior, no migration impact) or should we require explicit configuration? **Proposed:** Default to "everyone" for backward compatibility.

4. **Instructions formatting:** Plain text, Markdown, or a rich-text editor? **Proposed:** Start with plain text (textarea). Upgrade to Markdown rendering later if needed.

5. **SLA escalation:** When a step exceeds `sla_hours`, what action should occur? Options: (a) just flag as overdue and show in UI, (b) auto-reassign to a fallback approver, (c) send reminder email. **Proposed:** Start with (a) — overdue flagging only. Add escalation later.