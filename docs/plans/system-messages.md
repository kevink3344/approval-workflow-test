## System Wide Messages

**## Overview**

Allow organization administrators to create, edit, and delete system-wide banner messages that appear at the top of the main page after login. Each message has a ****Title****, ****Text**** (body), ****Pastel Color**** background, and a ****Dismissable**** boolean toggle. Users can dismiss dismissable messages via an 'x' button; non-dismissable messages persist across logins. Each organization manages its own set of messages independently.

Both ****authenticated users**** and ****guests (unauthenticated)**** can view and dismiss messages. Authenticated users have their dismissals persisted server-side in the database. Guests use ****localStorage**** for client-side dismissal persistence (per-device, per-browser, scoped by organization).

**## Architecture**

```

┌──────────────────────────────────────────────────────────────┐

│  AppLayout.jsx                                               │

│  ┌──────────────────────────────────────────────────────────┐│

│  │  SystemMessageBanner.jsx  (reads messages for current org)││

│  │  ┌───────────────────────────────────────────────────┐   ││

│  │  │ Message 1 (Pastel Pink)   Title | Text    [x]     │   ││

│  │  │ Message 2 (Pastel Blue)   Title | Text    [x]     │   ││

│  │  │ Message 3 (Pastel Green)  Title | Text  (sticky)  │   ││

│  │  └───────────────────────────────────────────────────┘   ││

│  └──────────────────────────────────────────────────────────┘│

│  ┌──────────────────────────────────────────────────────────┐│

│  │  <main>  (Dashboard / other page content)                 ││

│  └──────────────────────────────────────────────────────────┘│

├──────────────────────────────────────────────────────────────┤

│  Settings → SystemMessagesManagement.jsx (Admin CRUD)        │

│  - List existing messages                                    │

│  - Add/Edit/Delete messages                                  │

│  - Form: Title, Text (textarea), Pastel Color (picker),      │

│          Dismissable (toggle/checkbox)                        │

├──────────────────────────────────────────────────────────────┤

│  Backend: server/routes/system-messages.js                   │

│  - GET    /api/system-messages/org/:orgId     (active msgs)  │

│  - POST   /api/system-messages                (admin create) │

│  - PATCH  /api/system-messages/:id            (admin update) │

│  - DELETE /api/system-messages/:id            (admin delete) │

│  - POST   /api/system-messages/:id/dismiss    (user dismiss) │

│  - GET    /api/system-messages/org/:orgId/dismissed          │

│            (user's dismissed IDs — authenticated only)        │

├──────────────────────────────────────────────────────────────┤

│  Database                                                    │

│  - system_messages  (id, org_id, title, text, pastel_color,  │

│     is_dismissable, is_active, created_date, updated_date,   │

│     created_by_id)                                           │

│  - dismissed_messages (id, user_id, message_id,              │

│     dismissed_date)  ← for authenticated users only          │

│                                                              │

│  Guest dismissals → localStorage per org (no DB needed)      │

│    Key: kbb_dismissed_msgs_{orgId}                           │

│    Value: JSON array of dismissed message IDs                │

└──────────────────────────────────────────────────────────────┘

```

**## Detailed Steps**

**### Step 1 — Database: Add tables to schema**

- ***File:**** `server/init.sql`

Add two new tables after the existing `notifications` table:

- ***`system_messages` table:****

```sql

CREATE TABLE IF NOT EXISTS system_messages (

id              TEXT PRIMARY KEY NOT NULL,

org_id          TEXT NOT NULL,

title           TEXT NOT NULL,

text            TEXT NOT NULL DEFAULT '',

pastel_color    TEXT NOT NULL DEFAULT '#E8F4FD',  -- soft pastel blue

is_dismissable  INTEGER NOT NULL DEFAULT 1,        -- boolean (0/1)

is_active       INTEGER NOT NULL DEFAULT 1,        -- soft-delete / toggle

created_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

updated_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

created_by_id   TEXT,

FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE

);

CREATE INDEX IF NOT EXISTS idx_system_messages_org_id ON system_messages (org_id);

CREATE INDEX IF NOT EXISTS idx_system_messages_org_active ON system_messages (org_id, is_active);

```

- ***`dismissed_messages` table:****

```sql

CREATE TABLE IF NOT EXISTS dismissed_messages (

id              TEXT PRIMARY KEY NOT NULL,

user_id         TEXT NOT NULL,

message_id      TEXT NOT NULL,

dismissed_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

FOREIGN KEY (user_id)    REFERENCES users (id)           ON DELETE CASCADE ON UPDATE CASCADE,

FOREIGN KEY (message_id) REFERENCES system_messages (id) ON DELETE CASCADE ON UPDATE CASCADE,

UNIQUE (user_id, message_id)

);

CREATE INDEX IF NOT EXISTS idx_dismissed_messages_user ON dismissed_messages (user_id);

```

- ***Also create a migration file**** at `supabase/migrations/` with a timestamp-prefixed name (e.g., `20260724_system_messages.sql`) containing these same DDL statements for version-controlled migrations.
- **--**

**### Step 2 — Backend: Create system-messages route**

- ***New File:**** `server/routes/system-messages.js`

Follows the same patterns as `server/routes/settings.js` and `server/routes/auth.js`.

- ***Endpoints:****

| Method | Path | Auth | Description |

|--------|------|------|-------------|

| `GET` | `/api/system-messages/org/:orgId` | Public (no auth) | Returns all active messages for the org |

| `POST` | `/api/system-messages` | `authenticateToken` + org admin | Create a new message |

| `PATCH` | `/api/system-messages/:id` | `authenticateToken` + org admin | Update a message |

| `DELETE` | `/api/system-messages/:id` | `authenticateToken` + org admin | Soft-delete (set `is_active = 0`) |

| `POST` | `/api/system-messages/:id/dismiss` | `authenticateToken` | User dismisses a message (DB persistence) |

| `GET` | `/api/system-messages/org/:orgId/dismissed` | `authenticateToken` | Get dismissed message IDs for current user |

- ***Validation rules:****
- `title`: required, string, 1-200 characters
- `text`: required, string, 0-2000 characters
- `pastel_color`: required, valid hex color (e.g., `#E8F4FD`), or one of a predefined pastel palette
- `is_dismissable`: required, boolean (0 or 1)
- `org_id`: must exist and the requesting user must be an admin of that org (for create/update/delete)
- ***Predefined pastel color palette**** (suggested defaults):

```

#FFD6D6  (Soft Pink)

#FFE4C4  (Warm Peach)

#FFFACD  (Pale Yellow)

#D4EDDA  (Mint Green)

#E8F4FD  (Baby Blue)

#E6E6FA  (Lavender)

#F5E6CC  (Warm Beige)

#F0E6FF  (Soft Purple)

```

- ***Implementation notes:****
- Import `authenticateToken` from `../lib/auth.js`
- For org-admin check, query `org_members` table to verify the user has `org_admin` role in the target org, OR the user has global `admin` role, OR the user is in the org's `admin_user_ids` array
- Use parameterized queries via `sql.execute()` from `../db.js`
- Return appropriate HTTP status codes (201 for create, 200 for update/dismiss, 204 for delete)
- The GET endpoint for active messages should return messages where `is_active = 1`, ordered by `created_date DESC`
- The GET endpoint for active messages is ***public**** (no auth required) so both guests and authenticated users can see messages
- **--**

**### Step 3 — Backend: Register new route in server**

- ***File:**** `server/index.js`

Add the import and `app.use`:

```js

import systemMessagesRouter from './routes/system-messages.js';

// ...

app.use('/api/system-messages', systemMessagesRouter);

```

- **--**

**### Step 4 — Frontend API: Create system-messages client**

- ***New File:**** `src/api/system-messages.js`

Following the same patterns as `src/api/settings.js`:

```js

import { fetchApi } from './apiClient';

// Get active messages for an org (public, no auth required)

export async function getActiveMessages(orgId) {

return fetchApi(`/api/system-messages/org/${orgId}`);

}

// Get dismissed message IDs for the current authenticated user

export async function getDismissedMessageIds(orgId) {

return fetchApi(`/api/system-messages/org/${orgId}/dismissed`);

}

// Admin: Create a new message

export async function createMessage(data) {

return fetchApi('/api/system-messages', {

method: 'POST',

body: JSON.stringify(data),

});

}

// Admin: Update a message

export async function updateMessage(id, data) {

return fetchApi(`/api/system-messages/${id}`, {

method: 'PATCH',

body: JSON.stringify(data),

});

}

// Admin: Delete a message (soft-delete)

export async function deleteMessage(id) {

return fetchApi(`/api/system-messages/${id}`, {

method: 'DELETE',

});

}

// Authenticated user: Dismiss a message (persisted to DB)

export async function dismissMessage(messageId) {

return fetchApi(`/api/system-messages/${messageId}/dismiss`, {

method: 'POST',

});

}

```

- **--**

**### Step 4a — Frontend Utility: Guest dismissal via localStorage**

- ***New File:**** `src/utils/guest-message-dismissal.js`

Provides client-side dismissal persistence for unauthenticated users. Stores dismissed message IDs in `localStorage`, scoped per organization. This is a ****client-only**** mechanism — dismissals are per-device/browser, not tied to an account.

```js

const PREFIX = 'kbb_dismissed_msgs_';

/**

* Get the set of message IDs a guest has dismissed for a given org.

* @param {string} orgId

* @returns {string[]}

*/

export function getGuestDismissed(orgId) {

try {

const raw = localStorage.getItem(PREFIX + orgId);

return raw ? JSON.parse(raw) : [];

} catch {

return [];

}

}

/**

* Record that a guest dismissed a message for a given org.

* @param {string} orgId

* @param {string} messageId

*/

export function addGuestDismissal(orgId, messageId) {

const dismissed = getGuestDismissed(orgId);

if (!dismissed.includes(messageId)) {

dismissed.push(messageId);

localStorage.setItem(PREFIX + orgId, JSON.stringify(dismissed));

}

}

/**

* Clear all guest dismissals for a given org (e.g., on logout or org switch).

* @param {string} orgId

*/

export function clearGuestDismissals(orgId) {

localStorage.removeItem(PREFIX + orgId);

}

```

- ***Design rationale:****
- `localStorage` is used instead of cookies because it's simpler to read/write JSON arrays, doesn't get sent to the server on every request, and has no size concerns for a list of IDs.
- The key is namespaced with `kbb_dismissed_msgs_` to avoid collisions with other localStorage usage (e.g., `kbb_dark_mode`, `kbb_current_org`, `kbb_token`).
- Scoping by `orgId` means a guest who browses Organization A, dismisses a message, then switches to Organization B, will see Org B's messages fresh — dismissal state is per-org.
- No expiration is set (persists until manually cleared or localStorage is wiped). This matches the behavior for authenticated users where DB dismissals are permanent.
- ***How the banner merges both sources:****

| User Type | Dismissal Store | Persistence |

|-----------|----------------|-------------|

| Authenticated | `dismissed_messages` table (via API) | Cross-device, tied to account |

| Guest (unauthenticated) | `localStorage` (kbb_dismissed_msgs_{orgId}) | Per-device, per-browser |

The `SystemMessageBanner` component queries the appropriate source based on `isAuthenticated` and merges the dismissed IDs into a single `Set` for filtering.

- **--**

**### Step 5 — Frontend: System Message Banner Component**

- ***New File:**** `src/components/layout/SystemMessageBanner.jsx`

A banner that renders at the top of the main content area (above the `<main>` element). Displays all active, non-dismissed messages for the current organization. Works for both ****authenticated users**** and ****guests****.

- ***Props/State:****
- Reads `currentOrg` from `useOrg()`
- Reads `user` and `isAuthenticated` from `useAuth()`
- Fetches active messages via `getActiveMessages(orgId)` (public endpoint, no auth needed)
- For authenticated users: fetches dismissed IDs via `getDismissedMessageIds(orgId)` from the API
- For guest users: reads dismissed IDs from `localStorage` via `getGuestDismissed(orgId)`
- Merges both sources into a `Set<messageId>` for filtering
- Local state for optimistic dismissals (keeps the set updated in memory)
- ***Dismissal flow (dual-path):****

```

User clicks [✕] on a dismissable message

│

├── Authenticated user?

│       │

│       ├── YES → POST /api/system-messages/:id/dismiss

│       │         → persisted in dismissed_messages table

│       │

│       └── NO  → addGuestDismissal(orgId, messageId)

│                 → persisted in localStorage

│

└── Optimistic update: remove message from local visible state

```

- ***Layout:****
- Stacked vertically, full-width, directly above main content
- Each message is a colored bar with:

- Background color = `pastel_color` from the message

- Title in bold on the left

- Text next to the title

- If `is_dismissable === 1`: an '✕' (close) button on the right (shown for ALL users — guests can dismiss too)

- If `is_dismissable === 0`: no close button (message is sticky/persistent)

- ***Edge cases:****
- No messages → render nothing (null / empty fragment)
- Loading state → show nothing until loaded (no flicker)
- All messages dismissed → render nothing
- Guest user dismisses a message → stored in localStorage, persists across page refreshes (same browser)
- Guest user switches orgs → dismissal state is per-org (scoped by `orgId` in localStorage key)
- Guest user clears browser data → dismissals are lost (expected for client-only storage)
- Guest user later logs in → their localStorage dismissals are NOT migrated to the DB (they start fresh with server-side state). This is acceptable — the guest session and the authenticated session are treated independently.
- API call fails for authenticated dismissal → show a brief error, do NOT optimistically remove the message
- ***Styling pattern**** (Tailwind):

```jsx

<div

className="flex items-center gap-3 px-4 py-2.5 text-sm border-b border-border/50"

style={{ backgroundColor: message.pastel_color }}

>

<span className="font-semibold whitespace-nowrap">{message.title}</span>

<span className="flex-1">{message.text}</span>

{message.is_dismissable && (

<button onClick={handleDismiss} className="shrink-0 ml-2 text-muted-foreground hover:text-foreground">

✕

</button>

)}

</div>

```

Note: The `✕` button is now shown for ****all users**** (authenticated and guests) when `is_dismissable` is true — the only difference is where the dismissal is persisted (DB vs localStorage).

- **--**

**### Step 6 — Frontend: Integrate Banner into AppLayout**

- ***File:**** `src/components/layout/AppLayout.jsx`

Import and render `SystemMessageBanner` between the header and the `<main>` content area:

```jsx

import SystemMessageBanner from '@/components/layout/SystemMessageBanner';

// Inside the return, after the header + sidebar area, before <main>:

<main className="flex-1 overflow-auto">

<SystemMessageBanner />

<Outlet />

</main>

```

This places the banner at the very top of the scrollable content area, visible on every page that uses the `AppLayout`.

- **--**

**### Step 7 — Frontend: Settings Management UI**

- ***New File:**** `src/pages/settings/SystemMessagesManagement.jsx`

Admin CRUD interface for managing system-wide messages. Follows the same UI patterns as `BrandingManagement.jsx` and other settings components.

- ***UI Layout:****

1. ****List of existing messages**** (shows all, including inactive)

- Each row: Pastel color swatch, Title, truncated Text, Dismissable badge, Active/Inactive badge, Edit button, Delete button

2. ****"Add Message" button**** at the top

3. ****Expandable form**** (inline or modal) for Add/Edit:

- ****Title****: text input (required, max 200 chars)

- ****Text****: textarea (required, max 2000 chars) — body of the message

- ****Pastel Color****: a palette of preset pastel color swatches (click to select) + optional custom hex input

- ****Dismissable****: toggle switch or checkbox (label: "Allow users to dismiss this message")

- ****Active****: toggle switch or checkbox (label: "Active" — show/hide without deleting)

- Save / Cancel buttons

- ***Color palette UI:****

```jsx

const PASTEL_COLORS = [

'#FFD6D6', '#FFE4C4', '#FFFACD', '#D4EDDA',

'#E8F4FD', '#E6E6FA', '#F5E6CC', '#F0E6FF',

];

// Render as clickable circles:

<div className="flex gap-2 flex-wrap">

{PASTEL_COLORS.map(color => (

<button

key={color}

type="button"

onClick={() => setColor(color)}

className={`w-8 h-8 rounded-full border-2 transition-all ${

selectedColor === color ? 'border-primary scale-110' : 'border-border hover:scale-105'

}`}

style={{ backgroundColor: color }}

title={color}

/>

))}

<input

type="color"

value={selectedColor}

onChange={e => setColor(e.target.value)}

className="w-8 h-8 cursor-pointer"

title="Custom color"

/>

</div>

```

- ***State management:****
- Uses local React state (`useState`) to manage the list and form
- On save, calls the API and refreshes the list
- Optimistic updates for delete
- **--**

**### Step 8 — Frontend: Add Section to Settings Page**

- ***File:**** `src/pages/Settings.jsx`

Add the new section to the `sections` array:

```jsx

import { Megaphone } from 'lucide-react';

import SystemMessagesManagement from '@/pages/settings/SystemMessagesManagement';

// In the sections array, add after branding:

{ key: 'systemMessages', label: 'System Messages', icon: Megaphone, Component: SystemMessagesManagement },

```

The `Megaphone` icon from lucide-react is a good fit for system-wide announcements.

- **--**

**## Files Changed / Created**

| Action | File | Description |

|--------|------|-------------|

| Modify | `server/init.sql` | Add `system_messages` and `dismissed_messages` tables |

| ****Create**** | `supabase/migrations/20260724_system_messages.sql` | Migration file for the new tables |

| ****Create**** | `server/routes/system-messages.js` | REST API for CRUD + dismissal |

| Modify | `server/index.js` | Register new route |

| ****Create**** | `src/api/system-messages.js` | Frontend API client functions |

| ****Create**** | `src/utils/guest-message-dismissal.js` | localStorage-based dismissal for guest users |

| ****Create**** | `src/components/layout/SystemMessageBanner.jsx` | Banner component for displaying messages (supports auth + guest) |

| Modify | `src/components/layout/AppLayout.jsx` | Render banner above `<Outlet>` |

| ****Create**** | `src/pages/settings/SystemMessagesManagement.jsx` | Admin settings UI for managing messages |

| Modify | `src/pages/Settings.jsx` | Add System Messages section |

**## Testing Checklist**

- Admin creates a new message with title, text, pastel color, dismissable = true → message appears at top of dashboard
- Admin creates a second message with dismissable = false → both messages appear, non-dismissable one has no '✕'
- Authenticated user clicks '✕' on a dismissable message → message disappears for that user
- Authenticated user refreshes the page → dismissed messages do not reappear
- Authenticated user logs in from another device → dismissed messages still hidden (server-side persistence)
- Non-dismissable message remains visible after page refresh
- Admin sets a message to inactive → message disappears for all users
- Admin edits a message (changes title, color, text) → changes reflect immediately
- Admin deletes a message → message disappears for all users
- Guest user sees active messages and can dismiss them (persisted in localStorage)
- Guest user refreshes the page → dismissed messages stay hidden
- Guest user switches orgs → dismissal state is per-org, does not leak across orgs
- Guest user clears browser data → dismissals reset (expected behavior)
- Different organizations have different messages (org-scoping works)
- Admin in Org A cannot see/edit messages from Org B
- Pastel color palette selection works correctly
- Custom hex color input works
- Multiple messages stack vertically in the banner area
- Empty state: no messages → banner area hidden
- Banner renders on all pages that use AppLayout (Dashboard, DocumentView, etc.)

**## Open Questions / Future Enhancements**

1. ****Message ordering****: Currently ordered by `created_date DESC` (newest first). Consider adding a `display_order` field for drag-and-drop reordering.

2. ****Expiration dates****: Add optional `start_date` / `end_date` for scheduled messages.

3. ****Rich text****: Allow Markdown or basic HTML in the message text.

4. ****Target audience****: Show messages only to specific teams or roles within the org.

5. ****Audit log****: Track who created/edited/deleted messages.