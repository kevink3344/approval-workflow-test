# Fix: "Confirm Submission" Returned Internal Server Error

**Date:** 2026-07-25

**Status:** Resolved

---

## Symptoms

When submitting a workflow request from the Workflow Detail page, clicking **"Confirm Submission"** showed:

- "An internal server error occurred"
- HTTP 500 responses from approval endpoints

In backend logs, errors included:

- `no such column: s.slot_order`
- `table approval_steps has no column named slot_order`

## Root Cause

The backend approval flow had been updated to use slot-based routing fields on `approval_steps` (for example `slot_order`, `group_id`, and `resolution_mode`), but the active database schema was from an older version and did not include those columns.

As a result:

- Read queries failed when selecting `s.slot_order`
- Inserts failed when writing `slot_order`
- Submission and approval list operations could throw runtime SQL errors (500)

## Fix

Added a startup schema migration that backfills required legacy columns before the server starts.

### Changes made

1. New migration module:

- `server/src/config/migrate.ts`

It ensures required columns exist on:

- `approval_steps`
- `workflow_approval_slots`

The migration is idempotent by attempting `ALTER TABLE ... ADD COLUMN` and ignoring duplicate-column errors.

2. Server startup now runs migrations before listening:

- `server/src/index.ts`

`runMigrations()` is executed first, then the Express server starts.

## Validation

After applying the fix and restarting services:

1. Opened workflow detail page
2. Submitted a request via **Confirm Submission**
3. Request completed successfully
4. UI showed: "Approval request submitted successfully!"
5. No new backend SQL exception was produced for `slot_order`

## Lessons Learned

- Schema evolution must be applied consistently across environments, especially when runtime queries depend on new columns.
- For local/legacy environments, lightweight startup migrations can prevent breakage during iterative development.
- Migrations that may re-run should be idempotent and tolerant of already-applied changes.
