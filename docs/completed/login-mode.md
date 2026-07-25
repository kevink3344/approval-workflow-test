**Date Completed:** 2026-07-25

**Feature:** Login Mode (Settings → Login Mode)

**Source Plan:** `docs/plans/login-mode.md`

---

## Summary

Implements a three-mode login page selector: **Select User (Test)**, **Password (Production)**, and **System Maintenance**. Admin users toggle the mode in Settings; the login page renders the corresponding form. An optional `LOGIN_MODE` environment variable overrides the DB-stored value.

### Backend Changes

**New files:**
- `server/src/routes/settings.ts` — `GET /api/settings/:key` (public) and `PUT /api/settings/:key` (admin-only), key/value settings store
- `server/src/controllers/settingsController.ts` — env var override logic, allowed-keys gate (`login_mode`, `maintenance_message`), upsert with defaults
- `server/src/routes/info.ts` — `GET /api/info` exposing `loginModeOverride` for Settings UI

**Modified files:**
- `server/src/config/env.ts` — Added `LOGIN_MODE` env var
- `server/src/config/seed.ts` — Added `app_settings` table
- `server/src/services/authService.ts` — Added `loginUserById()` (no-password select-mode login) and `listUsers()` (user dropdown data)
- `server/src/controllers/authController.ts` — Added `loginSelect`, `loginPassword`, `listUsers` handlers
- `server/src/routes/auth.ts` — `POST /api/auth/login` (select), `POST /api/auth/login-with-password`, `GET /api/auth/users`
- `server/src/app.ts` — Registered `/api/settings` and `/api/info` routes

### Frontend Changes

**New files:**
- `client/src/api/settings.ts` — `getPublicSetting()` and `updateSetting()` helpers

**Modified files:**
- `client/src/types/index.ts` — Added `LoginMode`, `SettingResponse`, `InfoResponse`, `UserListItem` types
- `client/src/context/AuthContext.tsx` — Added `loginSelect(userId)` and `loginPassword(email, password)` methods
- `client/src/pages/Login.tsx` — Complete rewrite with mode-based conditional rendering (select/password/maintenance forms, `?admin=1` bypass)
- `client/src/pages/Settings.tsx` — Admin-only Login Mode section with three-button toggle, env override banner, maintenance message textarea
- `.env.example` — Documented `LOGIN_MODE` env var

### Verification

1. ✅ Default state: login page shows select-user form
2. ✅ Toggle to Password: password form only
3. ✅ Toggle to Maintenance: maintenance message with `?admin=1` admin bypass
4. ✅ Env var override: Settings UI banner + disabled buttons
5. ✅ Non-admin `PUT /api/settings/:key` returns `403`
6. ✅ Unauthenticated `GET /api/settings/:key` works for public login page