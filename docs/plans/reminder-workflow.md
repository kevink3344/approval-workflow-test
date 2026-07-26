# Reminder Workflow — Implementation Plan

**Date:** 2026-07-25
**Status:** Planning

---

## Overview

Unlike an approval workflow (where a user submits a request and approvers act on it), a **reminder workflow** is a one-to-many broadcast initiated by a manager/admin. For example: a manager triggers "Submit your weekly report" and all targeted users receive a notification.

---

## Architecture Decision

**Chosen: Option B — Standalone `reminders` system** with its own table, routes, and UI.

This is cleaner than extending the existing `workflows` table because reminders have fundamentally different behavior from approvals:
- No submission flow
- No approval steps/statuses
- No resolution logic
- Target-based distribution (not sequential slots)

---

## Implementation Plan

### Phase 1 — Prerequisite: Build the Notification Infrastructure

Since reminders must be delivered to users, we need the notification system first. This draws from the existing `docs/plans/user-notifications.md` plan.

#### Database

`notifications` table:
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID FK | Target user |
| type | VARCHAR | `reminder`, `approval_submitted`, `step_approved`, `step_rejected`, `request_approved`, `request_rejected`, `request_cancelled`, `workflow_updated` |
| title | VARCHAR | Short title |
| message | TEXT | Full message body |
| link | VARCHAR (nullable) | Optional URL to navigate to |
| is_read | BOOLEAN | Default false |
| created_at | TIMESTAMP | When created |

#### Backend API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List current user's notifications (paginated) |
| PATCH | `/api/notifications/:id/read` | Mark single notification as read |
| PATCH | `/api/notifications/read-all` | Mark all notifications as read |
| GET | `/api/notifications/unread-count` | Get unread badge count |

- Notification creation helper function (used by reminders + approval events)

#### Frontend

- Bell icon with unread badge in the `Layout` header
- Notifications dropdown panel (clickable bell)
- Notifications page at `/notifications` (full history)

---

### Phase 2 — Build the Reminder System

#### Database

`reminder_templates` table:
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | Template name |
| description | TEXT (nullable) | Optional description |
| message_body | TEXT | Template message text |
| target_type | VARCHAR | `all_users`, `specific_users`, `approval_group` |
| target_group_id | UUID FK (nullable) | FK to `approval_groups`, used when target_type = `approval_group` |
| created_by | UUID FK | FK to `users` |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| status | VARCHAR | `active`, `archived` |

`reminder_instances` table:
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| template_id | UUID FK | FK to `reminder_templates` |
| sender_id | UUID FK | FK to `users` — who triggered the send |
| message | TEXT | Final rendered message |
| sent_at | TIMESTAMP | When it was sent |

`reminder_instance_recipients` table:
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| instance_id | UUID FK | FK to `reminder_instances` |
| user_id | UUID FK | FK to `users` |
| notification_id | UUID FK | FK to `notifications` |
| acknowledged | BOOLEAN | Default false — "read receipt" |

#### Backend API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reminders/templates` | List reminder templates |
| POST | `/api/reminders/templates` | Create template (admin/manager) |
| GET | `/api/reminders/templates/:id` | Get template detail |
| PATCH | `/api/reminders/templates/:id` | Update template |
| DELETE | `/api/reminders/templates/:id` | Delete template |
| POST | `/api/reminders/templates/:id/send` | **Trigger** — sends to all target users, creates notifications |
| GET | `/api/reminders/history` | Past sent reminders with delivery stats |

#### Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/reminders` | Reminders list | List reminder templates (admin/manager view) |
| `/reminders/new` | Create reminder | Form: name, message body, target selection |
| `/reminders/:id` | Template detail | View template with "Send Now" button |
| (dashboard) | Reminder history | Table showing past sends with delivery stats |

#### Target Selection UI

When creating/editing a reminder template, the user selects:
- **All Users** — broadcasts to every user in the system
- **Approval Group** — selects from existing `approval_groups` (e.g., "Engineering Team")
- **Specific Users** — multi-select from user list

---

### Phase 3 — Dashboard & Notification Integration

- Add "My Reminders" section to the Dashboard showing recent reminders received
- Add a "Send Reminder" quick-action button for managers/admins (visible on Dashboard or in navigation)
- Notification bell shows reminder notifications alongside approval notifications
- Notifications link directly to the relevant page (e.g., reminder detail, approval request)

---

## User Flow Example

1. Manager navigates to `/reminders` → clicks "New Reminder"
2. Fills in:
   - **Name:** "Weekly Report"
   - **Message:** "Please submit your weekly report by Friday 5pm"
   - **Target:** "All Users" (or selects an approval group like "Engineering Team")
3. Saves template → clicks "Send Now"
4. System resolves target users, creates:
   - `reminder_instance` record
   - `reminder_instance_recipients` for each target user
   - `notification` for each recipient
5. Users see a bell badge, open the notification, read the reminder
6. Manager can view history to see who received it and who acknowledged it

---

## Open Decisions

1. **Who can send reminders?** Should this be admin-only, or also available to users with the `approver` role (managers)? I suggest admin + users with a new `can_send_reminders` permission, defaulting to admin-only.

2. **Recurring reminders?** Should reminders support scheduling (e.g., every Monday at 9am), or are they always manually triggered? Manual-only is simpler for v1; recurrence could be a follow-up.

3. **Acknowledgment tracking?** Should recipients be able to "acknowledge" a reminder (like a read receipt)? This adds a simple boolean but could be useful for managers to see who's seen the reminder.

4. **Email integration?** Currently the app has no email infrastructure. Should reminders also send emails, or stay in-app only? In-app only for v1 is simplest.

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Notification Infrastructure | ~2-3 hours |
| Phase 2: Reminder System | ~3-4 hours |
| Phase 3: Dashboard Integration | ~1-2 hours |
| **Total** | **~6-9 hours** |