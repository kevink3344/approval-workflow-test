# Separate Organizations (Multi-Tenancy) — Implementation Plan

**Date:** 2026-07-26

**Status:** Completed

---

## Overview

This plan introduces **Organization-level multi-tenancy** to the approval workflow system. Every application built will support a Super Admin who can create and manage one or more Organizations. Each Organization operates in complete isolation — its users, workflows, approvals, and data are scoped to that organization only. A Super Admin retains cross-organization visibility, but no other role can see data outside their own organization.

Organizations are a **foundational architectural concern** and must be implemented early, as nearly every subsequent feature (workflows, approval groups, notifications, etc.) depends on correct tenant scoping.

---

## Requirements Summary

| # | Requirement |
|---|------------|
| R1 | A **Super Admin** can **create, read, update, and delete** Organizations. |
| R2 | A Super Admin can **assign an Admin** to each Organization at creation time (or later). |
| R3 | Organization Admins can **manage their own users** — invite, register, or assign roles within their org. |
| R4 | Every user belongs to **exactly one Organization** (except Super Admin, who belongs to none or a special system org). |
| R5 | Upon login, users are **scoped to their Organization ONLY**. All API responses, queries, and data access are filtered by `organization_id`. |
| R6 | One Organization **cannot view, access, or modify** the data of another Organization. |
| R7 | Super Admin can **view and manage all Organizations and their data** (cross-tenant visibility). |
| R8 | Organization data isolation must be enforced at the **database query level**, not just the UI level. |
| R9 | Deleting an Organization cascades or safely handles all associated data (users, workflows, approvals, etc.). |

---

## Role Hierarchy (Revised)

| Role | Scope | Description |
|------|-------|-------------|
| `super_admin` | **System-wide** | Full access to all organizations and all data. Can create/manage/delete organizations and assign org admins. |
| `admin` | **Organization-scoped** | Full access within their own organization. Can manage users, workflows, approval groups, and all org-level settings. Cannot see other orgs. |
| `approver` | **Organization-scoped** | Can approve/reject requests assigned to them within their organization. |
| `user` | **Organization-scoped** | Standard user — can submit approval requests and view their own data within their organization. |

> **Note:** The previous `admin` role (system-wide) is replaced by `super_admin`. The existing `admin` role is now organization-scoped.

---

## Data Model Changes

### New Table: `organizations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique organization identifier |
| `name` | VARCHAR(255) | NOT NULL, UNIQUE | Display name of the organization |
| `slug` | VARCHAR(255) | NOT NULL, UNIQUE | URL-friendly identifier (auto-generated from name) |
| `logo_url` | TEXT | NULLABLE | Optional organization logo |
| `is_active` | BOOLEAN | DEFAULT true | Soft disable for an organization |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

### Modified Table: `users`

Add the following columns to the existing `users` table:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `organization_id` | UUID | FK → organizations(id), NULLABLE | The organization this user belongs to. NULL for Super Admins. |
| `role` | VARCHAR(50) | NOT NULL, DEFAULT 'user' | Updated enum: `super_admin`, `admin`, `approver`, `user` |

> **Index:** Add `CREATE INDEX idx_users_organization_id ON users(organization_id);` for efficient org-scoped queries.

### Potential New Table: `organization_invitations` (Optional — Phase 2)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique invitation identifier |
| `organization_id` | UUID | FK → organizations(id), NOT NULL | Target organization |
| `email` | VARCHAR(255) | NOT NULL | Invited user's email |
| `role` | VARCHAR(50) | NOT NULL, DEFAULT 'user' | Role to assign upon acceptance |
| `invited_by` | UUID | FK → users(id), NOT NULL | Admin who sent the invitation |
| `token` | VARCHAR(255) | NOT NULL, UNIQUE | Unique invitation token |
| `status` | VARCHAR(50) | DEFAULT 'pending' | `pending`, `accepted`, `expired` |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Expiration timestamp |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

---

## API Endpoints

### Organization Management (Super Admin Only)

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| `GET` | `/api/organizations` | Super Admin | List all organizations |
| `POST` | `/api/organizations` | Super Admin | Create a new organization |
| `GET` | `/api/organizations/:id` | Super Admin | Get single organization details |
| `PATCH` | `/api/organizations/:id` | Super Admin | Update organization (name, logo, active status) |
| `DELETE` | `/api/organizations/:id` | Super Admin | Delete organization and all associated data |

### Organization User Management (Org Admin or Super Admin)

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| `GET` | `/api/organizations/:orgId/users` | Org Admin | List all users in the organization |
| `POST` | `/api/organizations/:orgId/users` | Org Admin | Add/invite a user to the organization |
| `PATCH` | `/api/organizations/:orgId/users/:userId` | Org Admin | Update user role or details within the org |
| `DELETE` | `/api/organizations/:orgId/users/:userId` | Org Admin | Remove a user from the organization |

### Organization-Scoped Endpoints (All Auth Users)

All existing endpoints (`/api/workflows`, `/api/approvals`, `/api/approval-groups`, etc.) are automatically scoped to the authenticated user's `organization_id`. Users only see and interact with data within their own organization.

### Super Admin Cross-Organization Access

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| `GET` | `/api/super-admin/organizations/:orgId/workflows` | Super Admin | View any org's workflows |
| `GET` | `/api/super-admin/organizations/:orgId/approvals` | Super Admin | View any org's approvals |
| `GET` | `/api/super-admin/organizations/:orgId/users` | Super Admin | View any org's users |

> Alternatively, the Super Admin can use the standard endpoints with an `X-Organization-ID` header or query parameter to switch context between organizations.

---

## Middleware Architecture

### 1. `authMiddleware` (Existing — Updated)

- Decodes JWT, attaches `req.user` with `{ id, email, role, organization_id }`.
- No changes needed other than ensuring `organization_id` is included in the JWT payload.

### 2. `requireSuperAdmin` (New)

- Checks `req.user.role === 'super_admin'`.
- Returns 403 if not a Super Admin.
- Applied to organization CRUD endpoints.

### 3. `requireOrgAdmin` (New)

- Checks `req.user.role === 'admin'` AND `req.user.organization_id` matches the target organization (or is Super Admin).
- Returns 403 if not authorized.
- Applied to org-level user management endpoints.

### 4. `orgScopeMiddleware` (New — Critical)

- **Applied globally** to all `/api/*` routes (except `/api/auth/*` and `/api/organizations` management).
- For Super Admin: Allows optional cross-org access via `X-Organization-ID` header or query param. If not provided, no automatic scoping (sees everything).
- For all other roles: **Automatically injects** `WHERE organization_id = req.user.organization_id` into all database queries.
- If a user has no `organization_id` and is not a Super Admin, returns 403.

### 5. `requireOrgMembership` (New)

- Ensures the authenticated user's `organization_id` matches the resource being accessed.
- Used as a secondary check on routes like `/api/organizations/:orgId/*` to prevent org admins from accessing other orgs' endpoints.

---

## Database Query Scoping Strategy

All model/query functions must accept an `organizationId` parameter (or read it from context) and filter accordingly:

```
// Example: WorkflowModel.findAll(organizationId)
SELECT * FROM workflows WHERE organization_id = $1;

// Super Admin with no filter:
SELECT * FROM workflows; // sees all orgs

// Super Admin viewing a specific org:
SELECT * FROM workflows WHERE organization_id = $1;
```

Every table that holds org-specific data (`workflows`, `approval_requests`, `approval_steps`, `approval_groups`, etc.) must include an `organization_id` column with a foreign key to `organizations(id)`.

---

## Seed Data

### Super Admin (created at system init)

```
email: admin@approval.local
password: permissiongranted12345!
role: super_admin
organization_id: NULL
```

### Sample Organizations

| Name | Slug | Admin User |
|------|------|------------|
| Acme Corporation | acme-corporation | admin@acme.local |
| Globex Industries | globex-industries | admin@globex.local |

### Sample Org Users

| Email | Organization | Role |
|-------|-------------|------|
| admin@acme.local | Acme Corporation | admin |
| user1@acme.local | Acme Corporation | user |
| approver1@acme.local | Acme Corporation | approver |
| admin@globex.local | Globex Industries | admin |
| user1@globex.local | Globex Industries | user |

---

## Frontend Changes

### New Pages

| Path | Auth Required | Description |
|------|:---:|-------------|
| `/super-admin/organizations` | Super Admin | List all organizations |
| `/super-admin/organizations/new` | Super Admin | Create new organization form |
| `/super-admin/organizations/:id` | Super Admin | Organization detail + manage |
| `/super-admin/organizations/:id/users` | Super Admin | View/manage org users |
| `/admin/users` | Org Admin | Manage users within own org |
| `/admin/users/invite` | Org Admin | Invite new user to org |

### Modified Components

- **Layout / Header:** Show current organization name. Super Admin sees an organization switcher dropdown.
- **Auth Context:** Include `organization_id` and `organization_name` in the user object.
- **Protected Routes:** Update role checks — Super Admin can access everything; Org Admin can access their org's admin pages.

---

## Implementation Order

### Phase 1 — Database & Schema
1. Create `organizations` table with all columns and constraints.
2. Add `organization_id` column to `users` table with FK and index.
3. Update `role` enum/constraint on `users` to include `super_admin`.
4. Add `organization_id` column to all existing data tables (`workflows`, `approval_requests`, `approval_steps`, `approval_groups`, `approval_group_members`, etc.).
5. Create indexes on `organization_id` for all data tables.
6. Update seed script to create Super Admin, sample organizations, and sample org users.

### Phase 2 — Backend Core
7. Update JWT payload to include `organization_id` and `role` claims.
8. Create `requireSuperAdmin` middleware.
9. Create `requireOrgAdmin` middleware.
10. Create `orgScopeMiddleware` for automatic query scoping.
11. Create organization routes + controller + service (CRUD for `/api/organizations`).
12. Create organization user management routes + controller.
13. Update all existing controllers/models to filter by `organization_id`.
14. Update auth controller to handle organization context on login.
15. Add Super Admin cross-organization access endpoints.

### Phase 3 — Frontend Core
16. Update AuthContext to include organization info.
17. Add Super Admin organization management pages (list, create, detail).
18. Add Org Admin user management page.
19. Update Layout to show organization name and Super Admin switcher.
20. Update ProtectedRoute for new role hierarchy.
21. Scope all API client calls with organization context.

### Phase 4 — Test All CRUD Endpoints
22. Write and execute comprehensive curl-based test suite (see Testing section below).

---

## Testing: All CRUD API Endpoints

> **Prerequisites:**
> - Server running at `http://localhost:3001`
> - Database seeded (`npm run db:seed`)
> - `jq` installed for JSON formatting (optional but recommended)
>
> **Tokens needed:**
> - `SUPER_ADMIN_TOKEN` — JWT for the Super Admin (`admin@approval.local`)
> - `ACME_ADMIN_TOKEN` — JWT for Acme Corp admin (`admin@acme.local`)
> - `GLOBEX_ADMIN_TOKEN` — JWT for Globex admin (`admin@globex.local`)
> - `ACME_USER_TOKEN` — JWT for a regular user in Acme (`user1@acme.local`)

---

### Section A: Authentication & Login (Organization Context)

**A1. Login as Super Admin:**
```bash
export SUPER_ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@approval.local","password":"permissiongranted12345!"}' | jq -r '.token')
echo "Super Admin Token: $SUPER_ADMIN_TOKEN"
```
Expect: Token returned, user object includes `role: "super_admin"`, `organization_id: null`.

**A2. Login as Acme Org Admin:**
```bash
export ACME_ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.local","password":"testpass123"}' | jq -r '.token')
echo "Acme Admin Token: $ACME_ADMIN_TOKEN"
```
Expect: Token returned, user object includes `role: "admin"`, `organization_id` populated with Acme org ID.

**A3. Login as Acme Org User:**
```bash
export ACME_USER_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@acme.local","password":"testpass123"}' | jq -r '.token')
echo "Acme User Token: $ACME_USER_TOKEN"
```
Expect: Token returned, user object includes `role: "user"`, `organization_id` populated with Acme org ID.

**A4. Login as Globex Org Admin:**
```bash
export GLOBEX_ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@globex.local","password":"testpass123"}' | jq -r '.token')
echo "Globex Admin Token: $GLOBEX_ADMIN_TOKEN"
```
Expect: Token returned, user object includes `role: "admin"`, `organization_id` populated with Globex org ID.

---

### Section B: Organization CRUD (Super Admin Only)

**B1. List all organizations:**
```bash
curl -s http://localhost:3001/api/organizations \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect: Array of organizations (at least Acme Corporation and Globex Industries).

**B2. Create a new organization:**
```bash
export NEW_ORG=$(curl -s -X POST http://localhost:3001/api/organizations \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Initech Solutions","slug":"initech-solutions","adminEmail":"admin@initech.local","adminName":"Initech Admin","adminPassword":"testpass123"}' | jq)
export INITECH_ORG_ID=$(echo $NEW_ORG | jq -r '.organization.id')
echo "Initech Org ID: $INITECH_ORG_ID"
```
Expect: Created organization with `id`, `name: "Initech Solutions"`, and an admin user created.

**B3. Get single organization:**
```bash
curl -s http://localhost:3001/api/organizations/$INITECH_ORG_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect: Single organization object with all fields.

**B4. Get single organization with user count:**
```bash
curl -s "http://localhost:3001/api/organizations/$INITECH_ORG_ID?includeUserCount=true" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect: Organization object with `userCount` field (should be at least 1 — the admin).

**B5. Update organization:**
```bash
curl -s -X PATCH http://localhost:3001/api/organizations/$INITECH_ORG_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Initech Solutions LLC","is_active":true}' | jq
```
Expect: `name: "Initech Solutions LLC"`, `is_active: true`.

**B6. Non-Super Admin attempts to create organization (should fail):**
```bash
curl -s -X POST http://localhost:3001/api/organizations \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hackers Inc.","slug":"hackers-inc"}' | jq
```
Expect: `{"message":"Super admin access required."}` with status 403.

**B7. Non-Super Admin attempts to list all organizations (should fail or return only own org):**
```bash
curl -s http://localhost:3001/api/organizations \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" | jq
```
Expect: Either 403 or returns only the user's own organization (not all orgs).

---

### Section C: Organization User Management (Org Admin / Super Admin)

**C1. List users in an organization (as Super Admin):**
```bash
curl -s http://localhost:3001/api/organizations/$INITECH_ORG_ID/users \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect: Array of users belonging to Initech (at least the admin created at org creation).

**C2. List users in an organization (as Org Admin — own org):**
```bash
# Get Acme org ID first
export ACME_ORG_ID=$(curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" | jq -r '.user.organization_id')

curl -s http://localhost:3001/api/organizations/$ACME_ORG_ID/users \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" | jq
```
Expect: Array of Acme users.

**C3. Add a new user to organization (as Org Admin):**
```bash
curl -s -X POST http://localhost:3001/api/organizations/$ACME_ORG_ID/users \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"user2@acme.local","name":"Acme User Two","password":"testpass123","role":"user"}' | jq
```
Expect: Created user object with `organization_id` matching Acme and `role: "user"`. Save user ID as `ACME_USER2_ID`.

**C4. Update a user's role (as Org Admin):**
```bash
curl -s -X PATCH http://localhost:3001/api/organizations/$ACME_ORG_ID/users/$ACME_USER2_ID \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"approver"}' | jq
```
Expect: User object with `role: "approver"`.

**C5. Remove a user from organization (as Org Admin):**
```bash
curl -s -X DELETE http://localhost:3001/api/organizations/$ACME_ORG_ID/users/$ACME_USER2_ID \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" | jq
```
Expect: `{"message":"User removed from organization."}`.

**C6. Org Admin attempts to add user to a DIFFERENT org (should fail):**
```bash
# Acme admin tries to add a user to Globex
export GLOBEX_ORG_ID=$(curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $GLOBEX_ADMIN_TOKEN" | jq -r '.user.organization_id')

curl -s -X POST http://localhost:3001/api/organizations/$GLOBEX_ORG_ID/users \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"spy@globex.local","name":"Spy User","password":"testpass123","role":"user"}' | jq
```
Expect: `{"message":"Forbidden: Cannot manage users outside your organization."}` with status 403.

---

### Section D: Organization Data Isolation (Critical Security Tests)

These tests verify that one organization's users CANNOT see another organization's data.

**D1. Create sample data in Acme (as Acme Admin):**
```bash
# Create a workflow in Acme
export ACME_WF=$(curl -s -X POST http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Expense Report","description":"Acme internal expense workflow","slots":[]}' | jq)
export ACME_WF_ID=$(echo $ACME_WF | jq -r '.id')
echo "Acme Workflow ID: $ACME_WF_ID"
```
Expect: Workflow created with Acme's `organization_id`.

**D2. Create sample data in Globex (as Globex Admin):**
```bash
# Create a workflow in Globex
export GLOBEX_WF=$(curl -s -X POST http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $GLOBEX_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Globex Purchase Order","description":"Globex internal purchase workflow","slots":[]}' | jq)
export GLOBEX_WF_ID=$(echo $GLOBEX_WF | jq -r '.id')
echo "Globex Workflow ID: $GLOBEX_WF_ID"
```
Expect: Workflow created with Globex's `organization_id`.

**D3. Acme Admin lists workflows — should see ONLY Acme workflows:**
```bash
curl -s http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" | jq
```
Expect: Array containing "Acme Expense Report" but NOT "Globex Purchase Order".

**D4. Globex Admin lists workflows — should see ONLY Globex workflows:**
```bash
curl -s http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $GLOBEX_ADMIN_TOKEN" | jq
```
Expect: Array containing "Globex Purchase Order" but NOT "Acme Expense Report".

**D5. Acme Admin attempts to access Globex workflow directly (should fail):**
```bash
curl -s http://localhost:3001/api/workflows/$GLOBEX_WF_ID \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" | jq
```
Expect: `{"message":"Workflow not found."}` with status 404 (NOT 403 — don't leak existence of other org's data).

**D6. Acme regular user lists workflows — should see only Acme workflows (or those available to them):**
```bash
curl -s http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $ACME_USER_TOKEN" | jq
```
Expect: Array scoped to Acme workflows only.

**D7. Super Admin lists all workflows — should see workflows from ALL orgs:**
```bash
curl -s http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect: Array containing both "Acme Expense Report" AND "Globex Purchase Order".

**D8. Super Admin views a specific org's workflows:**
```bash
curl -s http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "X-Organization-ID: $GLOBEX_ORG_ID" | jq
```
Expect: Array containing only Globex workflows.

---

### Section E: Delete Organization (Super Admin Only)

**E1. Delete Initech organization (cascading):**
```bash
curl -s -X DELETE http://localhost:3001/api/organizations/$INITECH_ORG_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect: `{"message":"Organization and all associated data deleted successfully."}`.

**E2. Verify Initech no longer appears in organization list:**
```bash
curl -s http://localhost:3001/api/organizations \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq '. | map(.name)'
```
Expect: List does NOT include "Initech Solutions LLC".

**E3. Verify Initech admin can no longer log in:**
```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@initech.local","password":"testpass123"}' | jq
```
Expect: `{"message":"Invalid email or password."}` with status 401.

**E4. Non-Super Admin attempts to delete organization (should fail):**
```bash
curl -s -X DELETE http://localhost:3001/api/organizations/$ACME_ORG_ID \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" | jq
```
Expect: `{"message":"Super admin access required."}` with status 403.

---

### Section F: Edge Cases & Validation

**F1. Create organization with duplicate name (should fail):**
```bash
curl -s -X POST http://localhost:3001/api/organizations \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Corporation","slug":"acme-corp-dup"}' | jq
```
Expect: `{"message":"Organization name already exists."}` with status 409.

**F2. Create organization with duplicate slug (should fail):**
```bash
curl -s -X POST http://localhost:3001/api/organizations \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Unique Name","slug":"acme-corporation"}' | jq
```
Expect: `{"message":"Organization slug already exists."}` with status 409.

**F3. User without organization attempts to access scoped data (should fail):**
```bash
# This should not happen in normal flow, but guard against it
curl -s http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect: Super Admin sees everything (this is correct behavior).

**F4. Register a new user directly (should require organization context or default org):**
```bash
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"orphan@test.local","password":"testpass123","name":"Orphan User"}' | jq
```
Expect: Either fails with "Organization context required" OR assigns to a default organization (depending on implementation decision).

---

### Testing Checklist

- [ ] A1: Super Admin login returns correct role and null org
- [ ] A2: Org Admin login returns admin role with org ID
- [ ] A3: Org User login returns user role with org ID
- [ ] A4: Cross-org admin login scoped correctly
- [ ] B1: Super Admin can list all organizations
- [ ] B2: Super Admin can create organization with admin
- [ ] B3: Super Admin can get single organization
- [ ] B4: Organization includes user count
- [ ] B5: Super Admin can update organization
- [ ] B6: Non-Super Admin CANNOT create organization (403)
- [ ] B7: Non-Super Admin CANNOT list all organizations (403 or scoped)
- [ ] C1: Super Admin can list org users
- [ ] C2: Org Admin can list own org users
- [ ] C3: Org Admin can add user to own org
- [ ] C4: Org Admin can update user role in own org
- [ ] C5: Org Admin can remove user from own org
- [ ] C6: Org Admin CANNOT add user to different org (403)
- [ ] D1: Acme workflow created with Acme org ID
- [ ] D2: Globex workflow created with Globex org ID
- [ ] D3: Acme Admin sees ONLY Acme workflows
- [ ] D4: Globex Admin sees ONLY Globex workflows
- [ ] D5: Cross-org workflow access returns 404
- [ ] D6: Regular user scoped to own org workflows
- [ ] D7: Super Admin sees all org workflows
- [ ] D8: Super Admin can filter by org header
- [ ] E1: Super Admin can delete organization
- [ ] E2: Deleted org removed from list
- [ ] E3: Deleted org admin cannot log in
- [ ] E4: Non-Super Admin cannot delete org (403)
- [ ] F1: Duplicate org name returns 409
- [ ] F2: Duplicate org slug returns 409
- [ ] F3: Super Admin cross-org access works
- [ ] F4: Registration without org handled gracefully
- [ ] No 500 errors on any endpoint
- [ ] All data isolation tests pass — no cross-org data leakage

---

## Security Considerations

1. **Row-Level Security (RLS):** Consider enabling PostgreSQL RLS policies as an additional defense layer, so even if the application layer has a bug, the database itself enforces organization isolation.
2. **JWT Tampering:** The `organization_id` in the JWT must be set server-side at login and verified on every request. Never trust a client-provided `organization_id`.
3. **Direct Object Reference (IDOR):** Always validate that the requested resource's `organization_id` matches the authenticated user's `organization_id` before returning data.
4. **Audit Logging:** Log all cross-organization access by Super Admins for compliance and security review.
5. **Cascading Deletes:** When deleting an organization, ensure all related data is properly handled (cascade delete or soft-delete). Consider a confirmation step with organization name re-entry.

---

## Migration Notes

- Existing users without an `organization_id` should be assigned to a default "System" organization or upgraded to `super_admin` role.
- Existing workflows and approvals need to be backfilled with the appropriate `organization_id`.
- Run migration in a transaction to ensure consistency.