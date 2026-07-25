# Fix: Added CRUD Endpoint Testing Phase to Approval Groups Plan

**Date:** 2026-07-25

**Status:** Resolved

---

## Issue

The Approval Groups implementation plan (`docs/plans/approval-group.md`) did not include a step for testing the CRUD API endpoints after they were built. This led to bugs being discovered only when the frontend UI was used, resulting in:

- A **500 error** on the Approval Groups page (missing database tables — seed not re-run)
- **Missing group name and description** on create (async `formatGroup` bug)
- **500 internal server error** on update (same async bug)

All three issues were backend problems that could have been caught immediately after Phase 2, before any frontend work began.

## Fix

Added **Phase 2.5 — Test Approval Groups CRUD Endpoints** to the implementation plan, positioned right after building the API (Phase 2) and before updating Workflows (Phase 3).

The new phase includes:

| Test | Endpoint | What it verifies |
|------|----------|-----------------|
| LIST | `GET /api/approval-groups` | Empty state or populated list with members |
| CREATE | `POST /api/approval-groups` | Group fields (`id`, `name`, `description`, `members`) are all present |
| GET | `GET /api/approval-groups/:id` | Single group matches create response |
| UPDATE | `PATCH /api/approval-groups/:id` | Updated fields and member list reflected |
| DELETE | `DELETE /api/approval-groups/:id` | Group removed; blocked if assigned to workflow |
| AUTH | All endpoints with non-admin token | Returns 403, not 500 |

Each test includes a `curl` command and expected response format, plus a checklist and troubleshooting pointers (e.g., reference to `docs/fixes/async-format-group-bug.md` if name/description are missing).

## Lesson

End-to-end integration testing of every new API endpoint should happen **immediately after the backend is built**, before any frontend code depends on it. A 5-minute `curl` test catches schema, service, and validation bugs that would otherwise surface as cryptic UI errors much later in the process.