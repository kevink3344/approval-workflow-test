# Collapsible Settings — Plan

**Date:** 2026-07-26

**Status:** Draft

**Depends on:** `category-list.md` (Categories feature already implemented)

---

## Overview

The Settings page (`client/src/pages/Settings.tsx`) currently displays all sections flat on one page. This plan converts each section into an expandable/collapsible accordion card. All sections start **collapsed by default**, and clicking the header expands the section to show its full content. Additionally, the Categories management UI is moved from its standalone page (`/categories`) **into the Settings page** as one of the collapsible sections (admin-only).

---

## 1. Current State

### Settings Page Sections (flat layout)

| # | Section | Visibility | Content |
|---|---------|-----------|---------|
| 1 | Organizations | Super Admin only | Create org form, org list table with delete |
| 2 | Login Mode | Admin only | Login mode toggle buttons, maintenance message textarea |
| 3 | Profile | All authenticated users | Name field, email (read-only), role badge |
| 4 | Change Password | All authenticated users | Current password, new password, confirm |

### Categories (standalone page)

- Route: `/categories` (App.tsx line 66-71)
- Nav link in Layout.tsx (desktop line 53-56, mobile line 149-156)
- Full CRUD table with inline add/edit, drag-and-drop reorder, active/inactive toggle, delete

### Key Files

| File | Role |
|------|------|
| `client/src/pages/Settings.tsx` | Main settings page (4 sections, flat) |
| `client/src/pages/Categories.tsx` | Standalone categories management page |
| `client/src/App.tsx` | Route definitions |
| `client/src/components/Layout.tsx` | Nav links |
| `client/src/index.css` | CSS variables and component classes |

---

## 2. Target State

### Settings Page — Accordion Layout

```
┌─────────────────────────────────────────┐
│ Settings                                 │
│                                          │
│ ▸ Organizations          (Super Admin)   │  ← collapsed
│ ▸ Login Mode             (Admin)         │  ← collapsed
│ ▸ Categories             (Admin)         │  ← collapsed (NEW — moved here)
│ ▸ Profile                (All)           │  ← collapsed
│ ▸ Change Password        (All)           │  ← collapsed
│                                          │
│ (clicking ▸ expands any section)         │
│                                          │
│ ▼ Profile                               │  ← expanded
│   ┌───────────────────────────────────┐  │
│   │ Full Name: [input]                │  │
│   │ Email:      kevin@example.com     │  │
│   │ Role:       admin                 │  │
│   │ [Save Changes]                    │  │
│   └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Categories Page

- The standalone `/categories` page is **removed**.
- The `/categories` route can either:
  - Be removed entirely, or
  - Redirect to `/settings` (with a query param `?section=categories` to auto-expand that section — optional enhancement).
- The "Categories" nav link in `Layout.tsx` is **removed** (both desktop and mobile).
- Categories management is now accessed exclusively through Settings → Categories section.

### Visibility Rules (unchanged)

| Section | Visible To |
|---------|-----------|
| Organizations | `isSuperAdmin` only |
| Login Mode | `isAdmin` only |
| Categories | `isAdmin` only |
| Profile | All authenticated users |
| Change Password | All authenticated users |

---

## 3. Implementation Steps

### Step 1 — Create `CollapsibleSection` Component

**New file:** `client/src/components/CollapsibleSection.tsx`

A reusable component that wraps each settings section with expand/collapse behavior.

```tsx
// Props
interface CollapsibleSectionProps {
  title: string;         // Section heading (e.g., "Profile", "Login Mode")
  defaultExpanded?: boolean;  // Default: false (all collapsed)
  children: React.ReactNode;
}
```

**Behavior:**
- Uses local `useState` for `isExpanded` (defaults to `false` — all collapsed).
- Renders a clickable header bar with:
  - Chevron icon (▸ when collapsed, ▾ when expanded) — rotated via CSS `transform`
  - Section title text
- When clicked, toggles `isExpanded`.
- Content area uses conditional rendering (`{isExpanded && children}`) or CSS `max-height` animation.
- Visual styling:
  - Header bar: `surface` background, border, padding, cursor pointer
  - Hover state: slight background darkening
  - Chevron transition: `transform 0.2s ease`
  - Content area: padded, border-top separator when expanded

**CSS additions to `index.css`:**

```css
.collapsible-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
}

.collapsible-header:hover {
  background-color: var(--surface-hover);
}

.collapsible-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  transition: transform 0.2s ease;
  color: var(--text-muted);
  font-size: 14px;
}

.collapsible-chevron.expanded {
  transform: rotate(90deg);
}

.collapsible-content {
  padding: 20px;
  border-top: 1px solid var(--border);
}
```

### Step 2 — Refactor `Settings.tsx` to Use Accordion

**File:** `client/src/pages/Settings.tsx`

#### 2a. Import `CollapsibleSection`
```tsx
import CollapsibleSection from '../components/CollapsibleSection';
```

#### 2b. Replace flat `<div className="surface p-6">` wrappers with `<CollapsibleSection>`

**Before (Profile section example):**
```tsx
<div className="surface p-6">
  <h3 className="text-lg font-semibold text-[--text] mb-4">Profile</h3>
  <form onSubmit={handleSaveProfile}>
    {/* form fields */}
  </form>
</div>
```

**After:**
```tsx
<CollapsibleSection title="Profile">
  <form onSubmit={handleSaveProfile}>
    {/* form fields */}
  </form>
</CollapsibleSection>
```

Apply this pattern to all 4 existing sections:
- Organizations (lines 288-415)
- Login Mode (lines 419-497)
- Profile (lines 500-534)
- Change Password (lines 537-579)

#### 2c. Keep global error/success banners at the top
The existing `{error && ...}` and `{success && ...}` banners at lines 267-283 should remain visible at all times (outside any collapsible section) so users see feedback regardless of which sections are expanded.

### Step 3 — Move Categories into Settings

This is the most substantial change. The entire Categories management UI moves into Settings as a collapsible section.

#### 3a. Extract Categories logic into a reusable hook or inline in Settings

**Option A (Recommended): Inline in Settings.tsx** — Copy the Categories logic (state, handlers, JSX) into `Settings.tsx` as a new section, wrapped in `isAdmin` guard. This avoids prop-drilling complexity but increases the Settings file size.

**Option B: Shared component** — Create `client/src/components/CategoriesManager.tsx` that both the standalone `Categories.tsx` page and `Settings.tsx` render. However, since the standalone page is being removed, there's no benefit to this indirection.

**Chosen: Option A (inline)** — Simpler, no extra file, clear ownership.

#### 3b. Add Categories state and handlers to Settings.tsx

Copy the following from `Categories.tsx` into `Settings.tsx`:

- `useApi` import (already in Settings? No — currently Settings uses `apiClient` directly. Need to add `import { useApi } from '../hooks/useApi'` and `import LoadingSpinner from '../components/LoadingSpinner'`.)
- State variables: `editingId`, `editName`, `newName`, `adding`, `actionError`, `actionSuccess`, `dragIndex`, `dropTargetIndex`
- Handlers: `clearMessages`, `handleAdd`, `startEdit`, `cancelEdit`, `handleSaveEdit`, `handleToggleActive`, `handleDelete`, drag-and-drop handlers
- JSX: the categories table (from `Categories.tsx` lines 192-350, excluding the page-level heading and loading/error wrappers)

**Important:** The collapsible section wrapper means the categories table will be inside `<CollapsibleSection title="Categories">`. The section-level `actionError`/`actionSuccess` messages stay inside the collapsible content area (they're part of that section).

#### 3c. Add Categories section to Settings with admin guard

```tsx
{isAdmin && (
  <CollapsibleSection title="Categories">
    {/* categories table JSX here */}
  </CollapsibleSection>
)}
```

### Step 4 — Update Routing & Navigation

#### 4a. Remove Categories page and route (App.tsx)

**File:** `client/src/App.tsx`

1. Remove the `import Categories from './pages/Categories';` line (line 12).
2. Remove the categories route block (lines 65-72):
```tsx
// REMOVE:
<Route
  path="/categories"
  element={
    <ProtectedRoute adminOnly>
      <Categories />
    </ProtectedRoute>
  }
/>
```

#### 4b. Remove "Categories" nav links (Layout.tsx)

**File:** `client/src/components/Layout.tsx`

Remove the desktop nav link (lines 52-56):
```tsx
// REMOVE:
{isAdmin && (
  <Link to="/categories" className={navLinkClass('/categories')}>
    Categories
  </Link>
)}
```

Remove the mobile nav link (lines 149-156):
```tsx
// REMOVE:
{isAdmin && (
  <Link
    to="/categories"
    className={navLinkClass('/categories')}
    onClick={() => setMobileMenuOpen(false)}
  >
    Categories
  </Link>
)}
```

#### 4c. (Optional) Add redirect for old `/categories` URL

If concerned about bookmarks or muscle memory, add a redirect route:
```tsx
<Route path="/categories" element={<Navigate to="/settings" replace />} />
```
Requires importing `Navigate` from `react-router-dom`. This is optional and can be skipped for cleanliness — the user didn't mention needing this.

### Step 5 — Remove Standalone Categories Page

**File:** `client/src/pages/Categories.tsx`

Delete this file entirely. All its logic is now in `Settings.tsx`.

---

## 4. Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `client/src/components/CollapsibleSection.tsx` | **CREATE** | New reusable accordion section component |
| `client/src/index.css` | **MODIFY** | Add `.collapsible-header`, `.collapsible-chevron`, `.collapsible-content` classes |
| `client/src/pages/Settings.tsx` | **MODIFY** | Wrap sections in `CollapsibleSection`; inline Categories management logic; add Categories as a collapsible section |
| `client/src/pages/Categories.tsx` | **DELETE** | All logic moved into Settings |
| `client/src/App.tsx` | **MODIFY** | Remove `Categories` import and route |
| `client/src/components/Layout.tsx` | **MODIFY** | Remove "Categories" nav link (desktop + mobile) |

---

## 5. Technical Details

### CollapsibleSection Component API

```tsx
interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;  // defaults to false
  children: React.ReactNode;
}
```

### Section Order in Settings

The final section order in `Settings.tsx`:

1. **Organizations** — super admin only
2. **Login Mode** — admin only
3. **Categories** — admin only (NEW)
4. **Profile** — all users
5. **Change Password** — all users

### Error/Success Message Handling

- **Page-level** messages (`error`, `success` state in Settings) apply to Profile and Password operations. These stay at the top of the page, outside any collapsible section.
- **Section-level** messages (org-specific `orgError`/`orgSuccess`, login-mode `loginModeError`, categories `actionError`/`actionSuccess`) remain inside their respective collapsible sections. This means:
  - If the Organizations section is collapsed and an org error occurs, the user won't see it until they expand the section.
  - **Decision:** This is acceptable behavior. If needed later, we can add a small badge or indicator on the collapsed header (e.g., "Organizations ⚠️") to signal that the section contains an error. For now, keeping it simple.

### Drag-and-Drop in Collapsible Section

Categories drag-and-drop works inside the collapsible content area. Since the content is always rendered when expanded (not conditionally removed), DOM elements will exist and drag operations will work normally.

### Mobile Considerations

The accordion pattern works well on mobile — fewer sections visible means less scrolling. The header bars should have at least 44px touch target height (already ensured by padding).

---

## 6. Implementation Order

1. **Create `CollapsibleSection.tsx`** component
2. **Add CSS classes** to `index.css` for accordion styling
3. **Refactor `Settings.tsx`** — wrap existing 4 sections in `CollapsibleSection`
4. **Inline Categories** — copy Categories logic and JSX into `Settings.tsx` as the 3rd collapsible section
5. **Update `App.tsx`** — remove Categories import and route
6. **Update `Layout.tsx`** — remove Categories nav links (desktop + mobile)
7. **Delete `Categories.tsx`** — standalone page no longer needed
8. **Test** — verify all sections expand/collapse, Categories CRUD works within Settings, no broken routes

---

## 7. Open Questions / Decisions

1. **Should the standalone `/categories` route redirect to `/settings`?**
   - Decision: Remove the route entirely. No redirect needed unless requested.

2. **Should Categories data be fetched eagerly in Settings (always), or lazily when the section is expanded?**
   - Decision: Eagerly (on mount) for simplicity. The `useApi` hook fires on component mount, same as the current `Categories.tsx` page. The data call is lightweight.

3. **Should there be an "Expand All / Collapse All" toggle?**
   - Decision: Not needed for this iteration. Users typically only need one section at a time. Can be added later if requested.

4. **What happens to the Categories import in `App.tsx`?**
   - Decision: Removed. The component is no longer routed.