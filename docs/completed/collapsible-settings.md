# Collapsible Settings — Completed

**Date:** 2026-07-26

**Status:** Complete

**Related Plan:** `docs/plans/collapsible-settings.md`

---

## Summary

Converted the Settings page from a flat layout into an accordion pattern where all sections are collapsed by default. Users click a section header to expand it and reveal its full content. Additionally, Categories management was moved from its standalone `/categories` page **into the Settings page** as a collapsible section.

---

## Open Question Resolutions

| # | Question | Decision |
|---|----------|----------|
| 1 | Should standalone `/categories` route redirect to `/settings`? | **Removed entirely.** No redirect. |
| 2 | Eager or lazy Categories data fetching? | **Eager** — fetched on Settings mount via `useApi`. |
| 3 | Add "Expand All / Collapse All" toggle? | **No.** Not needed for this iteration. |
| 4 | What happens to Categories import in App.tsx? | **Removed.** |

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `client/src/components/CollapsibleSection.tsx` | **Created** | Reusable accordion section component with chevron toggle |
| `client/src/index.css` | **Modified** | Added `.collapsible-header`, `.collapsible-chevron`, `.collapsible-content` classes |
| `client/src/pages/Settings.tsx` | **Modified** | Wrapped all 5 sections in `CollapsibleSection`; inlined Categories management logic; new imports for `useApi`, `LoadingSpinner`, `CollapsibleSection`, and `WorkflowCategory` type |
| `client/src/pages/Categories.tsx` | **Deleted** | All logic moved into Settings |
| `client/src/App.tsx` | **Modified** | Removed `Categories` import and `/categories` route |
| `client/src/components/Layout.tsx` | **Modified** | Removed "Categories" nav link (desktop + mobile) |

---

## Sections (All Collapsed by Default)

| # | Section | Visible To |
|---|---------|-----------|
| 1 | Organizations | Super Admin |
| 2 | Login Mode | Admin |
| 3 | Categories | Admin |
| 4 | Profile | All authenticated users |
| 5 | Change Password | All authenticated users |

---

## CollapsibleSection Component

**File:** `client/src/components/CollapsibleSection.tsx`

```tsx
interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;  // defaults to false
  children: React.ReactNode;
}
```

- Uses local `useState` for `isExpanded` (defaults to `false`)
- Renders a clickable header with a chevron (▸) that rotates 90° when expanded
- Content is conditionally rendered (`{isExpanded && children}`)
- Header has hover background effect using `var(--surface-hover)`
- Chevron transitions use CSS `transform: rotate()` with `0.2s ease`

---

## CSS Additions (index.css)

Three new `@layer components` classes:

- **`.collapsible-header`** — flex row, padding, cursor pointer, hover state
- **`.collapsible-chevron`** — inline chevron with smooth CSS rotation; `.collapsible-chevron.expanded` adds `rotate(90deg)`
- **`.collapsible-content`** — padded container with top border separator

---

## Categories Migration Details

The entire Categories table UI (inline add row, drag-and-drop reorder, inline edit, active/inactive toggle, delete) was moved from `Categories.tsx` into `Settings.tsx` as a `CollapsibleSection`:

- Uses `useApi<WorkflowCategory[]>('/categories')` for data fetching (same as before)
- All state variables renamed with `cat` prefix to avoid collisions with existing Settings state (`editingCatId`, `editCatName`, `newCatName`, `addingCat`, `catError`, `catSuccess`)
- Drag-and-drop handlers preserved
- Loading state handled by `<LoadingSpinner>` within the collapsible content
- Error/success messages are section-scoped (visible only when expanded)