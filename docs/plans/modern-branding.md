# Style Migration Plan — Brutalist → TeamSupportPro Modern SaaS

**Date:** 2026-07-23

**Source:** teamsupportpro-development.azurewebsites.net

**Goal:** Migrate the client-side visual design from a brutalist black-and-white aesthetic to the modern, soft SaaS design used by TeamSupportPro, without changing any application logic, routes, or API calls.

---

## Summary of Changes

| Design Element | Current (Brutalist) | Target (TSPro) |
| --- | --- | --- |
| Body font | `system-ui, -apple-system, sans-serif` | `"Work Sans", sans-serif` (400, 500, 600) |
| Mono font | `"JetBrains Mono"` (Google CDN) | `"JetBrains Mono"` (npm fontsource) |
| App background | `white` | `#f4f7fb` (light blue-gray) |
| Text color | `black` | `#10243b` (dark navy) |
| Muted text | `text-gray-600` | CSS variable `--text-muted` |
| Primary accent | `black` (#000) | `#0078d4` (Microsoft blue) |
| Borders | `2px solid black` | `1px solid var(--border)` |
| Border radius | Sharp (none) | `2px` on all interactive elements |
| Button style | Inversion hover (`bg-black hover:bg-white`) | Uppercase, letter-spaced, primary blue, `color-mix()` hover |
| Shadows | `4px 4px 0px black` offset | Large blue-tinted (`0 20px 60px rgba(13,47,79,0.28)`) |
| Header | White + 2px black bottom border | Dark navy gradient `linear-gradient(135deg, #0d2f4f 0%, #123555 50%, #0f3d63 100%)` |
| Sidebar | None | Dark navy, white text, active state highlight via `color-mix()` |
| CSS approach | Tailwind v3 utilities only | Tailwind v3 utilities + CSS custom properties + component utility classes |
| Hover effects | `color-mix()` in ok lab | Direct color swaps (`hover:bg-black`) |
| Selection | Browser default | Accent-blue `#0078d4` at 22% opacity |

---

## Implementation Steps

### Step 1 — Install fontsource packages

- **File:** `client/package.json`
- **Action:** Run `npm install @fontsource/work-sans` in the `client/` directory.
- **Reason:** Self-hosted fonts are preferred over Google Fonts CDN for offline dev and consistency. JetBrains Mono may already be installed via fontsource; add if missing.

### Step 2 — Update `client/index.html`

- **Changes:**
    - Remove the Google Fonts `<link>` tags for JetBrains Mono (lines 7–9)
    - Change `<title>` from `test-scaffold` to `team-support-pro`
    - Change `<html lang="en" class="bg-white">` to `<html lang="en">` (bg is now set in CSS)
- **No other structural changes.**

### Step 3 — Rewrite `client/tailwind.config.js`

- **Changes:**
    - Add `Work Sans` as the primary `fontFamily.sans` value: `['"Work Sans"', 'sans-serif']`
    - Keep `fontFamily.mono` as `['"JetBrains Mono"', 'monospace']`
    - Extend theme with: `fontWeight` (medium: 500, semibold: 600, bold: 700), `letterSpacing` (wide: '.025em', wider: '.05em'), `borderRadius` with 2px values
- **Reason:** Tailwind config drives utility class generation; the custom CSS variables in `index.css` will handle most of the design, but utility classes should still align.

### Step 4 — Complete rewrite of `client/src/index.css` 🔴 (LARGEST CHANGE)

This is the core of the migration. Replace all brutalist CSS with:

#### 4a — CSS Custom Properties on `:root`

```css
:root {
  --accent: #0078d4;
  --border: #e5e7eb;
  --text: #10243b;
  --text-muted: #6b7280;
  --card-bg: #ffffff;
  --app-bg: #f4f7fb;
  --header-bg: linear-gradient(135deg, #0d2f4f 0%, #123555 50%, #0f3d63 100%);
  --input-bg: #ffffff;
  --button-bg: #0078d4;
  --button-text: #ffffff;
  --panel-bg: #ffffff;
  --menu-bg: #ffffff;
  --surface-hover: rgba(0, 0, 0, 0.03);
  --color-primary: #0078d4;
}
```

#### 4b — Base layer (`@layer base`)

- `body`: `font-family: "Work Sans", sans-serif`, `color: #10243b`, `background: #f4f7fb`, `webkit-font-smoothing: antialiased`
- : `box-sizing: border-box`
- `html, body, #root`: `min-height: 100%`
- `::selection`: accent blue at 22% opacity via `color-mix()`

#### 4c — Component utility classes (`@layer components`)

Following the TSPro design system:

- `.app-shell` — dark navy gradient header/sidebar with white text
- `.surface` / `.surface-muted` — 1px border, 2px radius card backgrounds
- `.login-shell` — blue gradient background, centered, min-height: `100svh`. Uses `radial-gradient(circle at 0 0, #0078d426, #0000 28%), linear-gradient(#edf3f9 0%, #f7f9fc 100%)`
- `.login-card` — white card, 2px radius, `box-shadow: 0 30px 80px rgba(13, 47, 79, 0.08)`
- `.field` — grid with 8px gap for form layouts
- `.field-label` — uppercase, letter-spaced, text-muted, 12px, weight 600
- `.input-control` — 1px border, 2px radius, full width, focus: border accent
- `.form-input` — similar to `.input-control`, used on login/register
- `.primary-button` — accent bg, white text, uppercase, letter-spaced 0.08em, 13px, weight 700, 2px radius, inline-flex, color-mix hover
- `.secondary-button` — app-bg, text color, 1px border, uppercase, same sizing as primary
- `.icon-button` — transparent, 36×36px, centered icon, color-mix hover
- `.badge` — inline-flex, 2px radius, 12px weight 600, with color variants:
    - `.badge-blue` — `#eaf3ff` bg, `#315dc6` text, `#a9c9ff` border
    - `.badge-green` — `#e6fff0` bg, `#1e8c52` text, `#96e0b0` border
    - `.badge-red` — `#ffe8ea` bg, `#ba3040` text, `#ffb1b8` border
    - `.badge-amber` — `#fff5d6` bg, `#a56c00` text, `#f8d36d` border
    - `.badge-orange` — `#fff0e2` bg, `#b35d19` text, `#ffc28c` border
    - `.badge-slate` — `#f5f7fa` bg, `#546274` text, `#d5dce4` border
- `.badge-button` — bordered, clickable badge variant with hover
- `.tab-link` — bottom-border active indicator, text-muted default
- `.google-login-button` — white bg, border, centered, full width, 2px radius
- `.notification-unread-button` / `.notification-unread-dot` — red accent styling

#### 4d — Media queries

- `@media (max-width: 768px)`: scale buttons/inputs for touch (44px min-height), full-width cards, hide resize handles
- `@media (max-width: 640px)`: full-width primary/secondary buttons, justified center

### Step 5 — Update `client/src/main.tsx`

- Add font imports at the top:
    
    ```tsx
    import '@fontsource/work-sans/400.css';
    import '@fontsource/work-sans/500.css';
    import '@fontsource/work-sans/600.css';
    import '@fontsource/jetbrains-mono/400.css';
    import '@fontsource/jetbrains-mono/600.css';
    import './index.css';
    ```
    

### Step 6 — Migrate `client/src/components/Layout.tsx`

- **Header redesign:** Replace white header with dark navy gradient `bg-[linear-gradient(135deg,#0d2f4f_0%,#123555_50%,#0f3d63_100%)]`, white text, Work Sans
- **Navigation links:** White text with `opacity-70`, hover `opacity-100`. Active state uses `data-active` attribute with `bg-white/15`
- **Login/Register links:** Semi-transparent white hover, no inversion pattern
- **Main content area:** Add `bg-[#f4f7fb]` background
- **Remove or minimize footer** (TSPro uses minimal footer)

### Step 7 — Migrate `client/src/pages/Login.tsx`

- Wrap in `.login-shell` + `.login-card` instead of `max-w-sm mx-auto py-16`
- Form inputs: Change from `<input className="w-full px-3 py-2 text-sm">` to use `.input-control` class
- Labels: Use `.field-label` class
- Error/success banners: Use badge-style coloring (e.g., `.badge-red` style, not `border-2 border-black bg-red-50`)
- Buttons: Replace `brutal-border` with `.primary-button`
- Divider: Replace heavy `border-t-2 border-black` with `border-t border-gray-200`
- Maintenance notice: Use `.surface-muted` card instead of `border-2 bg-yellow-50`

### Step 8 — Migrate `client/src/pages/Register.tsx`

- Same `.login-shell` / `.login-card` pattern as Login
- Form fields: `.field > .field-label + .input-control`
- Submit button: `.primary-button`
- Error messages: subtle colored banner

### Step 9 — Migrate `client/src/pages/Home.tsx`

- Hero section: Remove heavy black-bordered buttons. Use `.primary-button` and `.secondary-button`
- Feature cards (01/02/03): Replace `border-2 border-black p-6` with `.surface` card class
- Tech stack card: Replace `border-2 border-black p-6` with `.surface` or `.surface-muted`
- Number badges in features: Use `.badge` styling instead of raw `<span>`

### Step 10 — Migrate `client/src/pages/Dashboard.tsx`

- **Profile card:** Replace `border-2 border-black p-6` with `.surface`
- **Request card:** Replace `border-2 border-black p-6` with `.surface` or `.surface-muted`
- **Status badges:** Replace inline span styling (`bg-red-200 text-red-800`) with `.badge-red` / `.badge-green` classes
- **File card:** Same `.surface` treatment
- **Buttons:** Replace `brutal-border` / `border-2 border-black` with `.primary-button` / `.secondary-button`
- **Modal overlay:** Keep `bg-black/50` but add `backdrop-blur-sm`
- **Modal card:** Replace `border-2 border-black` with `.surface` + shadow
- **Edit slide-out panel:** Replace `border-l-2 border-black` with `.surface` styling and shadow

### Step 11 — Migrate `client/src/pages/Settings.tsx`

- **Toggle buttons:** Replace `brutal-border` toggle buttons with `.badge-button` active/inactive styling
- **Form inputs:** Use `.field > .field-label + .input-control` pattern
- **Textarea:** Use `.input-control` class
- **Save button:** Use `.primary-button`
- **Locked/error/success banners:** Use badge-style colored banners (`.badge-amber`, `.badge-red`, `.badge-green` patterns)
- **Back button:** Use `.secondary-button`
- **Maintenance message area:** Use `.surface-muted` instead of `bg-gray-50 border-2 border-black`

---

## Files Modified (in implementation order)

| # | File | Change Type |
| --- | --- | --- |
| 1 | `client/package.json` | Add `@fontsource/work-sans` dependency |
| 2 | `client/index.html` | Remove Google Fonts CDN, update title |
| 3 | `client/tailwind.config.js` | Extend theme with TSPro design tokens |
| 4 | `client/src/index.css` | **Complete rewrite** with CSS variables + component classes |
| 5 | `client/src/main.tsx` | Add fontsource imports |
| 6 | `client/src/components/Layout.tsx` | Redesign header from brutalist to navy gradient |
| 7 | `client/src/pages/Login.tsx` | Migrate to `.login-shell` / `.input-control` / `.primary-button` |
| 8 | `client/src/pages/Register.tsx` | Migrate to `.login-shell` / `.input-control` / `.primary-button` |
| 9 | `client/src/pages/Home.tsx` | Migrate to `.surface` cards, `.primary-button` / `.secondary-button` |
| 10 | `client/src/pages/Dashboard.tsx` | Migrate to `.surface`, `.badge-*`, `.primary-button`, `.secondary-button` |
| 11 | `client/src/pages/Settings.tsx` | Migrate to `.badge-button`, `.input-control`, `.primary-button`, `.secondary-button` |

---

## What Does NOT Change

- ✅ No React component logic or state management
- ✅ No API calls or route handling
- ✅ No backend code whatsoever
- ✅ No authentication flow
- ✅ No form validation logic
- ✅ All existing Tailwind utility classes that don't conflict

## Risk Mitigation

- **Incremental approach:** Each page can be verified independently after migration
- **No logic changes:** If a page looks wrong, revert only its CSS classes, everything still works
- **Tailwind co-existence:** Custom component classes supplement, not replace, Tailwind utilities
- **No migration of Tailwind v4 features:** Target uses Tailwind v4, but we stay on v3 to avoid breaking changes; the custom CSS handles what v4's `@layer`/`@theme` would provide