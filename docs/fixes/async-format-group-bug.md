# Fix: Async `formatGroup` Causing Missing Group Data & 500 Errors

**Date:** 2026-07-25

**Status:** Resolved

---

## Symptoms

1. **Creating an Approval Group:** Group name and description appeared to not be saved in the API response.
2. **Updating an Approval Group:** Returned "An internal server error occurred." (500)

## Root Cause

In `server/src/services/approvalGroupService.ts`, the `formatGroup()` function:

```ts
async function formatGroup(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
```

…was declared `async` despite being a **synchronous function with no `await` calls**.

Because it was `async`, it returned a **Promise** instead of a plain object. When that Promise was spread via `...formatGroup(g)` in the `attachMembers()` function:

```ts
return groups.map((g) => {
  const gId = g.id as string;
  return {
    ...formatGroup(g),  // ← spreads Promise internals, NOT group fields
    members: membersMap.get(gId) || [],
  };
});
```

…the Promise's internal properties were spread into the result instead of the group's actual fields (`id`, `name`, `description`, etc.).

This affected **every** operation that returned group data:
- `listApprovalGroups()` → garbled group list
- `getApprovalGroupById()` → garbled single group
- `createApprovalGroup()` → returns `getApprovalGroupById()` → garbled response
- `updateApprovalGroup()` → returns `getApprovalGroupById()` → garbled response → potential 500 error if the frontend tried to access non-existent fields

## Fix

Removed the `async` keyword from `formatGroup()`:

```ts
// BEFORE (broken):
async function formatGroup(row: Record<string, unknown>) {

// AFTER (fixed):
function formatGroup(row: Record<string, unknown>) {
```

Since `formatGroup()` never uses `await`, the `async` keyword was both unnecessary and harmful — it caused the function to wrap its return value in a Promise that was then spread as an object.

## Lessons Learned

- Only declare a function `async` if it actually uses `await` inside its body
- Spreading a Promise (`...promise`) does **not** `await` the promise — it spreads the Promise's own enumerable properties (which is almost never what you want)
- TypeScript does not warn about this pattern because `Promise<T>` and regular objects both support the spread operator, but the runtime behavior is very different