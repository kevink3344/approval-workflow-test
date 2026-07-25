# Workflow Approval Site — Scaffold Plan

**Date:** 2026-07-24

**Tech Stack:** Node.js / Express / React / TypeScript / PostgreSQL

**Branding:** TeamSupportPro Modern SaaS (see `modern-branding.md`)

**Reference Site:** https://teamsupportpro-development.azurewebsites.net/

---

## 1. Project Structure

```
approval-workflow-test/
├── client/                          # React + TypeScript frontend (Vite)
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── src/
│   │   ├── main.tsx                # Entry point + font imports
│   │   ├── App.tsx                 # Root component + router
│   │   ├── index.css              # CSS variables + component classes (TSPro branding)
│   │   ├── api/
│   │   │   └── client.ts          # Axios/fetch wrapper for backend API
│   │   ├── components/
│   │   │   ├── Layout.tsx         # App shell (navy header, sidebar, main content)
│   │   │   ├── ProtectedRoute.tsx # Auth guard wrapper
│   │   │   ├── StatusBadge.tsx    # Reusable badge component
│   │   │   └── LoadingSpinner.tsx # Loading state component
│   │   ├── context/
│   │   │   └── AuthContext.tsx    # Auth state management
│   │   ├── hooks/
│   │   │   ├── useAuth.ts        # Auth hook
│   │   │   └── useApi.ts         # Generic API data fetching hook
│   │   ├── pages/
│   │   │   ├── Home.tsx          # Landing page
│   │   │   ├── Login.tsx         # Login page
│   │   │   ├── Register.tsx      # Registration page
│   │   │   ├── Dashboard.tsx     # User dashboard (approval requests)
│   │   │   ├── Workflows.tsx     # Workflow management
│   │   │   ├── WorkflowDetail.tsx# Single workflow view
│   │   │   └── Settings.tsx      # User/admin settings
│   │   └── types/
│   │       └── index.ts          # Shared TypeScript interfaces
│   └── public/
│       └── favicon.ico
├── server/                          # Node + Express + TypeScript backend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts               # Server entry point
│       ├── app.ts                 # Express app setup (middleware, routes)
│       ├── config/
│       │   ├── database.ts        # DB connection (placeholder — will configure later)
│       │   └── env.ts            # Environment variable validation
│       ├── middleware/
│       │   ├── auth.ts           # JWT authentication middleware
│       │   ├── validation.ts     # Request validation middleware
│       │   └── errorHandler.ts   # Global error handler
│       ├── routes/
│       │   ├── auth.ts           # /api/auth/* (login, register, logout)
│       │   ├── users.ts          # /api/users/* (profile, settings)
│       │   ├── workflows.ts      # /api/workflows/* (CRUD)
│       │   ├── approvals.ts      # /api/approvals/* (approval actions)
│       │   └── admin.ts          # /api/admin/* (admin-only endpoints)
│       ├── controllers/
│       │   ├── authController.ts
│       │   ├── userController.ts
│       │   ├── workflowController.ts
│       │   ├── approvalController.ts
│       │   └── adminController.ts
│       ├── models/
│       │   ├── User.ts           # User model/queries
│       │   ├── Workflow.ts       # Workflow model/queries
│       │   ├── Approval.ts       # Approval request model/queries
│       │   └── Step.ts           # Approval step model/queries
│       ├── services/
│       │   ├── authService.ts    # Auth business logic (hash, JWT)
│       │   ├── workflowService.ts
│       │   └── approvalService.ts
│       └── types/
│           └── index.ts          # Shared server TypeScript interfaces
├── docs/
│   └── plans/
│       ├── modern-branding.md    # TSPro branding specification
│       └── scaffold-plan.md      # This document
├── .gitignore
├── .env.example                   # Environment variable template
└── README.md                      # Project documentation
```

---

## 2. Database Schema (Placeholder — Connection Info Pending)

### Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (id, email, password_hash, name, role, created_at) |
| `workflows` | Approval workflow definitions (id, name, description, created_by, steps_config, created_at) |
| `approval_requests` | Submitted approval requests (id, workflow_id, requester_id, status, created_at) |
| `approval_steps` | Individual steps within a request (id, request_id, approver_id, step_order, status, comment) |

### Status Values

- **Approval Request:** `pending`, `in_review`, `approved`, `rejected`, `cancelled`
- **Approval Step:** `pending`, `approved`, `rejected`, `skipped`

### User Roles

- `user` — Standard user (submit approvals, view own requests)
- `approver` — Can approve/reject requests assigned to them
- `admin` — Full system access (manage workflows, users, all requests)

---

## 3. API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/me` | Get current user profile |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/:id` | Get user profile |
| PATCH | `/api/users/:id` | Update own profile |

### Workflows
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workflows` | List workflows (admin: all, user: available) |
| POST | `/api/workflows` | Create workflow (admin) |
| GET | `/api/workflows/:id` | Get workflow details |
| PATCH | `/api/workflows/:id` | Update workflow (admin) |
| DELETE | `/api/workflows/:id` | Delete workflow (admin) |

### Approvals
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/approvals` | List approval requests (filtered by role) |
| POST | `/api/approvals` | Submit new approval request |
| GET | `/api/approvals/:id` | Get approval request details |
| PATCH | `/api/approvals/:id/step/:stepId` | Approve/reject a step |
| PATCH | `/api/approvals/:id/cancel` | Cancel an approval request |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users |
| PATCH | `/api/admin/users/:id/role` | Change user role |

---

## 4. Frontend Routes

| Path | Page | Auth Required |
|------|------|:---:|
| `/` | Home (landing) | No |
| `/login` | Login | No |
| `/register` | Register | No |
| `/dashboard` | Dashboard (my requests) | Yes |
| `/workflows` | Workflow list | Yes |
| `/workflows/:id` | Workflow detail | Yes |
| `/settings` | Settings | Yes |
| `/admin` | Admin panel | Admin |

---

## 5. Implementation Order

### Phase 1 — Scaffold & Configuration (current)
1. Initialize root project structure
2. Set up `client/` with Vite + React + TypeScript + Tailwind v3
3. Set up `server/` with Express + TypeScript
4. Create shared TypeScript types
5. Configure `.gitignore`, `.env.example`, `README.md`

### Phase 2 — Backend Core
6. Express app setup with middleware (cors, json, error handler)
7. Database connection placeholder
8. Auth routes + controller + service (JWT)
9. User routes + controller
10. Workflow routes + controller + model
11. Approval routes + controller + model
12. Admin routes

### Phase 2.5 — Test Backend Core Endpoints

Before moving on to frontend work, verify all core backend endpoints function correctly using `curl`. This catches bugs early — missing routes, auth issues, or validation problems.

> **Prerequisite:** The server must be running (`npm run dev`) and the database must be seeded (`npm run db:seed`). All commands below use `SUPER_ADMIN_TOKEN` — replace with a valid admin JWT for your environment. A non-admin user token (`NON_ADMIN_TOKEN`) is also needed for access-control checks.

**1. Register a new user:**
```bash
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"testpass123","name":"Test User"}' | jq
```
Expect `{ token, user: { id, email, name, role } }`. Save token as `USER_TOKEN`.

**2. Login with email/password:**
```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"testpass123"}' | jq
```
Expect `{ token, user }`.

**3. Get current user profile (authenticated):**
```bash
curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $USER_TOKEN" | jq
```
Expect the user object with `id`, `email`, `name`, `role`.

**4. List workflows (admin gets all, user gets active only):**
```bash
# Admin
curl -s http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
# Non-admin user
curl -s http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $USER_TOKEN" | jq
```
Both should return an array (may be empty).

**5. Create a workflow (admin only):**
```bash
curl -s -X POST http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Workflow","description":"Testing CRUD","slots":[]}' | jq
```
Expect the created workflow with `id`, `name`, `description`, `status: "active"`. Save `id` as `WF_ID`.

**6. Get single workflow:**
```bash
curl -s http://localhost:3001/api/workflows/$WF_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect the workflow with all fields populated.

**7. Update workflow:**
```bash
curl -s -X PATCH http://localhost:3001/api/workflows/$WF_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Workflow","description":"Updated desc"}' | jq
```
Expect `name: "Updated Workflow"`, `description: "Updated desc"`.

**8. Delete workflow:**
```bash
curl -s -X DELETE http://localhost:3001/api/workflows/$WF_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect `{"message":"Workflow deleted successfully."}`.

**9. Access control checks (non-admin should be rejected):**
```bash
# Non-admin creating workflow
curl -s -X POST http://localhost:3001/api/workflows \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Should Fail","description":"...","slots":[]}'
```
Expect `{"message":"Admin access required."}` with status 403.

**10. Admin list users:**
```bash
curl -s http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq
```
Expect an array of users.

**Checklist:**
- [ ] `POST /api/auth/register` creates user and returns token
- [ ] `POST /api/auth/login` authenticates and returns token
- [ ] `GET /api/auth/me` returns current user profile
- [ ] `GET /api/workflows` returns a list (empty or populated)
- [ ] `POST /api/workflows` (admin) creates workflow
- [ ] `GET /api/workflows/:id` returns single workflow
- [ ] `PATCH /api/workflows/:id` (admin) updates workflow
- [ ] `DELETE /api/workflows/:id` (admin) deletes workflow
- [ ] Non-admin workflow creation gets 403
- [ ] `GET /api/admin/users` (admin) returns user list
- [ ] No 500 errors on any endpoint

### Phase 3 — Frontend Core
13. Auth context + API client
14. Layout component with TSPro branding
15. Login / Register pages
16. Home page
17. Dashboard page
18. Workflows pages
19. Settings page
20. Protected route wrapper

### Phase 4 — Polish
21. Status badges component
22. Loading / error / empty states
23. Responsive adjustments
24. Form validation

---

## 6. Branding Implementation

The full branding specification is in `modern-branding.md`. Key decisions for scaffold:

- **Fonts:** Work Sans (400, 500, 600) + JetBrains Mono — installed via fontsource
- **Colors:** CSS custom properties on `:root` (--accent: #0078d4, --text: #10243b, --app-bg: #f4f7fb)
- **Header:** Dark navy gradient `linear-gradient(135deg, #0d2f4f 0%, #123555 50%, #0f3d63 100%)`
- **Cards:** `.surface` class — white bg, 1px `--border`, 2px radius
- **Buttons:** `.primary-button` — accent bg, white text, uppercase, letter-spaced
- **Badges:** `.badge-{color}` — color-coded status indicators
- **Login:** `.login-shell` + `.login-card` — soft blue gradient background, centered card

All component classes are defined in `client/src/index.css` per the branding guide.

---

## 7. Environment Variables (.env.example)

```env
# Server
PORT=3001
NODE_ENV=development

# Turso Database (will configure later)
TURSO_DB_URL=libsql://workflow-approval-vs-kevink3344.aws-us-east-1.turso.io
TURSO_DB_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQ5ODM4MTksImlkIjoiMDE5Zjk5NTMtMjYwMS03ZDcwLThlMjAtMDk5ZDdmMWU1YzU2Iiwia2lkIjoiWkotVUNZQTZJRk9sRFJGand5c2lxRTQ2MmotQzQ0MFNHdXp1UEdodWpNRSIsInJpZCI6ImU2YTJiZGQxLTk2Y2MtNDE0Yy1iZTk5LWU1ZmNhNWE0NTM2NyJ9.Dp6d0_AQZZQ0XFuJnTxskNtwvQ9_FZi3iz1afnuDtQIKuOH7MJc63C8iDS-xTtT9hDR5P1F67NtURGndVyZeDA

# Super Admin Login
SUPER_ADMIN_NAME=admin@approval.local
SUPER_ADMIN_PASSWORD=permissiongranted12345!

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d

# Client (Vite)
VITE_API_URL=http://localhost:3001/api
```

---

## 8. Package Dependencies

### client/
- react, react-dom, react-router-dom
- typescript, @types/react, @types/react-dom
- vite, @vitejs/plugin-react
- tailwindcss, postcss, autoprefixer
- @fontsource/work-sans, @fontsource/jetbrains-mono
- axios

### server/
- express
- typescript, ts-node, @types/express, @types/node
- cors, @types/cors
- bcryptjs, @types/bcryptjs
- jsonwebtoken, @types/jsonwebtoken
- dotenv
- pg, @types/pg (for PostgreSQL — will configure later)
- zod (validation)