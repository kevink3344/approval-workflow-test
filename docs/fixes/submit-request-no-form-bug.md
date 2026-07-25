# Fix: Clicking "Submit Approval Request" Shows No Form

**Date:** 2026-07-25

**Status:** Resolved

---

## Symptoms

When a user navigates to a workflow detail page (e.g., by clicking "New Request" on the Dashboard and selecting a workflow) and clicks the **"Submit Approval Request"** button, no form appears. The button text changes to "Confirm Submission" / "Cancel", but no input fields are visible. This leaves the user confused with no way to provide information or submit the request.

## Root Cause

In `client/src/pages/WorkflowDetail.tsx`, the `handleOpenForm()` function set `showSubmitForm = true` but the dynamic submission form UI was conditionally rendered only when **both** `showSubmitForm` and `hasColumns` were true:

```tsx
{showSubmitForm && hasColumns && (
  <div className="surface p-6 mb-6">
    <h3>Complete Request Details</h3>
    {/* field inputs */}
  </div>
)}
```

For workflows **without custom columns** (`hasColumns === false`), the form container never rendered. The buttons switched to the "confirming" state but there was no visible UI — making it appear as though nothing happened.

This affected all workflows created without custom fields (columns), which is a valid and common use case where submitters don't need to provide extra information.

## Fix

Modified `handleOpenForm()` in `WorkflowDetail.tsx` to detect when the workflow has no columns and submit the request directly without showing a form:

**Before (broken):**
```ts
const handleOpenForm = () => {
  initFieldValues();
  setShowSubmitForm(true);
  setSubmitError('');
  setSuccess('');
};
```

**After (fixed):**
```ts
const handleOpenForm = () => {
  // If no custom columns exist, submit directly without showing a form
  if (!hasColumns) {
    handleSubmitRequest();
    return;
  }
  initFieldValues();
  setShowSubmitForm(true);
  setSubmitError('');
  setSuccess('');
};
```

When a workflow has no custom columns:
- The submit button now triggers an immediate POST to `/approvals` with an empty fields array
- The success message appears and the user is redirected to the dashboard after 1.5 seconds
- No empty form is displayed
- The `validateFields()` call in `handleSubmitRequest()` correctly returns `true` when there are no columns (line 69: `if (!workflow?.columns) return true;`)

When a workflow **does** have custom columns:
- Behavior is unchanged — the dynamic form appears with inputs for each column

## Additional Fix: Nested Form in Workflows.tsx

The same nested form issue from the options-editor fix was also present in `Workflows.tsx` (the "Create Workflow" page). This was fixed simultaneously — replacing the inner `<form>` with a `<div>` + `onClick` handler for the "Add" option button.

## Lessons Learned

- Conditional rendering of form UI must account for the **empty case** (no custom fields) — either show the form regardless or provide an alternative path
- When a workflow has no custom columns, submitting directly without a form is the correct UX — the user doesn't need to fill out anything extra
- The same anti-patterns tend to spread across similar components — when fixing a bug, check all related files for the same issue