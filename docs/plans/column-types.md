# Column Types — Implementation Plan

**Date:** 2026-07-25

**Status:** Pending Review

---

## Overview

This plan introduces **Column Types** to Workflows. When creating or editing a Workflow, Administrators can define one or more custom columns (form fields) that submitters must complete when initiating an approval request. Supported column types include: Text, Long-Text, Single-choice, Multiple-choice, Date, and File. Each column can be marked as **Required** or **Optional**. Only administrators can manage Column Types on a Workflow.

This feature turns approval requests from a simple "approve this" action into a structured data-collection flow — the submitter fills out a dynamic form defined by the workflow admin before the approval routing begins.

---

## Requirements Summary

| # | Requirement |
|---|------------|
| R1 | Administrators can **add, edit, reorder, and remove** columns from a Workflow. |
| R2 | Each column has a **label** (display name), a **column type** (`text`, `long_text`, `single_choice`, `multiple_choice`, `date`, `file`), and an **is-required** flag. |
| R3 | For `single_choice` and `multiple_choice` column types, the Administrator provides an **options list** (e.g., `["Option A", "Option B", "Option C"]`). |
| R4 | When a user submits an approval request against a Workflow, they must fill out all columns defined on that Workflow. Required columns must have a non-empty value before submission. |
| R5 | Submitted column values are stored as part of the approval request and are visible to approvers reviewing the request. |
| R6 | Column definitions are **frozen at request-submission time** — editing a workflow's columns does not retroactively change existing requests. |
| R7 | Only users with the `admin` role can manage columns on a Workflow. |
| R8 | Column ordering is preserved — Administrators set the display order, and submitters see fields in that order. |
| R9 | File-type columns accept file uploads. The file is stored as a BLOB in the Turso database, and the filename + MIME type are saved alongside for retrieval. |

---

## Data Model Changes

### New Table: `workflow_columns`

Defines the custom columns attached to a Workflow. Rows are created when an Admin adds a column during workflow creation or editing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `workflow_id` | TEXT (FK → workflows.id) | Parent workflow |
| `label` | TEXT | Display name shown to the submitter (e.g. "Reason for Request") |
| `column_type` | TEXT | One of: `text`, `long_text`, `single_choice`, `multiple_choice`, `date`, `file` |
| `is_required` | INTEGER | `0` = optional, `1` = required |
| `sort_order` | INTEGER | Display position (1-based) within the workflow's form |
| `options` | TEXT | JSON array of choice strings. Only used when `column_type` is `single_choice` or `multiple_choice`; otherwise `NULL`. Example: `'["Option A","Option B","Option C"]'` |
| `created_at` | TEXT (ISO 8601) | Creation timestamp |

*Unique constraint on (`workflow_id`, `sort_order`) — no two columns in the same workflow can share the same position.*

### New Table: `approval_request_fields`

Stores the submitted values for each column when a user submits an approval request. This is the runtime snapshot of the data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `request_id` | TEXT (FK → approval_requests.id) | Parent approval request |
| `column_id` | TEXT (FK → workflow_columns.id) | The column definition this value answers |
| `value` | TEXT | The submitted value. For `text`/`long_text`: the string. For `date`: ISO 8601 date string. For `single_choice`: the selected option string. For `multiple_choice`: JSON array of selected strings. For `file`: the original filename (e.g. `receipt.pdf`). `NULL` if optional and left blank. |
| `file_data` | BLOB | The raw file bytes. Only populated when `column_type` is `file` on the associated workflow column. `NULL` for all other types. |
| `file_mime_type` | TEXT | The MIME type of the uploaded file (e.g. `application/pdf`). Only populated for file-type fields. `NULL` for all other types. |
| `created_at` | TEXT (ISO 8601) | When this field value was recorded |

*Note: `column_id` references `workflow_columns` but does NOT cascade on delete. If an admin removes a column from a workflow, existing request field values referencing that column are preserved for historical integrity.*

*File storage: Files are stored directly in the Turso database as BLOBs rather than on the local filesystem. This keeps all data in one place, eliminates filesystem dependency, and works seamlessly with Turso's distributed architecture. The `file_data` column holds the raw bytes, while `value` stores the human-readable filename and `file_mime_type` stores the MIME type for content-type headers when serving the file for download.*

### Migration SQL (DDL)

```sql
-- Workflow Column Definitions
CREATE TABLE IF NOT EXISTS workflow_columns (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  column_type TEXT NOT NULL CHECK(column_type IN ('text', 'long_text', 'single_choice', 'multiple_choice', 'date', 'file')),
  is_required INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL,
  options     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workflow_id, sort_order)
);

-- Submitted Field Values (runtime snapshot)
CREATE TABLE IF NOT EXISTS approval_request_fields (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  request_id     TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  column_id      TEXT NOT NULL REFERENCES workflow_columns(id),
  value          TEXT,
  file_data      BLOB,
  file_mime_type TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## ERD Relationships

```
┌──────────┐       ┌──────────────────────┐       ┌─────────────────────┐
│  users   │───<   │      workflows       │───<   │  workflow_columns   │
└──────────┘       └──────────────────────┘       └─────────────────────┘
      │                       │                              │
      │                       │ (1 workflow has              │ (snapshot at
      │                       │  N columns)                  │  submit time)
      │                       │                              │
      │                       ▼                              │
      │              ┌──────────────────────┐                │
      │              │  approval_requests   │───< ───────────┘
      │              └──────────────────────┘       │
      │                       │                     │
      │                       │ (1 request has      │
      │                       │  N field values)    │
      │                       │                     │
      │                       ▼                     ▼
      │              ┌──────────────────────────────────┐
      └──────────────│     approval_request_fields      │
                     └──────────────────────────────────┘
```

---

## Column Type Behavior

| Column Type | Input Widget | Stored Value | Notes |
|-------------|-------------|--------------|-------|
| `text` | Single-line text input | String | Max 255 characters recommended |
| `long_text` | Multi-line textarea | String | Unlimited length |
| `single_choice` | Radio buttons or dropdown | Selected option string | `options` JSON defines the choices |
| `multiple_choice` | Checkboxes | JSON array of selected strings, e.g. `["A","C"]` | `options` JSON defines the choices |
| `date` | Date picker | ISO 8601 date string (`YYYY-MM-DD`) | Browser-native date input |
| `file` | File upload input | Filename (in `value`) + BLOB (in `file_data`) + MIME type (in `file_mime_type`) | File binary stored as BLOB in Turso DB; served via a dedicated download endpoint |

---

## API Endpoints

Column management is integrated into the existing Workflow endpoints. No separate `/api/columns` CRUD is needed because columns are always scoped to a parent Workflow.

### Workflow Endpoints (Updated)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/workflows` | Create workflow. Body extended: `{ name, description, slots: [...], columns: [...] }`. The `columns` array defines the custom form fields. |
| `PATCH` | `/api/workflows/:id` | Update workflow. Columns can be added, updated, reordered, or removed. The `columns` array in the body represents the **complete desired state** — the server diffs and applies changes. |
| `GET` | `/api/workflows/:id` | Returns workflow with expanded `columns` array (includes `id`, `label`, `columnType`, `isRequired`, `sortOrder`, `options`). |

#### `columns` Array Shape (Request/Response)

```json
{
  "columns": [
    {
      "id": "abc123",            // absent on create, present on update/read
      "label": "Reason for Request",
      "columnType": "text",
      "isRequired": true,
      "sortOrder": 1,
      "options": null
    },
    {
      "id": "def456",
      "label": "Department",
      "columnType": "single_choice",
      "isRequired": true,
      "sortOrder": 2,
      "options": ["Engineering", "Marketing", "Sales", "HR"]
    },
    {
      "id": "ghi789",
      "label": "Supporting Document",
      "columnType": "file",
      "isRequired": false,
      "sortOrder": 3,
      "options": null
    }
  ]
}
```

#### Validation Rules (Server-side)

1. `label` must be non-empty (trimmed).
2. `columnType` must be one of the six valid types.
3. `sortOrder` must be unique within the columns array and positive.
4. If `columnType` is `single_choice` or `multiple_choice`, `options` must be a non-empty array of non-empty strings.
5. If `columnType` is NOT `single_choice` or `multiple_choice`, `options` must be `null` or omitted.
6. At least one column is NOT required (minimum: 0 columns is allowed for backwards compatibility).

### Approval Submission & Retrieval (Updated)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/approvals` | Submit a new approval request. Body extended: `{ workflowId, fields: [{ columnId, value }] }`. Server validates required fields are present and non-empty. |
| `GET` | `/api/approvals/:id` | Returns approval request with `fields` array populated (column label, type, value). |

#### Submission Validation

- Every `columnId` must belong to the target workflow.
- For required columns, `value` must be present, non-null, and non-empty (after trim).
- For optional columns, `value` may be `null` or empty.
- For `single_choice` columns, `value` must match one of the defined options.
- For `multiple_choice` columns, `value` must be a valid JSON array whose elements are all from the defined options.
- For `file` columns, the file must be uploaded as part of the submission. The server reads the file bytes and stores them in the `file_data` BLOB column along with the filename in `value` and the MIME type in `file_mime_type`.

### File Upload & Download Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/uploads` | Upload a file. Body: `multipart/form-data` with a single file field. Returns `{ fieldId: "<uuid>", filename: "receipt.pdf", mimeType: "application/pdf" }`. Authenticated users only. Used as a pre-upload step before submitting approval request fields. |
| `GET` | `/api/uploads/:fieldId` | Download a previously uploaded file. Returns the raw file bytes with the correct `Content-Type` and `Content-Disposition` headers. Authenticated users with access to the associated request only. |

The file is stored as a BLOB in the `approval_request_fields.file_data` column. No local filesystem storage is required — the Turso database handles all persistence. The upload endpoint inserts a temporary `approval_request_fields` row (with `request_id` set to a pending placeholder) and returns the `fieldId`. When the approval request is submitted, the `request_id` is updated to the real request ID.

**Upload flow:**
1. User selects a file in the browser → client calls `POST /api/uploads` with the file.
2. Server reads the raw bytes + filename + MIME type from the multipart upload.
3. Server inserts a row into `approval_request_fields` with `file_data`, `value` (filename), and `file_mime_type`; `request_id` is set to a temporary placeholder.
4. Server returns `{ fieldId, filename, mimeType }` to the client.
5. Client includes `{ columnId: "<workflow_column_id>", value: "<fieldId>" }` in the approval submission payload.
6. On `POST /api/approvals`, the server updates the `request_id` on those `approval_request_fields` rows from the placeholder to the real request ID.

**Download flow:**
- `GET /api/uploads/:fieldId` queries the `approval_request_fields` row, verifies the requesting user has access to the parent request, and streams the `file_data` BLOB back with the original `file_mime_type` and filename.

---

## Frontend Pages & Components

### 1. Workflow Create / Edit Page (Updated)

**New Section: "Custom Fields" (Column Builder)**

Below the Approval Slots section, a new "Custom Fields" section is added to the Workflow form:

- Ordered list of columns (numbered 1, 2, 3, …).
- Each column row shows:
  - **Drag handle** (or up/down buttons) for reordering.
  - **Label** text input (e.g., "Reason for Request").
  - **Column Type** dropdown: Text, Long-Text, Single-choice, Multiple-choice, Date, File.
  - **Required** toggle switch or checkbox.
  - **Options editor** (visible only when type is Single-choice or Multiple-choice): an inline list of option strings with "Add Option" and delete buttons.
  - **Remove** button (trash icon) to delete the column.
- **"+ Add Column"** button to append a new column at the bottom.
- **Validation**: each column must have a non-empty label; choice columns must have at least 2 options.

**Component Tree:**

```
WorkflowForm
├── WorkflowNameInput
├── WorkflowDescriptionInput
├── SlotBuilder (existing — from Approval Groups plan)
│   ├── SlotRow (×N)
│   └── AddSlotButton
├── ColumnBuilder (NEW)
│   ├── ColumnRow (×N)
│   │   ├── DragHandle
│   │   ├── LabelInput
│   │   ├── ColumnTypeDropdown
│   │   ├── RequiredToggle
│   │   ├── OptionsEditor (conditional — for choice types)
│   │   └── RemoveButton
│   └── AddColumnButton
└── SubmitButton
```

### 2. Approval Request Submission Page (New / Updated)

When a user clicks "Submit Request" for a workflow, they are taken to a form page (or modal) that renders the custom fields:

- Each column from the workflow is rendered as its appropriate input widget.
- Labels are shown with a red asterisk (`*`) next to required fields.
- Validation runs client-side before submission:
  - Required fields cannot be empty.
  - Single-choice must have a selection.
  - Multiple-choice must have at least one selection if required.
  - File must have a file selected if required.
- On successful submission, redirect to the request detail page.

**Field Renderer Component:**

```tsx
// Pseudo-component structure
<DynamicColumnField
  column={column}
  value={value}
  onChange={onChange}
  error={error}
/>
```

Maps `columnType` to:
- `text` → `<input type="text" />`
- `long_text` → `<textarea />`
- `single_choice` → radio group or `<select>`
- `multiple_choice` → checkbox group
- `date` → `<input type="date" />`
- `file` → `<input type="file" />`

### 3. Approval Request Detail Page (Updated)

The request detail page (viewed by submitters and approvers) now displays the submitted column values:

- A "Request Details" section between the request header and the approval steps timeline.
- Each field is rendered as a read-only row: **Label** → **Value**.
- File fields show a download link (pointing to `/api/uploads/:fieldId`).
- Choice fields show the selected option(s) as badges or a comma-separated list.

```
┌─────────────────────────────────────────┐
│ Expense Report #123        [In Review]  │
│ Workflow: Expense Reports               │
│ Submitted by: Jane Doe · July 25, 2026  │
├─────────────────────────────────────────┤
│ Request Details                         │
│ ─────────────────────────────────────── │
│ Reason for Request *                    │
│   Conference travel for Q3 summit       │
│                                         │
│ Department *                            │
│   Engineering                           │
│                                         │
│ Supporting Document                     │
│   📎 receipt.pdf (Download)             │
├─────────────────────────────────────────┤
│ Approval Progress                       │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

## TypeScript Type Changes

### Server Types (`server/src/types/index.ts`) — Additions

```ts
export type ColumnType = 'text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'date' | 'file';

export interface WorkflowColumn {
  id: string;
  workflowId: string;
  label: string;
  columnType: ColumnType;
  isRequired: boolean;
  sortOrder: number;
  options: string[] | null; // JSON array parsed; null for non-choice types
  createdAt: Date;
}

export interface ApprovalRequestField {
  id: string;
  requestId: string;
  columnId: string;
  value: string | null;
  createdAt: Date;
  // Populated on read:
  label?: string;
  columnType?: ColumnType;
}
```

### Client Types (`client/src/types/index.ts`) — Additions

```ts
export type ColumnType = 'text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'date' | 'file';

export interface WorkflowColumn {
  id: string;
  label: string;
  columnType: ColumnType;
  isRequired: boolean;
  sortOrder: number;
  options: string[] | null;
  createdAt?: string;
}

export interface ApprovalRequestField {
  id: string;
  requestId: string;
  columnId: string;
  label: string;
  columnType: ColumnType;
  value: string | null;
}
```

### Updated Types (Existing)

```ts
// Workflow — add columns property
export interface Workflow {
  // ...existing fields...
  columns: WorkflowColumn[];  // NEW
}

// ApprovalRequest — add fields property
export interface ApprovalRequest {
  // ...existing fields...
  fields: ApprovalRequestField[];  // NEW
}

// SubmitApprovalPayload — extended
export interface SubmitApprovalPayload {
  workflowId: string;
  fields: { columnId: string; value: string | null }[];  // NEW
}
```

---

## Implementation Order

### Phase 1 — Database & Seed
1. Add `workflow_columns` and `approval_request_fields` DDL to `server/src/config/seed.ts`.
2. Run the seed script to create the new tables.

### Phase 1.5 — Types
3. Add `ColumnType`, `WorkflowColumn`, `ApprovalRequestField` types to `server/src/types/index.ts`.
4. Add matching types to `client/src/types/index.ts`.
5. Update `Workflow` and `ApprovalRequest` types in both client and server to include `columns` and `fields`.
6. Update `SubmitApprovalPayload` to include `fields`.

### Phase 2 — Backend: Workflow Column Persistence
7. Update `POST /api/workflows` controller to accept and persist `columns` array.
8. Update `PATCH /api/workflows/:id` controller to handle column diff (add, update, reorder, delete).
9. Update `GET /api/workflows/:id` to return expanded `columns` data.
10. Add server-side validation for column definitions (label non-empty, valid type, options required for choice types, unique sort orders).

### Phase 2.5 — Test Workflow Column CRUD Endpoints

Before moving on to frontend or file upload, verify all column CRUD operations work correctly using `curl` (or any HTTP client). This catches bugs early — validation issues, missing columns in responses, or cascade-delete problems.

> **Prerequisite:** The server must be running (`npm run dev`) and the database must be seeded (`npm run db:seed`). All commands below use `SUPER_ADMIN_TOKEN` — replace with a valid admin JWT for your environment. A non-admin user token (`NON_ADMIN_TOKEN`) is also needed for access-control checks.

**1. Create a workflow with columns:**
```bash
curl -s -X POST http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow with Columns",
    "description": "A workflow for CRUD testing",
    "slots": [],
    "columns": [
      {
        "label": "Reason for Request",
        "columnType": "text",
        "isRequired": true,
        "sortOrder": 1,
        "options": null
      },
      {
        "label": "Department",
        "columnType": "single_choice",
        "isRequired": true,
        "sortOrder": 2,
        "options": ["Engineering", "Marketing", "Sales", "HR"]
      },
      {
        "label": "Supporting Document",
        "columnType": "file",
        "isRequired": false,
        "sortOrder": 3,
        "options": null
      }
    ]
  }' | jq
```
Verify the response includes a `columns` array with three items, each having `id`, `label`, `columnType`, `isRequired`, `sortOrder`, and `options` populated correctly. Save the returned workflow `id` as `WF_COL_ID`.

**2. Get workflow and verify columns are returned:**
```bash
curl -s http://localhost:3001/api/workflows/$WF_COL_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq '.columns'
```
Confirm three columns are returned with all fields populated.

**3. Update workflow columns (reorder, add, remove, edit):**
```bash
curl -s -X PATCH http://localhost:3001/api/workflows/$WF_COL_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow with Columns",
    "description": "Updated description",
    "slots": [],
    "columns": [
      {
        "label": "Priority",
        "columnType": "single_choice",
        "isRequired": true,
        "sortOrder": 1,
        "options": ["Low", "Medium", "High"]
      },
      {
        "label": "Reason for Request",
        "columnType": "long_text",
        "isRequired": true,
        "sortOrder": 2,
        "options": null
      }
    ]
  }' | jq '.columns'
```
Verify the response shows two columns (the old three were replaced): "Priority" (single_choice, sortOrder 1) and "Reason for Request" (changed to long_text, sortOrder 2). The file column should be gone.

**4. Create workflow with missing required label (expect 400):**
```bash
curl -s -X POST http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Workflow",
    "description": "Missing label",
    "slots": [],
    "columns": [
      {
        "label": "",
        "columnType": "text",
        "isRequired": false,
        "sortOrder": 1,
        "options": null
      }
    ]
  }'
```
Expect a 400 response with a validation error message about empty label.

**5. Create workflow with choice column missing options (expect 400):**
```bash
curl -s -X POST http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Workflow 2",
    "description": "Missing options",
    "slots": [],
    "columns": [
      {
        "label": "Pick One",
        "columnType": "single_choice",
        "isRequired": true,
        "sortOrder": 1,
        "options": null
      }
    ]
  }'
```
Expect a 400 response with a validation error about options being required for choice types.

**6. Access control check (non-admin should be rejected for workflow creation):**
```bash
curl -s -X POST http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $NON_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Unauthorized Workflow",
    "description": "Should fail",
    "slots": [],
    "columns": []
  }'
```
Expect `{"message":"Admin access required."}` with status 403.

**7. Delete workflow and verify cascade:**
```bash
curl -s -X DELETE http://localhost:3001/api/workflows/$WF_COL_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect `{"message":"Workflow deleted successfully."}`.

**8. Verify cascade — columns are gone:**
```bash
curl -s http://localhost:3001/api/workflows/$WF_COL_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```
Expect 404 (workflow and its columns deleted via cascade).

**Checklist:**
- [ ] `POST /api/workflows` with `columns` array creates workflow with columns
- [ ] `GET /api/workflows/:id` returns expanded `columns` with all fields
- [ ] `PATCH /api/workflows/:id` handles column diff (add, update, reorder, remove)
- [ ] Validation rejects empty label (400)
- [ ] Validation rejects choice columns without options (400)
- [ ] Non-admin requests to workflow creation get 403
- [ ] `DELETE /api/workflows/:id` cascades and removes columns
- [ ] No 500 errors on any endpoint

### Phase 3 — Backend: File Upload
12. Add `multer` middleware dependency to server (for parsing `multipart/form-data`).
13. Create `POST /api/uploads` route that accepts file uploads, reads the raw bytes, and inserts a BLOB row into `approval_request_fields` with a placeholder `request_id`.
14. Returns `{ fieldId, filename, mimeType }` to the client for inclusion in the approval submission payload.
12b. Create `GET /api/uploads/:fieldId` route that streams the BLOB back to the client with proper `Content-Type` and `Content-Disposition` headers. Verify the requesting user has access to the parent request.

### Phase 4 — Backend: Approval Submission with Fields
15. Update `POST /api/approvals` to accept `fields` array.
16. Validate: column IDs belong to the workflow, required fields are non-empty, choice values match options.
17. Persist `approval_request_fields` rows.
18. Update `GET /api/approvals/:id` to join and return field values with column metadata.

### Phase 4.5 — Test Approval Submission with Fields
19. Cycle test: submit a request with fields → get request (verify fields returned with values) → verify validation rejects missing required fields.

### Phase 5 — Frontend: Workflow Column Builder
20. Build `ColumnBuilder` component with add/remove/reorder functionality.
21. Build `ColumnRow` component with dynamic options editor for choice types.
22. Integrate into `Workflows.tsx` create/edit form.
23. Wire up API calls to include `columns` in workflow payloads.

### Phase 6 — Frontend: Dynamic Form on Request Submission
24. Build `DynamicColumnField` component that renders the appropriate input based on `columnType`.
25. Build the submission form page that fetches the workflow's columns and renders them.
26. Add client-side validation matching server rules.
27. Add file upload handling: call `POST /api/uploads` first when a file is selected, then pass the returned `fieldId` as the field `value` in the approval submission payload.

### Phase 7 — Frontend: Request Detail with Field Values
28. Update the request detail page/view to render submitted field values in a read-only "Request Details" section.
29. Render file links as clickable downloads.
30. Render choice values as human-readable (badges or text).

### Phase 8 — Polish & Edge Cases
31. Handle empty state: workflow with no columns (submission form shows no custom fields, just the submit button).
32. Handle stale references: if a column is deleted after a request is submitted, show the value with a "(column removed)" label.
33. File size limits and allowed file types configuration (enforced server-side on the `/api/uploads` endpoint).
34. Accessibility: ensure all dynamic form fields have proper labels, aria attributes, and keyboard navigation.

---

## Security & Access Control

- **Column management**: Gated behind existing workflow admin-only routes (`POST`/`PATCH`/`DELETE` on `/api/workflows` require admin role).
- **File uploads**: Authenticated users only. File type and size validation server-side. Files stored as BLOBs in the Turso database — no local filesystem exposure. Download is gated behind the `/api/uploads/:fieldId` endpoint which verifies the requesting user has access to the parent approval request.
- **Field values**: Only visible to the request submitter, assigned approvers, and admins (existing approval request visibility rules apply).

---

## Edge Cases & Design Decisions

1. **What happens if a column is deleted from a workflow after requests have been submitted?**
   - The `approval_request_fields` rows are preserved. When displaying the request, if the `column_id` no longer resolves to a `workflow_columns` row, the field is shown with label "(column removed)" but the value is still displayed for historical record.

2. **What happens if a column's options are changed after requests are submitted?**
   - The submitted value is preserved as-is. The new options only affect future submissions. The request detail page shows the original submitted value.

3. **What happens if a column is changed from optional to required?**
   - Existing requests are unaffected. New submissions must satisfy the new required constraint.

4. **Can a workflow have zero custom columns?**
   - Yes. This is valid and maintains backwards compatibility — the submission form simply shows no custom fields, just the submit button.

5. **File storage strategy?**
   - Files are stored as BLOBs directly in the Turso database (`approval_request_fields.file_data`). This eliminates filesystem dependency, keeps all approval data in a single database, and simplifies backups and replication. Turso (libsql) supports BLOB columns natively. For large files, a size limit (e.g., 10 MB) should be enforced server-side to avoid excessive database bloat.
   - **Future enhancement:** For very large files or high-volume usage, an external object store (Azure Blob, S3) could be introduced with the same API contract — the upload/download endpoints abstract the storage backend.

6. **Maximum number of columns per workflow?**
   - No hard limit enforced. Practical UI limit of ~20 columns recommended (excessive columns degrade the submission form UX).

7. **Multiple-choice: minimum/maximum selections?**
   - No minimum/maximum enforcement beyond "at least 1 if required." Future enhancement could add `minSelect`/`maxSelect` constraints.

8. **Reordering columns with existing requests?**
   - The `sort_order` change only affects the display order for future submissions. Existing request field display order is determined by the snapshot at submission time (we store `sort_order` indirectly via the column reference).

---

## Resolved Questions

1. **File storage backend**: **Resolved** — Store files as BLOBs directly in the Turso database (`approval_request_fields.file_data`). No local filesystem or external cloud storage needed for v1. A 10 MB file size limit is enforced server-side.

2. **Column types extensibility**: **Resolved** — Hard-code the six types as a CHECK constraint. Additional types in the future require a migration to extend the CHECK list.

3. **Rich text for long_text**: **Resolved** — Plain text only for v1. No formatting or Markdown support.

4. **Column visibility conditions**: **Resolved** — Out of scope for this plan. No conditional field visibility logic.

---

## Appendix: Example Flow

1. Admin creates Workflow "Expense Reports":
   - **Columns:**
     1. "Reason for Request" (Text, Required)
     2. "Department" (Single-choice: Engineering, Marketing, Sales, HR; Required)
     3. "Receipt" (File, Optional)
   - **Slots:**
     1. "Initial Approval" group, resolution = `first`

2. User Jane clicks "Submit Request" for "Expense Reports".

3. Jane sees the dynamic form:
   ```
   Reason for Request *: [________________________]
   Department *: ( ) Engineering  (•) Marketing  ( ) Sales  ( ) HR
   Receipt: [Choose file] No file chosen
   [Submit Request]
   ```

4. Jane fills out:
   - Reason: "Q3 conference travel reimbursement"
   - Department: Marketing
   - Receipt: uploads `conference_receipt.pdf`

5. Jane clicks Submit. Server validates, stores:
   - `approval_request_fields`: three rows with the submitted values.
   - `approval_requests`: new request in `pending` status.

6. Approvers viewing the request see the "Request Details" section with all three fields and their values before making their approval decision.