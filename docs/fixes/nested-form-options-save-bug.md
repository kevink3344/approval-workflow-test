# Fix: Adding Options to Choice Columns Doesn't Save

**Date:** 2026-07-25

**Status:** Resolved

---

## Symptoms

When editing a workflow's custom fields (columns), adding a new option to a "Single Choice" or "Multiple Choice" column via the "Add" button had no effect. The option text was typed, but clicking "Add" either triggered the outer form submission or did nothing at all — the new option never appeared in the list and was never sent to the server.

## Root Cause

In `client/src/pages/WorkflowEdit.tsx`, the options editor for choice columns used a **nested HTML `<form>`** element inside the main `<form onSubmit={handleSubmit}>`. The structure was:

```tsx
<form onSubmit={handleSubmit}>             {/* Outer form: saves the workflow */}
  ...
  <form onSubmit={...}>                     {/* Inner form: adds an option (INVALID) */}
    <input placeholder="New option..." />
    <button type="submit">Add</button>
  </form>
  ...
</form>
```

Nested `<form>` elements are **invalid HTML**. The HTML specification explicitly forbids nesting forms (a `<form>` cannot contain another `<form>`). Browsers handle this unpredictably:
- In many cases, the inner form is **ignored entirely** — clicking the "Add" button triggers the outer form's submission instead.
- Even if a browser does process the inner form's `onSubmit`, the behavior is inconsistent across browsers and frameworks like React.

Because React relies on the actual DOM event system, the inner form's `onSubmit` never fires reliably, so `addOption(index, val)` was never called.

## Fix

Replaced the inner `<form>` with a plain `<div>` and switched the button from `type="submit"` to `type="button"` with an explicit `onClick` handler:

**Before (broken):**
```tsx
<form
  onSubmit={(e) => {
    e.preventDefault();
    const input = (
      e.target as HTMLFormElement
    ).querySelector('input') as HTMLInputElement;
    const val = input.value.trim();
    if (val) {
      addOption(index, val);
      input.value = '';
    }
  }}
  className="flex gap-2"
>
  <input type="text" className="input-control text-sm flex-1" placeholder="New option..." />
  <button type="submit" className="secondary-button text-xs">
    Add
  </button>
</form>
```

**After (fixed):**
```tsx
<div className="flex gap-2">
  <input
    id={`option-input-${index}`}
    type="text"
    className="input-control text-sm flex-1"
    placeholder="New option..."
  />
  <button
    type="button"
    className="secondary-button text-xs"
    onClick={() => {
      const input = document.getElementById(
        `option-input-${index}`,
      ) as HTMLInputElement;
      const val = input.value.trim();
      if (val) {
        addOption(index, val);
        input.value = '';
      }
    }}
  >
    Add
  </button>
</div>
```

Key changes:
1. Replaced `<form>` with `<div>` (eliminating the invalid nesting)
2. Added a unique `id` to each option input: `` `option-input-${index}` ``
3. Changed `<button type="submit">` to `<button type="button" onClick={...}>`
4. The `onClick` handler reads the input value via `document.getElementById()`, calls `addOption(index, val)`, and clears the input — same net behavior

## Lessons Learned

- **Never nest `<form>` elements** — the HTML spec forbids it, and browsers handle it unreliably
- For inline add/delete operations inside a larger form, use `<div>` containers with `type="button"` and explicit `onClick` handlers instead of inner forms
- The `type="button"` attribute on a `<button>` inside a `<form>` prevents it from triggering form submission — always use it for non-submit buttons
- React's synthetic event system depends on valid DOM structure; invalid HTML (like nested forms) can cause React event handlers to silently fail