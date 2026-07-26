# User Notifications — Implementation Plan

**Date:** 2026-07-25

**Status:** Pending Review

---

## Overview

This plan introduces a **User Notifications** system that is reusable across any application. Users receive notifications when events occur (e.g., approval requests submitted, steps approved/rejected, workflow changes). A bell icon with an unread count badge sits next to the logged-in user's name in the header. Clicking the bell opens a preview dropdown with the five most recent notifications and a "View All" link. The full Notifications page supports searching and filtering by status (Unread, Read, Archived). Users can mark notifications as read, mark as unread, or delete them individually.

---

## Requirements Summary

| # | Requirement |
|---|------------|
| R1 | Users receive notifications when meaningful application events occur. |
| R2 | A **bell icon** with an **unread count badge** appears next to the logged-in user's name in the header. |
| R3 | Clicking the bell opens a **preview dropdown** showing the 5 most recent notifications, with a "View All" link. |
| R4 | A dedicated **Notifications page** (`/notifications`) displays all notifications for the authenticated user. |
| R5 | Users can **search** notifications by text content. |
| R6 | Users can **filter** notifications by status: **Unread**, **Read**, and **Archived**. |
| R7 | Users can **mark a notification as read**. |
| R8 | Users can **mark a notification as unread**. |
| R9 | Users can **delete** a notification (soft-delete → status becomes `archived`). |
| R10 | All notification endpoints are documented in **Swagger UI** with sample data for testing. |

---

## Data Model Changes

### New Table: `notifications`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `user_id` | TEXT (FK → users.id) | The recipient user |
| `type` | TEXT | Notification type (e.g., `approval_submitted`, `step_approved`, `step_rejected`, `request_approved`, `request_rejected`, `request_cancelled`, `workflow_updated`, `general`) |
| `title` | TEXT | Short title (e.g., "Expense Report Approved") |
| `message` | TEXT | Detailed message body |
| `link` | TEXT (nullable) | Optional deep-link URL (e.g., `/workflows/abc123`) |
| `status` | TEXT | `'unread'`, `'read'`, or `'archived'` |
| `created_at` | TEXT (ISO 8601) | When the notification was created |
| `read_at` | TEXT (ISO 8601) (nullable) | When the user read the notification |

### Indexes

```sql
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
```

### Migration SQL (DDL)

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  link       TEXT,
  status     TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread', 'read', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
```

### Notification Types (Enum)

| Type | Trigger Event |
|------|--------------|
| `approval_submitted` | A user submits a new approval request |
| `step_approved` | An approver approves a step |
| `step_rejected` | An approver rejects a step |
| `request_approved` | An entire approval request is fully approved |
| `request_rejected` | An entire approval request is rejected |
| `request_cancelled` | An approval request is cancelled |
| `workflow_updated` | A workflow definition is updated (notify requesters) |
| `general` | Generic system notification |

---

## ERD Relationship

```
┌──────────┐       1      N  ┌────────────────┐
│  users   │────────────────<│  notifications │
└──────────┘                 └────────────────┘
```

Each user has zero or more notifications. Notifications are scoped to a single recipient.  (No broadcasting — each event creates one notification row per intended recipient.)

---

## API Endpoints

All endpoints under `/api/notifications` require authentication (`authenticateToken` middleware). A user can only access their own notifications.

### Notifications CRUD

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notifications` | List notifications for the authenticated user. Supports query params: `?status=unread\|read\|archived` and `?search=text`. Returns the 50 most recent by default. |
| `GET` | `/api/notifications/count` | Returns the **unread count** for the authenticated user (for the bell badge). |
| `GET` | `/api/notifications/preview` | Returns the **5 most recent unread** notifications (for the bell dropdown). |
| `PATCH` | `/api/notifications/:id/read` | Mark a single notification as **read**. Sets `status = 'read'` and `read_at = now`. |
| `PATCH` | `/api/notifications/:id/unread` | Mark a single notification as **unread**. Sets `status = 'unread'` and clears `read_at`. |
| `PATCH` | `/api/notifications/mark-all-read` | Mark **all** of the authenticated user's notifications as read. |
| `DELETE` | `/api/notifications/:id` | Soft-delete a notification. Sets `status = 'archived'`. Archived notifications are hidden from the main list (filter `archived` to view). |
| `DELETE` | `/api/notifications/clear-archived` | Permanently delete all archived notifications for the authenticated user. |

### Query Parameters for `GET /api/notifications`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | (all non-archived) | Filter: `unread`, `read`, or `archived`. Omit to return unread + read. |
| `search` | string | (none) | Case-insensitive search across `title` and `message`. |
| `limit` | integer | 50 | Max results to return (1–100). |
| `offset` | integer | 0 | Pagination offset. |

---

## Backend Implementation Steps

### Phase 1 — Database & Models

1. **Create the `notifications` table** by adding the DDL to `server/src/config/seed.ts` (or a new migration).
2. **Re-run the seed script** to create the table:
   ```bash
   cd server && npm run db:seed
   ```
3. **Add TypeScript types** to `server/src/types/index.ts`:
   ```ts
   export type NotificationStatus = 'unread' | 'read' | 'archived';

   export type NotificationType =
     | 'approval_submitted'
     | 'step_approved'
     | 'step_rejected'
     | 'request_approved'
     | 'request_rejected'
     | 'request_cancelled'
     | 'workflow_updated'
     | 'general';

   export interface Notification {
     id: string;
     userId: string;
     type: NotificationType;
     title: string;
     message: string;
     link: string | null;
     status: NotificationStatus;
     createdAt: Date;
     readAt: Date | null;
   }

   export interface CreateNotificationPayload {
     userId: string;
     type: NotificationType;
     title: string;
     message: string;
     link?: string;
   }
   ```
4. **Create the service layer** at `server/src/services/notificationService.ts` with functions:
   - `getNotifications(userId, filters)` — list with search/filter/pagination
   - `getUnreadCount(userId)` — returns `{ count: number }`
   - `getPreview(userId)` — returns 5 most recent unread
   - `createNotification(payload)` — insert a new notification (called by other services on events)
   - `markAsRead(notificationId, userId)` — set status to `read`
   - `markAsUnread(notificationId, userId)` — set status to `unread`
   - `markAllRead(userId)` — bulk update
   - `archiveNotification(notificationId, userId)` — soft-delete
   - `clearArchived(userId)` — hard-delete archived

### Phase 2 — Routes & Controllers

5. **Create the controller** at `server/src/controllers/notificationController.ts`:
   - Each function calls the corresponding service method.
   - Validates that `req.user.id` matches the `userId` for the requested resource.
   - Returns proper HTTP status codes (`200`, `201`, `400`, `404`).

6. **Create the routes** at `server/src/routes/notifications.ts`:
   ```ts
   import { Router } from 'express';
   import { authenticateToken } from '../middleware/auth';
   import * as ctrl from '../controllers/notificationController';

   const router = Router();
   router.use(authenticateToken);

   router.get('/', ctrl.list);                    // GET  /api/notifications
   router.get('/count', ctrl.unreadCount);        // GET  /api/notifications/count
   router.get('/preview', ctrl.preview);          // GET  /api/notifications/preview
   router.patch('/mark-all-read', ctrl.markAllRead); // PATCH /api/notifications/mark-all-read
   router.patch('/:id/read', ctrl.markAsRead);    // PATCH /api/notifications/:id/read
   router.patch('/:id/unread', ctrl.markAsUnread);// PATCH /api/notifications/:id/unread
   router.delete('/clear-archived', ctrl.clearArchived); // DELETE /api/notifications/clear-archived
   router.delete('/:id', ctrl.archive);           // DELETE /api/notifications/:id

   export default router;
   ```
   > **Important ordering:** `/count`, `/preview`, `/mark-all-read`, and `/clear-archived` must be registered **before** `/:id` routes to avoid Express matching the literal strings as `:id` params.

7. **Register routes** in `server/src/app.ts`:
   ```ts
   import notificationsRouter from './routes/notifications';
   app.use('/api/notifications', notificationsRouter);
   ```

### Phase 3 — Emit Notifications on Events

8. **Wire up notification creation** inside existing service methods. For example, in `server/src/services/approvalService.ts`:
   - When a request is submitted → create `approval_submitted` notifications for all approvers in the first slot.
   - When a step is approved/rejected → create `step_approved`/`step_rejected` notifications for the requester.
   - When a request is fully approved/rejected → create `request_approved`/`request_rejected` notifications for the requester.
   - When a request is cancelled → create `request_cancelled` notifications for all pending approvers.

   Each event calls `notificationService.createNotification(...)` for each recipient.

> **Note for reusability:** In any project, wherever a meaningful event occurs, call `createNotification` with the appropriate recipient user IDs. This pattern works across any domain — e.g., task assignments, comment mentions, payment confirmations, etc.

### Phase 4 — Swagger Documentation

9. **Add JSDoc annotations** to `server/src/routes/notifications.ts` for all endpoints (see Appendix A below).
10. **Add schemas** to `server/src/config/swagger.ts` for `Notification` and related request/response shapes.

---

## Frontend Implementation Steps

### Phase 5 — Client Types & API Client

11. **Add client-side types** to `client/src/types/index.ts`:
    ```ts
    export type NotificationStatus = 'unread' | 'read' | 'archived';

    export type NotificationType =
      | 'approval_submitted'
      | 'step_approved'
      | 'step_rejected'
      | 'request_approved'
      | 'request_rejected'
      | 'request_cancelled'
      | 'workflow_updated'
      | 'general';

    export interface Notification {
      id: string;
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      link: string | null;
      status: NotificationStatus;
      createdAt: string;
      readAt: string | null;
    }

    export interface NotificationCount {
      count: number;
    }
    ```

12. **Add API functions** to `client/src/api/client.ts`:
    ```ts
    export async function fetchNotifications(params?: {
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }): Promise<Notification[]> { /* GET /api/notifications */ }

    export async function fetchUnreadCount(): Promise<NotificationCount> { /* GET /api/notifications/count */ }

    export async function fetchNotificationPreview(): Promise<Notification[]> { /* GET /api/notifications/preview */ }

    export async function markNotificationRead(id: string): Promise<void> { /* PATCH /api/notifications/:id/read */ }

    export async function markNotificationUnread(id: string): Promise<void> { /* PATCH /api/notifications/:id/unread */ }

    export async function markAllNotificationsRead(): Promise<void> { /* PATCH /api/notifications/mark-all-read */ }

    export async function deleteNotification(id: string): Promise<void> { /* DELETE /api/notifications/:id */ }

    export async function clearArchivedNotifications(): Promise<void> { /* DELETE /api/notifications/clear-archived */ }
    ```

### Phase 6 — Bell Icon & Preview Dropdown

13. **Create `NotificationBell.tsx`** in `client/src/components/`:
    - Fetches unread count on mount and on a configurable polling interval (e.g., every 30 seconds).
    - Renders a **bell icon** (SVG) with a **red badge** showing the unread count.
    - Clicking the bell toggles a **dropdown panel** that:
      - Fetches and displays the 5 most recent notifications (via `/api/notifications/preview`).
      - Each item shows: title (bold if unread), timestamp (relative — "2 min ago"), and a click-to-dismiss "Mark Read" button.
      - Footer has a **"View All"** link → navigates to `/notifications`.
    - Clicking outside the dropdown closes it.
    - The bell icon and dropdown are **reusable** — simply drop `<NotificationBell />` into any header/layout.

14. **Integrate `NotificationBell` into `Layout.tsx`** — place it immediately to the left of the user's name in the right-side header area:
    ```
    [Bell Icon]  {user.name}  Sign Out
    ```

### Phase 7 — Notifications Main Page

15. **Create `NotificationsPage.tsx`** in `client/src/pages/`:
    - **Route:** `/notifications`
    - **Layout:**
      - Page title: "Notifications"
      - Search bar (text input, debounced 300ms, searches `title` and `message`)
      - Filter tabs/pills: **All** | **Unread** | **Read** | **Archived**
      - "Mark All Read" button (only visible when there are unread items)
      - "Clear Archived" button (only visible on Archived tab)
    - **Notification list:** Each row shows:
      - Status indicator dot (blue = unread, gray = read, strikethrough = archived)
      - Title (clickable if `link` is present → navigates to the link)
      - Message preview (truncated to 2 lines)
      - Relative timestamp ("3 hours ago")
      - Action buttons:
        - Unread: **Mark Read** button
        - Read: **Mark Unread** button
        - Any non-archived: **Archive** (delete) button with confirmation
    - **Pagination:** "Load More" button or infinite scroll (fetch next 50 on scroll to bottom).
    - **Empty state:** "No notifications yet" with an appropriate icon.

16. **Add route** in `client/src/App.tsx` (assuming React Router):
    ```tsx
    <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
    ```

---

## UI/UX Design Notes

| Element | Specification |
|---------|--------------|
| Bell Icon | SVG bell from Heroicons or Lucide. 24×24px. White or dark depending on header theme. |
| Badge | Red circle (`bg-red-500`), white text, positioned top-right of bell. Hidden when count = 0. |
| Preview Dropdown | White card, 320px wide, max-height 400px with internal scroll. Shadow: `shadow-lg`. Border-radius: 8px. |
| Notification Row | Padding 12px, hover background `bg-gray-50`. Unread items have a blue left-border accent. |
| Mark All Read | Text button, secondary style. |
| Filter Tabs | Horizontal pill tabs, active tab has filled background. |
| Mobile | Preview dropdown is full-width on small screens. Notifications page uses full-width cards. |

---

## Security & Access Control

- **All `/api/notifications` endpoints** require `authenticateToken` middleware.
- A user can **only** access their own notifications. The `userId` parameter is always taken from `req.user.id`, never from the request body or query.
- No admin override — notifications are always scoped to the authenticated user.
- The `link` field is sanitized to prevent open redirect attacks (only relative paths or same-origin URLs allowed).

---

## Edge Cases & Design Decisions

1. **What happens when a notification is deleted?**
   - Soft-delete: `status` becomes `archived`. The notification is hidden from the main list but visible under the "Archived" filter. Permanently deleting archived notifications is done via "Clear Archived."

2. **How many notifications are kept in preview?**
   - Only the 5 most recent unread notifications. This keeps the dropdown lightweight and fast.

3. **Polling strategy for unread count?**
   - The bell icon polls `/api/notifications/count` every 30 seconds. Alternatively, use a short-lived `setInterval` and clear it on unmount. For real-time, a future enhancement could use WebSockets/SSE.

4. **What if an event should notify multiple users?**
   - The service creates one `notifications` row per recipient. For example, when an approval request is submitted, all approvers in the first slot receive an `approval_submitted` notification.

5. **Are notifications created for the actor?**
   - No. A user does not receive a notification for their own action (e.g., the requester does not get "Request Submitted" — they just see the request on their dashboard).

6. **What about notification preferences / opt-out?**
   - Out of scope for this plan. Future enhancement: a per-user settings page to toggle which notification types they receive.

7. **Archived notification cleanup?**
   - "Clear Archived" permanently deletes all archived notifications for the user. This is a hard delete from the database.

---

## Implementation Order

### Phase 1 — Database & Backend Foundation
1. Add `notifications` table DDL to seed script.
2. Run seed to create the table.
3. Add server-side TypeScript types.
4. Create `notificationService.ts` with all CRUD functions.
5. Create `notificationController.ts`.
6. Create `routes/notifications.ts`.
7. Register routes in `app.ts`.

### Phase 2 — Swagger Documentation
8. Add JSDoc annotations to `routes/notifications.ts`.
9. Add `Notification` schema to `swagger.ts`.

### Phase 3 — Emit Notifications
10. Integrate `createNotification` calls into existing services (approval events, workflow events).

### Phase 4 — Frontend: Bell & Preview
11. Add client-side types.
12. Add API client functions.
13. Build `NotificationBell.tsx` component.
14. Integrate bell into `Layout.tsx`.

### Phase 5 — Frontend: Notifications Page
15. Build `NotificationsPage.tsx`.
16. Add route in `App.tsx`.

### Phase 6 — Testing All CRUD Endpoints via Swagger UI
17. Use the Swagger UI at `/api-docs` to test every notification endpoint with sample data (see below).

---

## Testing CRUD API Endpoints via Swagger UI (Phase 6)

This section provides a step-by-step testing plan that can be executed entirely from the **Swagger UI** at `/api-docs`. Sample data is provided for each request.

> **Prerequisites:**
> - The server is running (`npm run dev`).
> - The database has been seeded (`npm run db:seed`) and the `notifications` table exists.
> - You are authenticated in Swagger UI (click the **Authorize** button and paste a valid JWT token from a login response).
> - The authenticated user's `id` is known (call `GET /api/auth/me` to retrieve it).

### Step 1: Verify Unread Count Starts at Zero

| | |
|---|---|
| **Endpoint** | `GET /api/notifications/count` |
| **Expected** | `200` with `{ "count": 0 }` |
| **Swagger** | Expand the "Notifications" tag → `GET /api/notifications/count` → **Execute** |

### Step 2: Verify Preview Returns Empty Array

| | |
|---|---|
| **Endpoint** | `GET /api/notifications/preview` |
| **Expected** | `200` with `[]` (empty array) |
| **Swagger** | `GET /api/notifications/preview` → **Execute** |

### Step 3: Verify Notification List Returns Empty Array

| | |
|---|---|
| **Endpoint** | `GET /api/notifications` |
| **Expected** | `200` with `[]` |
| **Swagger** | `GET /api/notifications` → **Execute** |

### Step 4: Seed Sample Notifications via the Service Layer

Since there's no public `POST /api/notifications` endpoint (notifications are created internally by services), use a curl command or a temporary script to seed test data:

```bash
# Seed test notifications directly via SQLite
# Run this from server/ directory
npx ts-node -e "
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'app.db'));

// Replace with your actual user ID from GET /api/auth/me
const USER_ID = '<your-user-id>';

const now = new Date().toISOString();
const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

const insert = db.prepare('INSERT INTO notifications (id, user_id, type, title, message, link, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

insert.run(uuidv4(), USER_ID, 'approval_submitted', 'New Approval Request', 'John submitted \"Quarterly Budget\" for your review.', '/workflows/abc-001', 'unread', now);
insert.run(uuidv4(), USER_ID, 'step_approved', 'Step Approved', 'Jane approved your step in \"Expense Report Q3\".', '/workflows/abc-002', 'unread', oneHourAgo);
insert.run(uuidv4(), USER_ID, 'request_approved', 'Request Fully Approved', 'Your \"Travel Reimbursement\" request has been fully approved!', '/workflows/abc-003', 'unread', twoHoursAgo);
insert.run(uuidv4(), USER_ID, 'request_rejected', 'Request Rejected', 'Your \"Equipment Purchase\" request was rejected by Alice.', '/workflows/abc-004', 'read', oneDayAgo);
insert.run(uuidv4(), USER_ID, 'general', 'Welcome!', 'Welcome to the approval workflow system. You will receive notifications here when actions are taken on your requests.', null, 'read', oneDayAgo);
insert.run(uuidv4(), USER_ID, 'request_cancelled', 'Request Cancelled', 'The \"Office Supplies\" request was cancelled by the requester.', '/workflows/abc-005', 'archived', oneDayAgo);

console.log('Sample notifications seeded successfully.');
"
```

**Alternatively**, use a dedicated `POST /api/notifications/test/seed` endpoint (temporary, added only during testing) or use the Swagger "Try it out" on the approvals endpoints to trigger real notifications.

### Step 5: Verify Unread Count

| | |
|---|---|
| **Endpoint** | `GET /api/notifications/count` |
| **Expected** | `200` with `{ "count": 3 }` (the 3 unread notifications) |
| **Swagger** | `GET /api/notifications/count` → **Execute** |

### Step 6: Verify Preview Returns 5 Most Recent Unread

| | |
|---|---|
| **Endpoint** | `GET /api/notifications/preview` |
| **Expected** | `200` with array of up to 5 notifications, all with `status: "unread"`, ordered by `createdAt` descending |
| **Swagger** | `GET /api/notifications/preview` → **Execute** |
| **Check** | Title, message, link (non-null for some), createdAt are populated |

### Step 7: List All Notifications (No Filter)

| | |
|---|---|
| **Endpoint** | `GET /api/notifications` |
| **Expected** | `200` with array of 5 notifications (the archived one is excluded by default), ordered by `createdAt` descending |
| **Swagger** | `GET /api/notifications` → **Execute** |
| **Check** | All non-archived notifications returned. Response includes `id`, `userId`, `type`, `title`, `message`, `link`, `status`, `createdAt`, `readAt` |

### Step 8: Filter by Unread Status

| | |
|---|---|
| **Endpoint** | `GET /api/notifications?status=unread` |
| **Swagger** | Add parameter `status` = `unread` → **Execute** |
| **Expected** | `200` with exactly 3 notifications, all `status: "unread"` |

### Step 9: Filter by Read Status

| | |
|---|---|
| **Endpoint** | `GET /api/notifications?status=read` |
| **Swagger** | Add parameter `status` = `read` → **Execute** |
| **Expected** | `200` with exactly 2 notifications, all `status: "read"` |

### Step 10: Filter by Archived Status

| | |
|---|---|
| **Endpoint** | `GET /api/notifications?status=archived` |
| **Swagger** | Add parameter `status` = `archived` → **Execute** |
| **Expected** | `200` with exactly 1 notification, `status: "archived"` |

### Step 11: Search Notifications

| | |
|---|---|
| **Endpoint** | `GET /api/notifications?search=budget` |
| **Swagger** | Add parameter `search` = `budget` → **Execute** |
| **Expected** | `200` with the notification containing "Quarterly Budget" in its title/message. |
| **Check** | Case-insensitive match works. |

| | |
|---|---|
| **Endpoint** | `GET /api/notifications?search=nonexistent` |
| **Expected** | `200` with `[]` |

### Step 12: Pagination

| | |
|---|---|
| **Endpoint** | `GET /api/notifications?limit=2&offset=0` |
| **Swagger** | Add `limit` = `2`, `offset` = `0` → **Execute** |
| **Expected** | `200` with at most 2 results |

| | |
|---|---|
| **Endpoint** | `GET /api/notifications?limit=2&offset=2` |
| **Swagger** | Add `limit` = `2`, `offset` = `2` → **Execute** |
| **Expected** | `200` with the next page of results (different IDs from offset=0) |

### Step 13: Mark Single Notification as Read

| | |
|---|---|
| **Prerequisite** | Copy the `id` of one of the **unread** notifications from Step 8. |
| **Endpoint** | `PATCH /api/notifications/{id}/read` |
| **Swagger** | Enter the notification `id` → **Execute** |
| **Expected** | `200` with the updated notification: `status` = `"read"`, `readAt` is now populated (ISO date string) |
| **Verify** | Call `GET /api/notifications/count` — count should decrease by 1. |

### Step 14: Mark Single Notification as Unread

| | |
|---|---|
| **Prerequisite** | Copy the `id` of a **read** notification. |
| **Endpoint** | `PATCH /api/notifications/{id}/unread` |
| **Swagger** | Enter the notification `id` → **Execute** |
| **Expected** | `200` with the updated notification: `status` = `"unread"`, `readAt` = `null` |
| **Verify** | Call `GET /api/notifications/count` — count should increase by 1. |

### Step 15: Mark All as Read

| | |
|---|---|
| **Endpoint** | `PATCH /api/notifications/mark-all-read` |
| **Swagger** | **Execute** |
| **Expected** | `200` with `{ "message": "All notifications marked as read." }` |
| **Verify** | Call `GET /api/notifications/count` — should return `{ "count": 0 }`. |
| **Verify** | Call `GET /api/notifications?status=unread` — should return `[]`. |

### Step 16: Delete (Archive) a Notification

| | |
|---|---|
| **Prerequisite** | Copy the `id` of any **non-archived** notification. |
| **Endpoint** | `DELETE /api/notifications/{id}` |
| **Swagger** | Enter the notification `id` → **Execute** |
| **Expected** | `200` with `{ "message": "Notification archived." }` |
| **Verify** | Call `GET /api/notifications?status=archived` — the archived notification should appear. |

### Step 17: Access Control — Cannot Access Another User's Notifications

| | |
|---|---|
| **Prerequisite** | Get a notification `id` belonging to the authenticated user. |
| **Endpoint** | `PATCH /api/notifications/{id}/read` |
| **Swagger** | Enter the valid `id` → **Execute** |
| **Expected** | `200` (the user owns this notification). |
| **Swagger** | Switch to a **different user's JWT** (if available) and try to access the same notification `id`. |
| **Expected** | `404` ("Notification not found") — the server must not leak that the notification exists for another user. |

### Step 18: Clear All Archived Notifications

| | |
|---|---|
| **Endpoint** | `DELETE /api/notifications/clear-archived` |
| **Swagger** | **Execute** |
| **Expected** | `200` with `{ "message": "Archived notifications cleared." }` |
| **Verify** | Call `GET /api/notifications?status=archived` — should return `[]`. |

### Step 19: 404 for Non-Existent Notification

| | |
|---|---|
| **Endpoint** | `PATCH /api/notifications/00000000-0000-0000-0000-000000000000/read` |
| **Swagger** | Enter a fake UUID → **Execute** |
| **Expected** | `404` with `{ "message": "Notification not found." }` |

### Testing Checklist Summary

- [ ] `GET /api/notifications/count` returns 0 when no unread notifications
- [ ] `GET /api/notifications/preview` returns empty array when no unread notifications
- [ ] `GET /api/notifications` returns empty array with no data
- [ ] After seeding sample data, `GET /api/notifications/count` returns correct unread count
- [ ] `GET /api/notifications/preview` returns up to 5 most recent unread, with all fields populated
- [ ] `GET /api/notifications` returns all non-archived notifications
- [ ] `GET /api/notifications?status=unread` filters correctly
- [ ] `GET /api/notifications?status=read` filters correctly
- [ ] `GET /api/notifications?status=archived` filters correctly
- [ ] `GET /api/notifications?search=term` performs case-insensitive text search
- [ ] `GET /api/notifications?limit=2&offset=0` paginates correctly
- [ ] `PATCH /api/notifications/:id/read` marks as read and sets `readAt`
- [ ] `PATCH /api/notifications/:id/unread` marks as unread and clears `readAt`
- [ ] `PATCH /api/notifications/mark-all-read` marks all as read
- [ ] `DELETE /api/notifications/:id` archives (soft-deletes) notification
- [ ] `DELETE /api/notifications/clear-archived` permanently deletes archived
- [ ] Cross-user access returns `404` (not `403` to avoid leaking existence)
- [ ] Non-existent notification ID returns `404`
- [ ] No 500 errors on any endpoint
- [ ] All endpoints are documented and executable from Swagger UI at `/api-docs`

---

## Appendix A: Swagger JSDoc Annotations for `routes/notifications.ts`

```typescript
/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List notifications
 *     description: Returns notifications for the authenticated user. Supports filtering by status and text search.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [unread, read, archived]
 *         description: Filter by notification status. Omit for unread + read.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive search in title and message.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Max results (1-100).
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset.
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *
 * /api/notifications/count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notification count
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *
 * /api/notifications/preview:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification preview
 *     description: Returns the 5 most recent unread notifications for the bell dropdown.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preview notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *
 * /api/notifications/mark-all-read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 *
 * /api/notifications/{id}/unread:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark notification as unread
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as unread
 *       404:
 *         description: Notification not found
 *
 * /api/notifications/clear-archived:
 *   delete:
 *     tags: [Notifications]
 *     summary: Permanently delete all archived notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Archived notifications cleared
 *
 * /api/notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Archive a notification (soft-delete)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification archived
 *       404:
 *         description: Notification not found
 */
```

## Appendix B: Swagger Component Schema

Add to the `components.schemas` section of `server/src/config/swagger.ts`:

```typescript
Notification: {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    type: {
      type: 'string',
      enum: [
        'approval_submitted',
        'step_approved',
        'step_rejected',
        'request_approved',
        'request_rejected',
        'request_cancelled',
        'workflow_updated',
        'general',
      ],
    },
    title: { type: 'string' },
    message: { type: 'string' },
    link: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['unread', 'read', 'archived'] },
    createdAt: { type: 'string', format: 'date-time' },
    readAt: { type: 'string', format: 'date-time', nullable: true },
  },
},
```

---

## Appendix C: File Tree Summary (New & Modified Files)

```
server/
├── src/
│   ├── app.ts                          # MODIFIED — register notificationsRouter
│   ├── config/
│   │   ├── seed.ts                     # MODIFIED — add notifications table DDL
│   │   └── swagger.ts                  # MODIFIED — add Notification schema
│   ├── controllers/
│   │   └── notificationController.ts   # NEW
│   ├── routes/
│   │   └── notifications.ts            # NEW
│   ├── services/
│   │   ├── notificationService.ts      # NEW
│   │   └── approvalService.ts          # MODIFIED — emit notifications on events
│   └── types/
│       └── index.ts                    # MODIFIED — add Notification types

client/
├── src/
│   ├── App.tsx                         # MODIFIED — add /notifications route
│   ├── api/
│   │   └── client.ts                   # MODIFIED — add notification API functions
│   ├── components/
│   │   ├── Layout.tsx                  # MODIFIED — integrate NotificationBell
│   │   └── NotificationBell.tsx        # NEW
│   ├── pages/
│   │   └── NotificationsPage.tsx       # NEW
│   └── types/
│       └── index.ts                    # MODIFIED — add Notification client types
```

---

## Open Questions for Review

1. **Real-time vs. polling:** Should the bell badge update in real-time via WebSockets/SSE, or is 30-second polling sufficient? **Proposed:** Start with polling; WebSockets can be a future enhancement.

2. **Notification preferences:** Should users be able to opt out of specific notification types (e.g., "Don't notify me about step rejections")? **Proposed:** Out of scope for this plan — all notifications are sent by default; a preferences page can be added later.

3. **Should admins see all notifications?** **Proposed:** No. Notifications are strictly scoped to the recipient user. Admins manage groups/workflows but do not have a global notification feed.

4. **Delete behavior for archived notifications:** Should "Clear Archived" have an undo, or is it permanent? **Proposed:** Permanent (hard delete). If undo is needed, archiving is already the soft-delete mechanism.