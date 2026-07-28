# Future Features Roadmap — Implementation Plan

**Date:** 2026-07-25

**Status:** Pending Review

---

## Overview

This document outlines nine high-impact features and one bonus improvement for the approval workflow application. Each feature can be implemented independently and is presented with its own data model, API endpoints, frontend components, and testing strategy. Features are ordered from highest to lowest priority.

---

## Feature List

| # | Feature | Priority | Effort | Description |
|---|---------|----------|--------|-------------|
| 1 | Email Notifications | High | Medium | Send emails when approval events occur; user-configurable preferences. |
| 2 | Comments / Discussion Threads | High | Medium | Allow requesters and approvers to discuss requests before deciding. |
| 3 | Dashboard Analytics & Reporting | Medium | Medium | Charts and metrics for approval trends, bottlenecks, and personal stats. |
| 4 | Bulk Actions | Medium | Small | Multi-select and batch-approve/reject from the Dashboard. |
| 5 | Request Templates & Duplicate | Low | Small | Save and reuse past request submissions as templates. |
| 6 | Auto-Expiry & SLA Deadlines | Medium | Medium | Workflows auto-cancel or escalate requests that exceed time limits. |
| 7 | Conditional Approval Routing | Medium | Medium | Route requests to different approval chains based on form field values. |
| 8 | Rich Text & Markdown Descriptions | Low | Small | Support formatted text in workflow descriptions, comments, and step comments. |
| 9 | API Keys & Webhooks | Medium | Medium | Programmatic access for integrations; real-time event delivery via webhooks. |
| B | Audit Log / Activity Feed | Bonus | Medium | Immutable record of every action in the system. |

---

## Feature 1: Email Notifications

### Overview

Complement the in-app notification system (bell icon) with email delivery. When a notification is created, the system checks the recipient's email preferences and sends an email if that notification type is enabled. Emails contain a direct link back to the relevant request in the app.

### Data Model

#### New Table: `notification_preferences`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `user_id` | TEXT (FK → users.id) | The user |
| `notification_type` | TEXT | The notification type (matches `notifications.type`) |
| `email_enabled` | INTEGER (0/1) | Whether to send email for this type |
| `updated_at` | TEXT (ISO 8601) | Last update timestamp |

*Unique constraint on (`user_id`, `notification_type`). Default for all types is `email_enabled = 1` — opt-out only.*

#### New Table: `email_log`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `notification_id` | TEXT (FK → notifications.id) | The notification that triggered the email |
| `recipient_email` | TEXT | Recipient email at the time of send |
| `subject` | TEXT | Email subject line |
| `status` | TEXT | `'sent'`, `'failed'`, `'skipped'` |
| `error_message` | TEXT (nullable) | Error detail if status is `failed` |
| `sent_at` | TEXT (ISO 8601) | When the email was sent |

### Migration SQL (DDL)

```sql
CREATE TABLE IF NOT EXISTS notification_preferences (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  email_enabled     INTEGER NOT NULL DEFAULT 1,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, notification_type)
);

CREATE TABLE IF NOT EXISTS email_log (
  id              TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'failed', 'skipped')),
  error_message   TEXT,
  sent_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Email Service Architecture

Use **Nodemailer** with SMTP — zero external API dependency, works with any email provider:

```
notificationService.createNotification()
    → check notification_preferences for this user + type
    → if email_enabled = 1:
        → emailService.send(to, subject, html)
        → log result to email_log
    → if email_enabled = 0:
        → log to email_log with status = 'skipped'
```

**Configuration** (`.env`):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASS=your-app-password
EMAIL_FROM="Approval Workflow" <notifications@example.com>
```

**Email templates** per notification type — each is an HTML string with the notification title, message, and a "View Request" button linking to the app.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users/me/preferences` | Get current user's notification preferences (all types with `email_enabled` boolean). |
| `PUT` | `/api/users/me/preferences` | Update preferences. Body: `{ preferences: [{ notificationType, emailEnabled }] }`. |

### Frontend

- **Settings Page Update:** Add a "Notification Preferences" section with toggle switches per notification type (e.g., "Email me when a request is approved", "Email me when I'm assigned as an approver").
- Each toggle sends a `PUT` on change.

### Implementation Order

1. Add tables to seed script and run seed.
2. Add TypeScript types.
3. Create `emailService.ts` with Nodemailer setup and template rendering.
4. Create `notificationPreferenceService.ts`.
5. Hook `emailService.send()` into `notificationService.createNotification()`.
6. Add preference endpoints (controller + routes).
7. Add preference toggles to Settings page.
8. Test: submit an approval → verify email received.

### Testing Checklist

- [ ] `GET /api/users/me/preferences` returns all notification types with default `emailEnabled: true`
- [ ] `PUT /api/users/me/preferences` updates toggles and persists
- [ ] Creating a notification triggers email send when preference is enabled
- [ ] Creating a notification skips email when preference is disabled
- [ ] `email_log` records `sent`, `failed`, and `skipped` correctly
- [ ] Email contains valid deep-link to the request
- [ ] SMTP misconfiguration is handled gracefully (logged, not crashing the app)

---

## Feature 2: Comments / Discussion Threads

### Overview

Allow requesters and approvers to leave comments on an approval request before, during, or after the approval process. Comments can be marked as `internal` (visible only to approvers/admins) or `public` (visible to the requester too). Each comment triggers a notification to relevant parties.

### Data Model

#### New Table: `request_comments`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `request_id` | TEXT (FK → approval_requests.id) | Parent request |
| `author_id` | TEXT (FK → users.id) | Comment author |
| `body` | TEXT | Comment text |
| `is_internal` | INTEGER (0/1) | If 1, visible only to approvers/admins |
| `created_at` | TEXT (ISO 8601) | When the comment was posted |

```sql
CREATE TABLE IF NOT EXISTS request_comments (
  id          TEXT PRIMARY KEY,
  request_id  TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_request_comments_request ON request_comments(request_id, created_at);
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/approvals/:id/comments` | List comments for a request. Internal comments are filtered out if the requesting user is not an approver/admin. Includes `authorName` for each comment. |
| `POST` | `/api/approvals/:id/comments` | Add a comment. Body: `{ body, isInternal? }`. Triggers a `comment_added` notification to the requester (for public) or all approvers (for internal). |

### Notification Integration

New notification type: `comment_added`.

- Public comment → notify the requester (if the author is an approver) or notify approvers (if the author is the requester).
- Internal comment → notify all approvers/admins assigned to the request.

### Frontend

- **Request Detail Page:** New "Discussion" section below the approval steps and fields.
  - Comment list: each comment shows author avatar/initials, name, timestamp, body, and a small "Internal" badge if applicable.
  - Comment input: textarea + "Post" button + "Internal" checkbox (visible only to approvers/admins).
  - Most recent comment at the bottom (chat-like chronological order).
- Auto-scroll to latest comment on post.

### Implementation Order

1. Add `request_comments` table to seed script and run seed.
2. Add TypeScript types (server + client).
3. Create `commentService.ts` with `getComments` and `createComment`.
4. Add `comment_added` to the `NotificationType` enum.
5. Create routes + controller for comments.
6. Update `GET /api/approvals/:id` to optionally include comments.
7. Add comment UI to `WorkflowDetail.tsx` (or a new `CommentThread.tsx` component).
8. Test full flow.

### Testing Checklist

- [ ] `POST /api/approvals/:id/comments` creates comment and returns it with `authorName`
- [ ] `GET /api/approvals/:id/comments` returns all comments in chronological order
- [ ] Internal comments are hidden from non-approver users
- [ ] Public comment triggers `comment_added` notification to the other party
- [ ] Internal comment triggers `comment_added` notification to all approvers
- [ ] Comment UI auto-scrolls to latest
- [ ] Empty textarea is validated (cannot post empty comment)

---

## Feature 3: Dashboard Analytics & Reporting

### Overview

Add a dedicated "Reports" or "Analytics" section with charts showing approval metrics. Uses **Recharts** (lightweight React charting library, already compatible with the existing Tailwind + React stack).

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/analytics/summary` | Aggregate counts: total requests, by status (pending/in_review/approved/rejected/cancelled), average time-to-approval (hours). |
| `GET` | `/api/analytics/trends` | Requests per day for the last 30 days, grouped by status. Returns `[{ date, approved, rejected, submitted }]`. |
| `GET` | `/api/analytics/personal` | For the authenticated user: requests submitted, approval actions taken, average turnaround time. |
| `GET` | `/api/analytics/bottlenecks` | Top 5 approval slots (by group name) with the highest average pending duration. |

All analytics endpoints respect the user's role — admins see org-wide data; regular users see only their own data or data scoped to workflows they're involved in.

### Frontend

- **New Page:** `Reports.tsx` at route `/reports`.
- **Layout:**
  - Summary cards row: Total Requests, Approved, Rejected, Avg. Time-to-Approve.
  - Line chart: "Requests Over Time" (last 30 days) — multiple lines for submitted, approved, rejected.
  - Pie or donut chart: "Requests by Status."
  - Bar chart: "Bottlenecks — Approval Slots with Longest Wait Times."
  - Personal stats section (if not admin).
- Use `recharts` library (`npm install recharts`).

### Implementation Order

1. Install `recharts` in the client.
2. Create `server/src/routes/analytics.ts` with `summary`, `trends`, `personal`, and `bottlenecks` endpoints.
3. Create `server/src/controllers/analyticsController.ts` with SQL aggregation queries.
4. Add client API functions.
5. Build `Reports.tsx` page with all four chart types.
6. Add nav link (visible to all authenticated users; admins see org-wide data).

### Testing Checklist

- [ ] `GET /api/analytics/summary` returns correct aggregate counts
- [ ] `GET /api/analytics/trends` returns correct daily breakdown for the last 30 days
- [ ] `GET /api/analytics/personal` returns stats scoped to the authenticated user
- [ ] `GET /api/analytics/bottlenecks` returns top approval slots by pending duration
- [ ] Admin sees org-wide data; non-admin sees only their own
- [ ] Charts render without errors in the browser
- [ ] All analytics endpoints are in Swagger UI

---

## Feature 4: Bulk Actions

### Overview

Allow approvers to select multiple pending requests on the Dashboard and approve or reject them in one action. Respects existing approval group rules — a bulk-approve on a request still processes the step normally (doesn't bypass group resolution logic).

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/approvals/bulk` | Bulk action on multiple request steps. Body: `{ stepIds: string[], action: 'approved' | 'rejected', comment?: string }`. |

**Behavior:**
- Iterates over each `stepId`, validates the current user is the assigned approver and the step is `pending`.
- Calls the existing step-action logic for each. Skips invalid steps and returns a summary:
  ```json
  {
    "succeeded": 3,
    "failed": 1,
    "failures": [{ "stepId": "...", "reason": "Step is not pending." }]
  }
  ```

### Frontend

- **Dashboard Update:** Add checkboxes to each pending approval row.
- A floating toolbar appears when one or more items are selected:
  - "X selected" counter.
  - "Approve All" button (green).
  - "Reject All" button (red).
  - Optional comment input (applied to all).
- Confirmation modal: "You are about to approve 5 requests. This action cannot be undone. Continue?"
- After bulk action completes, show a toast/snackbar with success/failure counts.

### Implementation Order

1. Create `PATCH /api/approvals/bulk` endpoint.
2. Add client API function.
3. Update Dashboard with multi-select checkboxes and floating bulk-action toolbar.
4. Add confirmation modal.
5. Test: select multiple, approve, verify all steps processed and slot advancement works.

### Testing Checklist

- [ ] `PATCH /api/approvals/bulk` with valid step IDs processes all successfully
- [ ] `PATCH /api/approvals/bulk` skips steps that are not pending or not assigned to the user
- [ ] Response includes succeeded/failed counts and failure reasons
- [ ] Bulk approve respects resolution mode (e.g., `all` mode requires remaining approvers)
- [ ] Bulk reject marks the request as rejected and skips remaining slots
- [ ] Dashboard UI: checkboxes appear, toolbar appears on selection, confirmation modal works
- [ ] After bulk action, the Dashboard refreshes with updated statuses

---

## Feature 5: Request Templates & Duplicate

### Overview

Users can save a completed or in-progress request as a template, then use that template to pre-fill a new submission form. This is especially useful for recurring approvals (monthly expense reports, weekly timesheets, etc.).

### Data Model

#### New Table: `request_templates`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `owner_id` | TEXT (FK → users.id) | User who saved the template |
| `name` | TEXT | Display name (e.g., "Monthly Expense Report") |
| `workflow_id` | TEXT (FK → workflows.id) | The workflow this template is for |
| `is_shared` | INTEGER (0/1) | If 1, visible to all users (admin-managed) |
| `created_at` | TEXT (ISO 8601) | When saved |

#### New Table: `request_template_fields`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `template_id` | TEXT (FK → request_templates.id) | Parent template |
| `column_id` | TEXT (FK → workflow_columns.id) | The workflow column |
| `value` | TEXT (nullable) | Pre-filled value for this field |

```sql
CREATE TABLE IF NOT EXISTS request_templates (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  is_shared   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS request_template_fields (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES request_templates(id) ON DELETE CASCADE,
  column_id   TEXT NOT NULL REFERENCES workflow_columns(id) ON DELETE CASCADE,
  value       TEXT
);
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/templates` | Save a request as a template. Body: `{ requestId, name }`. Copies all field values from the request. |
| `GET` | `/api/templates` | List templates for the current user (or all shared templates). |
| `GET` | `/api/templates/:id` | Get a single template with its pre-filled field values. |
| `DELETE` | `/api/templates/:id` | Delete a template (owner only, unless admin). |
| `POST` | `/api/templates/:id/submit` | Submit a new request using a template. Body: `{ fields?: [{ columnId, value }] }` to override any template values. |

### Frontend

- **"Save as Template" button** on any completed/cancelled request detail page.
  - Opens a small modal: template name input + "Save" button.
- **"Submit from Template" button** on the Dashboard or Workflows page.
  - Opens a dropdown of the user's saved templates.
  - Selecting one navigates to the submission form pre-filled with the template's field values.
- **"Submit Again" button** on any past request — shorthand that creates a one-time template and navigates to the pre-filled form immediately (no save step).
- **Templates management page** (`/templates`): list, rename, delete.

### Implementation Order

1. Add tables to seed script and run seed.
2. Add TypeScript types.
3. Create `templateService.ts` with CRUD and `submitFromTemplate`.
4. Create routes + controller.
5. Add client API functions.
6. Update submission form (`WorkflowDetail.tsx` or `SubmitRequest.tsx`) to accept pre-filled values.
7. Add "Save as Template" and "Submit Again" buttons to request detail page.
8. Build `TemplatesPage.tsx`.

### Testing Checklist

- [ ] `POST /api/templates` creates a template with field values from an existing request
- [ ] `GET /api/templates` returns user's templates (and shared templates)
- [ ] `GET /api/templates/:id` returns template with all pre-filled fields
- [ ] `DELETE /api/templates/:id` deletes (only owner or admin)
- [ ] `POST /api/templates/:id/submit` creates a new approval request with template field values
- [ ] Overriding individual fields in `POST /api/templates/:id/submit` works
- [ ] "Save as Template" modal appears and saves correctly
- [ ] "Submit Again" pre-fills form and submits correctly
- [ ] Templates page lists, renames, and deletes templates

---

## Bonus: Audit Log / Activity Feed

### Overview

An immutable, append-only log of every significant action in the system. Provides full traceability for compliance use cases (finance, HR, legal approvals). Admins can search, filter, and export the log.

### Data Model

#### New Table: `audit_logs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `user_id` | TEXT (FK → users.id) | Who performed the action |
| `action` | TEXT | Action verb (see enum below) |
| `entity_type` | TEXT | Entity acted upon (e.g., `'workflow'`, `'approval_group'`, `'request'`) |
| `entity_id` | TEXT | ID of the entity acted upon |
| `details` | TEXT (JSON) | Additional context (e.g., `{"oldStatus": "pending", "newStatus": "approved"}`) |
| `ip_address` | TEXT (nullable) | Client IP address (for security auditing) |
| `created_at` | TEXT (ISO 8601) | When the action occurred |

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  details     TEXT DEFAULT '{}',
  ip_address  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
```

### Audit Action Types

| Action | When Logged |
|--------|------------|
| `user.registered` | New user registration |
| `user.login` | Successful login |
| `user.role_changed` | Admin changes a user's role |
| `workflow.created` | Workflow created |
| `workflow.updated` | Workflow modified |
| `workflow.deleted` | Workflow deleted |
| `approval_group.created` | Approval group created |
| `approval_group.updated` | Approval group modified (members, name, etc.) |
| `approval_group.deleted` | Approval group deleted |
| `request.submitted` | Approval request submitted |
| `request.cancelled` | Request cancelled by requester |
| `step.approved` | Approver approves a step |
| `step.rejected` | Approver rejects a step |
| `comment.created` | Comment posted on a request |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/audit-logs` | List audit logs (admin only). Supports `?entityType=`, `?entityId=`, `?userId=`, `?action=`, `?search=`, `?limit=`, `?offset=`. |
| `GET` | `/api/audit-logs/export` | Export filtered audit logs as CSV (admin only). |

### Logging Pattern

Audit logs are created **synchronously** inside each service method after the database mutation succeeds. Example:

```ts
// Inside approvalService.approveStep()
await db.run('UPDATE approval_steps SET status = ?, acted_at = ? WHERE id = ?', ['approved', now, stepId]);

await auditService.log({
  userId: req.user.id,
  action: 'step.approved',
  entityType: 'request',
  entityId: requestId,
  details: JSON.stringify({ stepId, resolutionMode, slotOrder }),
  ipAddress: req.ip,
});
```

Logging failures should be caught and logged to the server console but **must not break** the primary operation (fire-and-forget or try/catch).

### Frontend

- **Admin Page:** `/admin/audit-log`
- **Layout:**
  - Filter bar: entity type dropdown, action type dropdown, user search, date range picker.
  - Table: timestamp, user name, action (with color-coded badge), entity type + link, details (expandable JSON).
  - "Export CSV" button.
  - Infinite scroll or pagination.
- **Entity Detail Pages:** "Activity" tab on Workflow edit page, Group edit page — shows audit logs filtered to that entity.

### Implementation Order

1. Add `audit_logs` table to seed script and run seed.
2. Add TypeScript types.
3. Create `auditService.ts` with `log()` function.
4. Wire `auditService.log()` into all existing services at mutation points.
5. Create `auditLogController.ts` + `routes/auditLogs.ts` (admin-only).
6. Add client API functions.
7. Build `AuditLogPage.tsx`.
8. Add "Activity" tabs to entity detail pages.
9. Test: perform actions → verify they appear in audit log.

### Testing Checklist

- [ ] `GET /api/audit-logs` returns paginated results (admin only)
- [ ] `GET /api/audit-logs?entityType=request&entityId=xxx` filters correctly
- [ ] `GET /api/audit-logs?userId=xxx` filters by user
- [ ] `GET /api/audit-logs?search=term` searches across action and details
- [ ] `GET /api/audit-logs/export` returns CSV with correct columns
- [ ] Non-admin users receive 403 on all audit log endpoints
- [ ] Creating a workflow generates `workflow.created` log entry
- [ ] Submitting a request generates `request.submitted` log entry
- [ ] Approving/rejecting generates `step.approved`/`step.rejected` log entry
- [ ] A failed audit log write does not break the primary operation
- [ ] Admin UI renders the log table with filters and infinite scroll
- [ ] CSV export downloads correctly

---

## Feature 6: Auto-Expiry & SLA Deadlines

### Overview

Allow administrators to set expiration deadlines on workflows. When a request has been pending at a step beyond the deadline, the system can automatically cancel the request or escalate it to an alternate approver. This prevents requests from stalling indefinitely and enforces service-level agreements (SLAs).

### Data Model

#### Modified Table: `workflows` (add columns)

| Column | Type | Description |
|--------|------|-------------|
| `expiry_enabled` | INTEGER (0/1) | Whether auto-expiry is active for this workflow. Default 0. |
| `expiry_hours` | INTEGER (nullable) | Hours after submission before the entire request expires. |
| `escalation_enabled` | INTEGER (0/1) | Whether to escalate stuck steps. Default 0. |
| `escalation_hours` | INTEGER (nullable) | Hours a step can remain pending before escalation. |
| `escalation_group_id` | TEXT (nullable, FK → approval_groups.id) | Group to escalate to when a step times out. |

#### New Table: `request_deadlines`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `request_id` | TEXT (FK → approval_requests.id) | The request |
| `step_id` | TEXT (nullable, FK → approval_steps.id) | The specific step (null for request-level deadline) |
| `deadline_type` | TEXT | `'expiry'` or `'escalation'` |
| `deadline_at` | TEXT (ISO 8601) | When the deadline triggers |
| `is_triggered` | INTEGER (0/1) | Whether the deadline has already fired |
| `triggered_at` | TEXT (nullable, ISO 8601) | When it fired |

```sql
-- Add columns to workflows (existing table migration)
ALTER TABLE workflows ADD COLUMN expiry_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workflows ADD COLUMN expiry_hours INTEGER;
ALTER TABLE workflows ADD COLUMN escalation_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workflows ADD COLUMN escalation_hours INTEGER;
ALTER TABLE workflows ADD COLUMN escalation_group_id TEXT REFERENCES approval_groups(id);

CREATE TABLE IF NOT EXISTS request_deadlines (
  id            TEXT PRIMARY KEY,
  request_id    TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_id       TEXT REFERENCES approval_steps(id) ON DELETE CASCADE,
  deadline_type TEXT NOT NULL CHECK(deadline_type IN ('expiry', 'escalation')),
  deadline_at   TEXT NOT NULL,
  is_triggered  INTEGER NOT NULL DEFAULT 0,
  triggered_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_request_deadlines_pending
  ON request_deadlines(deadline_at, is_triggered);
```

### Background Job

A lightweight scheduled check runs every 5 minutes (via `setInterval` in the server process, or a separate cron job):

1. Query `request_deadlines` where `deadline_at <= now` AND `is_triggered = 0`.
2. For each overdue deadline:
   - **Expiry:** Set the request status to `cancelled`, add a system comment noting the expiry.
   - **Escalation:** Create a new approval step for the escalation group, mark the overdue step as `skipped`.
3. Mark `is_triggered = 1`, `triggered_at = now`.
4. Create notifications for all affected users.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/workflows/:id` | Updated to accept `expiryEnabled`, `expiryHours`, `escalationEnabled`, `escalationHours`, `escalationGroupId`. |
| `GET` | `/api/requests/:id/deadlines` | Get all deadlines for a request (expiry + per-step escalation). |

### Frontend

- **Workflow Edit Page:** New "SLA & Deadlines" section with:
  - Toggle: "Enable auto-expiry" → shows hours input.
  - Toggle: "Enable escalation" → shows hours input + group selector.
- **Request Detail Page:** Deadline countdown timer displayed when applicable (e.g., "Expires in 3h 22m" or "Escalates in 1h 15m").
- **Dashboard:** Visual indicator (yellow/orange badge) on requests approaching their deadline.

### Implementation Order

1. Add migration columns and `request_deadlines` table to seed script.
2. Add TypeScript types.
3. Update `workflowService.updateWorkflow()` to handle new fields.
4. Create `deadlineService.ts` with `scheduleDeadlines()` and `checkOverdue()`.
5. Start the background check loop in `index.ts`.
6. Update workflow edit UI with SLA section.
7. Add deadline display to request detail and dashboard.
8. Test: create a workflow with a 1-hour expiry, submit a request, verify auto-cancellation.

### Testing Checklist

- [ ] Admin can set expiry/escalation on a workflow via PATCH
- [ ] Submitting a request creates `request_deadlines` entries for each configured deadline
- [ ] Background check fires overdue deadlines and updates request/step status
- [ ] Expired request is marked `cancelled` with a system comment
- [ ] Escalated step creates a new step for the escalation group
- [ ] Deadline countdown displays correctly on request detail
- [ ] Approaching-deadline indicators appear on Dashboard
- [ ] Background check handles empty/no-overdue gracefully

---

## Feature 7: Conditional Approval Routing

### Overview

Route approval requests through different approval chains based on the values of custom fields. For example, an expense report under $1,000 goes to the manager only, while one over $1,000 also routes to finance. This eliminates the need for separate workflows for every threshold.

### Data Model

#### New Table: `workflow_routing_rules`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `workflow_id` | TEXT (FK → workflows.id) | Parent workflow |
| `name` | TEXT | Display label (e.g., "Under $1,000") |
| `priority` | INTEGER | Evaluation order (lower = checked first) |
| `conditions` | TEXT (JSON) | Array of conditions (see below) |
| `slot_overrides` | TEXT (JSON) | Approval slots to use when conditions match |
| `is_default` | INTEGER (0/1) | Fallback route when no conditions match |
| `created_at` | TEXT (ISO 8601) | |

**Conditions JSON format:**

```json
[
  {
    "columnId": "abc123",
    "operator": "greater_than",
    "value": "1000"
  },
  {
    "columnId": "def456",
    "operator": "equals",
    "value": "Engineering"
  }
]
```

**Supported operators:** `equals`, `not_equals`, `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal`, `contains`, `in` (for choice fields), `is_empty`, `is_not_empty`.

```sql
CREATE TABLE IF NOT EXISTS workflow_routing_rules (
  id             TEXT PRIMARY KEY,
  workflow_id    TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  priority       INTEGER NOT NULL DEFAULT 0,
  conditions     TEXT NOT NULL DEFAULT '[]',
  slot_overrides TEXT NOT NULL DEFAULT '[]',
  is_default     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Routing Logic

When a request is submitted:

1. Load all routing rules for the workflow, ordered by `priority ASC`.
2. For each rule, evaluate ALL conditions against the submitted field values.
3. If all conditions match, use that rule's `slot_overrides` as the approval chain.
4. If no rule matches, use the workflow's default slots.
5. The `is_default` rule (if any) acts as a catch-all.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/workflows/:id/routing-rules` | List routing rules for a workflow. |
| `POST` | `/api/workflows/:id/routing-rules` | Create a routing rule. Body: `{ name, priority, conditions, slotOverrides, isDefault }`. |
| `PATCH` | `/api/workflows/:id/routing-rules/:ruleId` | Update a routing rule. |
| `DELETE` | `/api/workflows/:id/routing-rules/:ruleId` | Delete a routing rule. |

### Frontend

- **Workflow Edit Page:** New "Routing Rules" tab/section below the slot builder.
  - List of rules with drag-to-reorder priority.
  - "Add Rule" opens a panel: rule name, condition builder (column → operator → value), slot overrides (same slot builder as the workflow).
  - "Default" toggle to mark one rule as the catch-all.
- **Submission Flow:** Transparent to the user — the correct chain is selected automatically based on their form input.
- **Request Detail Page:** Shows which routing rule was applied (e.g., "Route: Over $1,000 — Finance Review").

### Implementation Order

1. Add `workflow_routing_rules` table to seed script.
2. Add TypeScript types.
3. Create `routingService.ts` with `evaluateRules()`.
4. Update `approvalService.submitApproval()` to call routing evaluation and use overridden slots.
5. Create routes + controller for routing rules CRUD.
6. Add routing rule UI to `WorkflowEdit.tsx`.
7. Add "applied rule" display to `WorkflowDetail.tsx`.
8. Test: create rules, submit requests with different values, verify correct chain.

### Testing Checklist

- [ ] Routing rules are created, read, updated, and deleted correctly
- [ ] `greater_than`/`less_than` operators work with numeric field values
- [ ] `equals`/`contains` operators work with text field values
- [ ] `in` operator works with choice field values
- [ ] Multiple conditions are AND-ed together correctly
- [ ] Rules are evaluated in priority order; first match wins
- [ ] Default rule is used when no conditions match
- [ ] Slot overrides are applied correctly on submission
- [ ] Request detail shows which routing rule was applied
- [ ] Workflow without routing rules falls back to default slots

---

## Feature 8: Rich Text & Markdown Descriptions

### Overview

Upgrade plain-text description fields (workflow descriptions, approval step comments, request comments) to support rich text via Markdown. Users can format their text with headings, bold, italic, lists, links, and code blocks. A live preview toggle lets users see the rendered output before saving.

### Dependencies

- **Client:** `react-markdown` + `remark-gfm` for rendering; a lightweight Markdown editor component.
- **Server:** No schema changes needed — existing TEXT columns already store arbitrary strings; Markdown is just a formatting convention.

### Frontend Changes

**New dependency:** `react-markdown` (lightweight, ~15KB gzipped).

```bash
npm install react-markdown remark-gfm
```

**New Component: `MarkdownEditor.tsx`**

- Tabbed interface: "Write" (textarea) / "Preview" (rendered Markdown).
- Toolbar with common formatting buttons (bold, italic, link, list, heading) that insert Markdown syntax.
- Props: `value`, `onChange`, `placeholder`, `minHeight`.

**Updated Components:**

| Component | Change |
|-----------|--------|
| `WorkflowEdit.tsx` | Replace description `<textarea>` with `<MarkdownEditor>`. |
| `WorkflowDetail.tsx` | Render workflow description and step comments with `<ReactMarkdown>`. |
| `Dashboard.tsx` | Render approval step comments (the comment field when approving/rejecting) with `<ReactMarkdown>`. |
| Comment thread (Feature 2) | Use `<MarkdownEditor>` for comment input; render comments with `<ReactMarkdown>`. |

### API Changes

None. The server stores and returns the raw Markdown string. Rendering is client-side only.

### Implementation Order

1. Install `react-markdown` and `remark-gfm` in the client.
2. Build `MarkdownEditor.tsx` component.
3. Update `WorkflowEdit.tsx` description field.
4. Update `WorkflowDetail.tsx` to render descriptions with Markdown.
5. Update `Dashboard.tsx` step comment rendering.
6. (When Feature 2 is built) use `MarkdownEditor` for comment input.
7. Test: write Markdown, toggle preview, verify rendering.

### Testing Checklist

- [ ] Markdown editor renders with Write/Preview tabs
- [ ] Toolbar buttons insert correct Markdown syntax
- [ ] Preview renders headings, bold, italic, lists, links, code blocks correctly
- [ ] Workflow description renders as formatted Markdown on detail page
- [ ] Step comments render as formatted Markdown on Dashboard
- [ ] Raw Markdown is stored correctly in the database (no corruption)
- [ ] XSS: raw HTML in Markdown is not rendered (react-markdown sanitizes by default)
- [ ] Empty/plain-text content degrades gracefully (no broken rendering)

---

## Feature 9: API Keys & Webhooks

### Overview

Enable programmatic access to the approval system via API keys, and allow external services to receive real-time event notifications via webhooks. This opens integration with external tools (Slack, Teams, Zapier, custom scripts, CI/CD pipelines).

### Data Model

#### New Table: `api_keys`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `user_id` | TEXT (FK → users.id) | Owner of the key |
| `name` | TEXT | Human-readable label (e.g., "CI/CD Pipeline") |
| `key_hash` | TEXT | SHA-256 hash of the API key (never store raw key) |
| `key_prefix` | TEXT | First 8 characters for identification (e.g., `ak_abc123...`) |
| `scopes` | TEXT (JSON) | Array of permitted scopes: `["read:workflows", "submit:requests"]` |
| `last_used_at` | TEXT (nullable) | Last usage timestamp |
| `expires_at` | TEXT (nullable) | Expiration date |
| `is_active` | INTEGER (0/1) | Whether the key is enabled |
| `created_at` | TEXT (ISO 8601) | |

#### New Table: `webhook_subscriptions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `user_id` | TEXT (FK → users.id) | Owner |
| `name` | TEXT | Label |
| `url` | TEXT | Target URL to POST events to |
| `secret` | TEXT | HMAC secret for signature verification |
| `events` | TEXT (JSON) | Array of event types to subscribe to |
| `is_active` | INTEGER (0/1) | Whether the webhook is enabled |
| `last_delivery_at` | TEXT (nullable) | Last delivery attempt timestamp |
| `last_delivery_status` | TEXT (nullable) | `'success'` or `'failed'` |
| `created_at` | TEXT (ISO 8601) | |

#### New Table: `webhook_deliveries`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `subscription_id` | TEXT (FK → webhook_subscriptions.id) | Parent subscription |
| `event_type` | TEXT | The event that triggered this delivery |
| `payload` | TEXT (JSON) | The full event payload that was sent |
| `response_status` | INTEGER (nullable) | HTTP status code from the target |
| `response_body` | TEXT (nullable) | Response body from the target |
| `error_message` | TEXT (nullable) | Error detail if delivery failed |
| `duration_ms` | INTEGER (nullable) | Round-trip time |
| `attempted_at` | TEXT (ISO 8601) | When delivery was attempted |

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL,
  scopes       TEXT NOT NULL DEFAULT '["read:workflows"]',
  last_used_at TEXT,
  expires_at   TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  url                 TEXT NOT NULL,
  secret              TEXT NOT NULL,
  events              TEXT NOT NULL DEFAULT '["request.*"]',
  is_active           INTEGER NOT NULL DEFAULT 1,
  last_delivery_at    TEXT,
  last_delivery_status TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         TEXT NOT NULL,
  response_status INTEGER,
  response_body   TEXT,
  error_message   TEXT,
  duration_ms     INTEGER,
  attempted_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### API Key Authentication

API keys are passed via the `Authorization` header using a custom scheme:

```
Authorization: Bearer ak_abc123def456...
```

A new middleware `requireApiKey` validates the key, looks up the user, checks scopes, and attaches `req.user` (same as JWT auth). API keys bypass the normal login flow — they are stateless.

**Scopes:**

| Scope | Allows |
|-------|--------|
| `read:workflows` | List and view workflows |
| `write:workflows` | Create and update workflows |
| `submit:requests` | Submit approval requests |
| `read:requests` | View approval requests and their status |
| `approve:requests` | Approve or reject steps |
| `admin:*` | All admin operations |

### Webhook Events

| Event | Payload |
|-------|---------|
| `request.submitted` | `{ requestId, workflowId, workflowName, requesterId, requesterName, fields, timestamp }` |
| `request.approved` | `{ requestId, workflowId, workflowName, stepId, approverId, approverName, timestamp }` |
| `request.rejected` | `{ requestId, workflowId, workflowName, stepId, approverId, approverName, comment, timestamp }` |
| `request.cancelled` | `{ requestId, workflowId, workflowName, timestamp }` |
| `request.expired` | `{ requestId, workflowId, workflowName, timestamp }` |
| `step.escalated` | `{ requestId, workflowId, stepId, escalatedToGroupId, timestamp }` |

**Delivery:** Webhooks are delivered asynchronously (fire-and-forget, non-blocking) with:
- `X-Webhook-Signature` header (HMAC-SHA256 of the payload using the subscription secret).
- Retry up to 3 times with exponential backoff (1s, 5s, 25s) on failure.
- All delivery attempts logged to `webhook_deliveries`.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/api-keys` | Create a new API key. Returns the full key ONCE (never stored, only shown at creation). |
| `GET` | `/api/api-keys` | List user's API keys (shows prefix, name, scopes, last used — never the full key). |
| `DELETE` | `/api/api-keys/:id` | Revoke an API key. |
| `POST` | `/api/webhooks` | Create a webhook subscription. |
| `GET` | `/api/webhooks` | List user's webhook subscriptions. |
| `PATCH` | `/api/webhooks/:id` | Update a webhook subscription. |
| `DELETE` | `/api/webhooks/:id` | Delete a webhook subscription. |
| `GET` | `/api/webhooks/:id/deliveries` | List recent delivery attempts for a webhook. |

### Frontend

- **Settings Page:** New "API Keys" section.
  - List of existing keys (prefix, name, scopes, last used, status).
  - "Generate New Key" button → modal with name, scope checkboxes, optional expiry.
  - After creation, show the full key once with a "Copy" button and warning: "Store this securely. You won't see it again."
  - "Revoke" button with confirmation.
- **Settings Page:** New "Webhooks" section.
  - List of subscriptions (name, URL, events, status, last delivery).
  - "Add Webhook" form: name, URL, event type checkboxes.
  - "Test" button to send a ping event.
  - Delivery log table (expandable to see payload and response).

### Implementation Order

1. Add tables to seed script.
2. Add TypeScript types.
3. Create `apiKeyService.ts` with `generateKey()`, `validateKey()`, `revokeKey()`.
4. Create `requireApiKey` middleware.
5. Create `webhookService.ts` with `createSubscription()`, `deliverEvent()`.
6. Hook `webhookService.deliverEvent()` into all mutation points (submit, approve, reject, cancel, expire).
7. Create routes + controllers for API keys and webhooks.
8. Add API key management UI to Settings page.
9. Add webhook management UI to Settings page.
10. Test: create key, use it to submit a request, verify webhook delivery.

### Testing Checklist

- [ ] `POST /api/api-keys` creates a key and returns it once
- [ ] `GET /api/api-keys` lists keys without exposing the full key
- [ ] `DELETE /api/api-keys/:id` revokes the key (subsequent requests with it return 401)
- [ ] API key auth works with `Authorization: Bearer ak_...` header
- [ ] Scopes are enforced (e.g., `read:workflows` key cannot submit requests)
- [ ] `POST /api/webhooks` creates a subscription with a generated secret
- [ ] Webhook delivers `request.submitted` event to target URL on submission
- [ ] Webhook signature header is valid (HMAC-SHA256)
- [ ] Failed deliveries are retried up to 3 times
- [ ] `GET /api/webhooks/:id/deliveries` shows delivery history
- [ ] "Test" button sends a ping event successfully
- [ ] API key and webhook UIs are functional on Settings page

---

## Consolidated Implementation Priority

If implementing all features, the recommended order is:

1. **Comments** (Feature 2) — highest user impact, enables collaboration.
2. **Email Notifications** (Feature 1) — essential for real-world adoption.
3. **Bulk Actions** (Feature 4) — quick win, small effort, high ROI for power users.
4. **Rich Text & Markdown** (Feature 8) — quick win, small effort, improves UX across the app.
5. **Dashboard Analytics** (Feature 3) — valuable but depends on having enough data.
6. **Auto-Expiry & SLA Deadlines** (Feature 6) — important for production reliability.
7. **Conditional Approval Routing** (Feature 7) — powerful automation, builds on existing slot system.
8. **API Keys & Webhooks** (Feature 9) — unlocks integrations, requires stable API surface.
9. **Audit Log** (Bonus) — important for compliance, can be added incrementally.
10. **Request Templates** (Feature 5) — nice-to-have, lower urgency.

Each feature is independent and can be built in isolation. The only shared dependency is the **User Notifications** system (Feature 1 and Feature 2 add new notification types that depend on the notifications table and service created in `user-notifications.md`). Feature 8 (Rich Text) has no server dependencies and can be built at any time. Feature 6 (Auto-Expiry) requires a background job runner. Feature 9 (API Keys & Webhooks) depends on the API surface being stable.

---

## Open Questions for Review

1. **Email provider:** Should the default be Nodemailer + SMTP (zero cost, self-managed) or a third-party API like Resend/SendGrid (easier deliverability)? **Proposed:** Start with Nodemailer + SMTP, abstract behind an `EmailProvider` interface so it's swappable.

2. **Comment editing/deletion:** Should comments be editable or deletable by their author? **Proposed:** No editing (to preserve audit trail). Authors can delete their own comments within 5 minutes of posting (soft-delete, show "This comment was deleted" placeholder).

3. **Analytics date range:** Should the analytics page support custom date ranges, or only show the last 30 days? **Proposed:** Start with last 30 days and a "Last 7 days / Last 30 days / Last 90 days" dropdown. Custom date range can be added later.

4. **Audit log retention:** Should audit logs be automatically purged after a certain period (e.g., 1 year)? **Proposed:** No automatic purge initially. Add a manual "Purge logs older than X" admin action if storage becomes a concern.

5. **Template sharing:** Should users be able to share templates with specific teammates, or only admin-created "shared" templates? **Proposed:** Start with owner-only + admin-shared. Team-level sharing can be a future enhancement.

6. **SLA background job:** Should the deadline checker run in-process (setInterval in the Node server) or as a separate cron job? **Proposed:** Start with in-process setInterval for simplicity. Extract to a separate worker if the server scales to multiple instances.

7. **Conditional routing UI complexity:** The condition builder could become complex with nested AND/OR logic. Should v1 support only flat AND conditions? **Proposed:** Start with flat AND-only conditions. Add OR groups and nested logic in v2 if user demand warrants it.

8. **API key scope granularity:** Should scopes be per-workflow (e.g., `submit:requests:workflow-123`) or global? **Proposed:** Start with global scopes. Per-workflow scoping can be added later if needed for multi-tenant or sensitive workflows.

9. **Webhook retry policy:** Should failed webhooks be retried indefinitely or have a cap? **Proposed:** Cap at 3 retries with exponential backoff. After 3 failures, disable the subscription and notify the owner. Manual re-enable required.