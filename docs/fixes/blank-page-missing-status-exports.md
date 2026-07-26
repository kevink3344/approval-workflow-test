# Fix: Blank Page on App Load (Missing Status Exports)

**Date:** 2026-07-26

**Status:** Resolved

---

## Symptoms

Opening the frontend at `http://localhost:5173` showed a fully blank white page.

- HTML shell loaded correctly (`index.html` with `#root`)
- Vite served `/src/main.tsx` successfully
- Nothing rendered inside the app root

When inspected in browser runtime logs, the crash was:

- `SyntaxError: The requested module '/src/types/index.ts' does not provide an export named 'statusBadgeVariant'`

## Root Cause

`client/src/pages/Dashboard.tsx` imported named exports:

- `statusBadgeVariant`
- `statusLabel`

from `client/src/types/index.ts`, but those exports were not present in the types module.

Because this is an ESM named-import failure, module evaluation aborts before React mounts, resulting in a blank page.

## Fix

Added the missing exports to `client/src/types/index.ts`:

- `statusLabel: Record<ApprovalStatus, string>`
- `statusBadgeVariant: Record<ApprovalStatus, 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'slate'>`

### Added mapping

```ts
export const statusLabel: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const statusBadgeVariant: Record<ApprovalStatus, 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'slate'> = {
  pending: 'amber',
  in_review: 'blue',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
};
```

## Validation

After the patch:

1. Reloaded `http://localhost:5173`
2. Confirmed no startup `pageerror`
3. Confirmed app content rendered (home hero, nav, and CTA links)

## Note About HTTPS

`https://localhost:5173` returned `ERR_SSL_PROTOCOL_ERROR` during verification because Vite dev server is currently configured for HTTP only. This is separate from the blank-page crash and requires explicit HTTPS config if secure local dev is needed.

## Lessons Learned

- White screens can be caused by import-time ESM errors even when HTML and entry scripts load.
- Shared UI mappings imported by pages should stay co-located and exported from a stable module.
- Runtime error capture (`pageerror`) is faster than visual debugging for blank-screen failures.
