# Multi-Attachments: Allow Multiple Files per File Column

**Date:** 2026-07-26  
**Status:** Planned — not yet implemented

---

## Overview

Currently, the `file` column type supports exactly **one file per column**. This is because:

- The `approval_request_fields` table stores file data directly (`file_data`, `file_mime_type`) alongside metadata, creating a 1:1 relationship between a column and its file.
- The upload API returns a single `fieldId` that maps to a single row.
- The frontend `fieldValues` state is `Record<string, string>` — one string value per column.

This plan introduces a dedicated **`attachments` table** to decouple file storage from field metadata, allowing multiple files per column.

---

## Current Architecture (for reference)

### Database
- `approval_request_fields` stores both field metadata (`column_id`, `value`) and file data (`file_data` BLOB, `file_mime_type`) in the same row.
- One row per column per request — inherently single-file.

### Server
- **`Type ColumnType`** (`server/src/types/index.ts:20`): `'text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'date' | 'file'`
- **`ApprovalRequestField`** (`server/src/types/index.ts:117-128`): `id, requestId, columnId, value, fileData, fileMimeType, createdAt, label?, columnType?`
- **`POST /api/uploads`** (`server/src/controllers/uploadController.ts:25-71`): Creates a temp row in `approval_request_fields` with placeholder `request_id` and returns a `fieldId`.
- **`GET /api/uploads/:fieldId`** (`server/src/controllers/uploadController.ts:73-129`): Queries `approval_request_fields` joined to `approval_requests` for access control.
- **`submitApproval()`** (`server/src/services/approvalService.ts:146-330`): Checks if a field `value` matches a pre-uploaded temp row ID and links it to the actual `request_id` + `column_id`.
- **`attachFieldsAndRequester()`** (`server/src/services/approvalService.ts:14-99`): Fetches fields via join with `workflow_columns`, returns flat fields without attachment separation.

### Client
- **`ApprovalRequestField`** (`client/src/types/index.ts:127-134`): `id, requestId, columnId, label, columnType, value` — no attachments array.
- **`SubmitApprovalPayload`** (`client/src/types/index.ts:164-167`): `fields: { columnId: string; value: string | null }[]` — single string per field.
- **`handleFileUpload()`** (`client/src/pages/WorkflowDetail.tsx:48-66`): Uploads one file, stores the `fieldId` as the column value.
- **`renderFieldValue()`** (`client/src/pages/Dashboard.tsx:11-38`): Renders file columns as a single download link (`📎 Download File`).
- **`renderReadOnlyValue()`** (`client/src/pages/WorkflowDetail.tsx:137-176`): Same single-link pattern.
- **`WorkflowEdit.tsx`** (`client/src/pages/WorkflowEdit.tsx`): No special handling for file columns in the builder — works generically.

---

## Proposed Changes

### 1. Database — New `attachments` Table

**Migration** (`server/src/config/migrate.ts`):
```typescript
await client.execute(`
  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    column_id TEXT NOT NULL REFERENCES workflow_columns(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_data BLOB NOT NULL,
    file_mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
```

**Columns:**

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID PK |
| `request_id` | TEXT | FK → `approval_requests.id`, CASCADE on delete |
| `column_id` | TEXT | FK → `workflow_columns.id`, CASCADE on delete |
| `filename` | TEXT | Original filename |
| `file_data` | BLOB | Binary file content |
| `file_mime_type` | TEXT | MIME type (e.g., `application/pdf`) |
| `file_size` | INTEGER | File size in bytes |
| `uploaded_by` | TEXT | FK → `users.id` — user who uploaded |
| `created_at` | TEXT | Upload timestamp |

### 2. Server Types (`server/src/types/index.ts`)

Add new `Attachment` interface:
```typescript
export interface Attachment {
  id: string;
  requestId: string;
  columnId: string;
  filename: string;
  fileMimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
}
```

Update `ApprovalRequestField`:
```typescript
export interface ApprovalRequestField {
  id: string;
  requestId: string;
  columnId: string;
  value: string | null;        // For file columns: JSON array of attachment IDs
  fileData: Buffer | null;      // DEPRECATED — remove after migration
  fileMimeType: string | null;  // DEPRECATED — remove after migration
  createdAt: Date;
  label?: string;
  columnType?: ColumnType;
  attachments?: Attachment[];   // NEW: populated on read for file columns
}
```

The `ColumnType` union remains unchanged — `'file'` already exists.

### 3. Upload Controller (`server/src/controllers/uploadController.ts`)

**`POST /api/uploads`** — upload a file (pre-submission):
- Accept optional body field `requestId` and `columnId` for cases where the upload happens after submission (edit/draft scenarios).
- For pre-submission uploads (no `requestId`), use a temp placeholder as before, but insert into `attachments` table instead of `approval_request_fields`.
- Return `{ attachmentId, filename, mimeType, fileSize }`.

**`GET /api/uploads/:attachmentId`** — download a file:
- Query `attachments` table instead of `approval_request_fields`.
- Join through `attachments` → `approval_requests` for access control.
- Same access rules: admin, requester, or assigned approver can download.

**`DELETE /api/uploads/:attachmentId`** — delete an attachment (new):
- Allow users to remove an attachment before submission (when `request_id` is still the temp placeholder).
- After submission, only the requester or admin can delete while the request is still in `pending`/`in_review` status.

### 4. Upload Routes (`server/src/routes/uploads.ts`)

- Update existing routes to use attachment terminology.
- Add `DELETE /api/uploads/:attachmentId` route.
- Update Swagger docs accordingly.

### 5. Approval Service (`server/src/services/approvalService.ts`)

**`attachFieldsAndRequester()`:**
- After fetching fields, query `attachments` table grouped by `column_id` for columns where `column_type = 'file'`.
- Attach `attachments[]` array to each file field.

**`submitApproval()`:**
- **Validation:** For file columns where `isRequired = true`, ensure the value is a non-empty JSON array of attachment IDs.
- **Linking:** Instead of checking for a single temp row, iterate over all attachment IDs in the JSON array value and update their `request_id` and `column_id` from placeholder to real values.
- **Non-file fields:** Unchanged — continue inserting into `approval_request_fields` as before.

**`cancelApproval()`:**
- When a request is cancelled, the `ON DELETE CASCADE` on the attachments FK will clean up automatically if the request is deleted, but cancellation only sets status. No additional changes needed — attachments remain accessible but the request is cancelled.

### 6. Client Types (`client/src/types/index.ts`)

Add `Attachment` interface:
```typescript
export interface Attachment {
  id: string;
  requestId: string;
  columnId: string;
  filename: string;
  fileMimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
}
```

Update `ApprovalRequestField`:
```typescript
export interface ApprovalRequestField {
  id: string;
  requestId: string;
  columnId: string;
  label: string;
  columnType: ColumnType;
  value: string | null;
  attachments?: Attachment[];  // NEW
}
```

### 7. Frontend — WorkflowDetail.tsx (Submission Form)

**File input changes:**
- Change `<input type="file">` to `<input type="file" multiple>`.
- On file selection, call `handleFileUpload()` for each selected file.
- Collect all returned `attachmentId` values into an array.
- Store `JSON.stringify([id1, id2, ...])` as the field `value`.

**UI updates:**
- Show a list of uploaded files with:
  - Filename
  - File size
  - Remove button (DELETE call to `/uploads/:attachmentId` before submission)
- Show upload progress per file.
- When a file is removed, update the array value accordingly.

**Validation:**
- For required file columns, check that the parsed array is non-empty (at least one attachment).

### 8. Frontend — Dashboard.tsx & WorkflowDetail.tsx (Display)

**`renderFieldValue()` (Dashboard.tsx:11) and `renderReadOnlyValue()` (WorkflowDetail.tsx:137):**
- For file columns, check `field.attachments` array if available.
- Render each attachment as a download link with filename.
- Fallback: if `attachments` is not populated (legacy data), use the old single-link behavior with `value` as the field ID.
- Example markup:
  ```tsx
  {field.attachments && field.attachments.length > 0 ? (
    <ul>
      {field.attachments.map(att => (
        <li key={att.id}>
          <a href={`/api/uploads/${att.id}`} className="text-link">
            📎 {att.filename}
          </a>
          <span>({(att.fileSize / 1024).toFixed(1)} KB)</span>
        </li>
      ))}
    </ul>
  ) : (
    <span className="text-[--text-muted] italic">—</span>
  )}
  ```

### 9. Frontend — WorkflowEdit.tsx (Column Builder)

No changes needed. The file column type already exists in the builder. The multi-attachment behavior is determined at submission time, not at workflow configuration time.

However, consider adding an optional per-column setting:
- **`maxFiles`**: Maximum number of files allowed (null = unlimited).
- **`maxTotalSize`**: Maximum total size in bytes across all files for this column (null = unlimited).
- This would require adding these fields to `workflow_columns` and the `WorkflowColumn` type.

### 10. Backward Compatibility

- Existing single-file records in `approval_request_fields` remain intact.
- The render logic falls back to the old behavior when `attachments` is undefined.
- New submissions will use the `attachments` table exclusively for file columns.
- Consider a future migration to move existing file data from `approval_request_fields` into the `attachments` table.

---

## Implementation Order

| Step | Layer | File(s) | Effort |
|---|---|---|---|
| 1 | DB | `server/src/config/migrate.ts` | Small |
| 2 | Server Types | `server/src/types/index.ts` | Small |
| 3 | Upload Controller | `server/src/controllers/uploadController.ts` | Medium |
| 4 | Upload Routes | `server/src/routes/uploads.ts` | Small |
| 5 | Approval Service | `server/src/services/approvalService.ts` | Large |
| 6 | Client Types | `client/src/types/index.ts` | Small |
| 7 | Submission Form | `client/src/pages/WorkflowDetail.tsx` | Medium |
| 8 | Display Logic | `client/src/pages/Dashboard.tsx`, `client/src/pages/WorkflowDetail.tsx` | Medium |
| 9 | Column Builder | `client/src/pages/WorkflowEdit.tsx` (optional enhancements) | Small |
| 10 | Cleanup/BC | `server/src/config/migrate.ts` (future) | Small |

---

## Open Questions

1. **Max files per column?** Should there be a configurable limit (e.g., 5 files max)?
2. **Max total size per column?** E.g., 50 MB across all files for a given column.
3. **File type restrictions per column?** Currently the allowed MIME types list is global. Should admins be able to restrict which file types are accepted per column (e.g., PDF only)?
4. **Upload progress UI:** Should we add a progress bar per file during upload, or keep the simple "Uploading..." text?
5. **Drag-and-drop?** Should the file input support drag-and-drop?

These can be addressed after the core multi-attachment functionality is in place.