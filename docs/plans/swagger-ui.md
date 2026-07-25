# Swagger UI Integration Plan

## Overview

Add full Swagger UI documentation to any Express + TypeScript backend using `swagger-jsdoc` and `swagger-ui-express`. The documentation is generated from JSDoc annotations in route files, covers every API endpoint (all CRUD operations for all database entities), and adapts its `servers` list based on the environment so it works both locally (`http://localhost:3001/api-docs`) and after Azure deployment (`https://website.azurewebsites.net/api-docs`).

---

## 1. Dependencies

Add these packages to `server/package.json`:

```bash
npm install swagger-jsdoc swagger-ui-express
npm install -D @types/swagger-jsdoc @types/swagger-ui-express
```

- **swagger-jsdoc** – reads JSDoc-annotated route files and produces an OpenAPI 3.0 spec.
- **swagger-ui-express** – serves the Swagger UI HTML page from the generated spec.

---

## 2. Swagger Configuration File

Create `server/src/config/swagger.ts`:

```typescript
import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const isProduction = env.NODE_ENV === 'production';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Approval Workflow API',
      version: '1.0.0',
      description:
        'REST API for the approval workflow system. Supports user management, ' +
        'workflow definitions, approval requests, file uploads, and more.',
    },
    servers: [
      {
        url: isProduction
          ? 'https://website.azurewebsites.net'
          : 'http://localhost:3001',
        description: isProduction ? 'Production (Azure)' : 'Local development',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT token obtained from POST /api/auth/login or POST /api/auth/login-with-password.',
        },
      },
    },
  },
  // Path to the API routes and their JSDoc annotations
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
```

**Key details:**
- The `servers` array uses `env.NODE_ENV` to swap between local and Azure URLs.
- `apis` glob points to all route files so every endpoint is scanned for JSDoc.
- A `bearerAuth` security scheme is defined so endpoints that require auth can reference it.

---

## 3. Mount Swagger UI in Express

Add the following to `server/src/app.ts` **after the existing route mounts** and **before the global error handler**:

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// ── Swagger UI ──────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Approval Workflow API Docs',
  explorer: true,
}));
```

**Why after the route mounts?** The Swagger UI middleware serves its own Express sub-app at `/api-docs`. Placing it after the app routes ensures normal API calls take priority and don't accidentally match the Swagger path.

---

## 4. JSDoc Annotations by Route File

Every route file must document its endpoints with OpenAPI-compliant JSDoc comments. Below are the **complete annotations** for every existing route file.

### 4.1 `routes/info.ts`

```typescript
/**
 * @openapi
 * /api/info:
 *   get:
 *     tags: [Info]
 *     summary: Get application info
 *     description: Returns the API version and login mode override.
 *     security: []
 *     responses:
 *       200:
 *         description: Application information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 loginModeOverride:
 *                   type: string
 *                   nullable: true
 *                   example: "select"
 */
```

### 4.2 `routes/auth.ts`

```typescript
/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login (select-user mode)
 *     description: No password required — select a user by email.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid email
 *
 * /api/auth/login-with-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Login with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid credentials
 *
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout
 *     security: []
 *     responses:
 *       200:
 *         description: Logout successful
 *
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Not authenticated
 *
 * /api/auth/users:
 *   get:
 *     tags: [Authentication]
 *     summary: List users for select-user dropdown
 *     description: Public endpoint that returns a lightweight list of users.
 *     security: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 */
```

### 4.3 `routes/users.ts`

```typescript
/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users (admin only)
 *     description: Used for user pickers in the UI.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden (requires admin role)
 *
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *
 *   patch:
 *     tags: [Users]
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *
 * /api/users/{id}/password:
 *   patch:
 *     tags: [Users]
 *     summary: Change user password
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: Validation error or incorrect current password
 *       404:
 *         description: User not found
 */
```

### 4.4 `routes/admin.ts`

```typescript
/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users with roles
 *       403:
 *         description: Forbidden (requires admin role)
 *
 * /api/admin/users/{id}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Update user role (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, approver, admin]
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Invalid role
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
```

### 4.5 `routes/approvalGroups.ts`

```typescript
/**
 * @openapi
 * /api/approval-groups:
 *   get:
 *     tags: [Approval Groups]
 *     summary: List all approval groups (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of approval groups
 *       403:
 *         description: Forbidden (requires admin role)
 *
 *   post:
 *     tags: [Approval Groups]
 *     summary: Create an approval group (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateApprovalGroup'
 *     responses:
 *       201:
 *         description: Approval group created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden (requires admin role)
 *
 * /api/approval-groups/{id}:
 *   get:
 *     tags: [Approval Groups]
 *     summary: Get approval group by ID (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Approval group details
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Group not found
 *
 *   patch:
 *     tags: [Approval Groups]
 *     summary: Update an approval group (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateApprovalGroup'
 *     responses:
 *       200:
 *         description: Approval group updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Group not found
 *
 *   delete:
 *     tags: [Approval Groups]
 *     summary: Delete an approval group (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Approval group deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Group not found
 */
```

### 4.6 `routes/workflows.ts`

```typescript
/**
 * @openapi
 * /api/workflows:
 *   get:
 *     tags: [Workflows]
 *     summary: List all workflows
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workflows with slots and columns
 *       401:
 *         description: Not authenticated
 *
 *   post:
 *     tags: [Workflows]
 *     summary: Create a workflow (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWorkflow'
 *     responses:
 *       201:
 *         description: Workflow created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden (requires admin role)
 *
 * /api/workflows/{id}:
 *   get:
 *     tags: [Workflows]
 *     summary: Get workflow by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Workflow details
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Workflow not found
 *
 *   patch:
 *     tags: [Workflows]
 *     summary: Update a workflow (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateWorkflow'
 *     responses:
 *       200:
 *         description: Workflow updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Workflow not found
 *
 *   delete:
 *     tags: [Workflows]
 *     summary: Delete a workflow (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Workflow deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Workflow not found
 */
```

### 4.7 `routes/approvals.ts`

```typescript
/**
 * @openapi
 * /api/approvals:
 *   get:
 *     tags: [Approvals]
 *     summary: List approval requests
 *     description: Returns approval requests for the current user. Admins see all requests.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of approval requests
 *       401:
 *         description: Not authenticated
 *
 *   post:
 *     tags: [Approvals]
 *     summary: Submit a new approval request
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitApproval'
 *     responses:
 *       201:
 *         description: Approval request submitted
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *
 * /api/approvals/{id}:
 *   get:
 *     tags: [Approvals]
 *     summary: Get approval request by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Approval request details with fields and steps
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Approval not found
 *
 * /api/approvals/{id}/step/{stepId}:
 *   patch:
 *     tags: [Approvals]
 *     summary: Act on an approval step (approve / reject)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: stepId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StepAction'
 *     responses:
 *       200:
 *         description: Step action recorded
 *       400:
 *         description: Invalid action
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Approval or step not found
 *
 * /api/approvals/{id}/cancel:
 *   patch:
 *     tags: [Approvals]
 *     summary: Cancel an approval request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Approval request cancelled
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Approval not found
 */
```

### 4.8 `routes/uploads.ts`

```typescript
/**
 * @openapi
 * /api/uploads:
 *   post:
 *     tags: [Uploads]
 *     summary: Upload a file
 *     description: Upload a file as multipart/form-data. Returns a field ID that can be linked to an approval request field.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (max 10 MB)
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fieldId:
 *                   type: string
 *                 fileName:
 *                   type: string
 *       400:
 *         description: No file provided or file too large
 *       401:
 *         description: Not authenticated
 *
 * /api/uploads/{fieldId}:
 *   get:
 *     tags: [Uploads]
 *     summary: Download a file
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fieldId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File stream
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: File not found
 */
```

### 4.9 `routes/uploads.ts`

```typescript
/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     description: Public endpoint that returns the server status and current timestamp.
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
```

> **Note:** The health endpoint lives inline in `app.ts` (not in a routes file), so `swagger.ts` must include `'./src/app.ts'` in its `apis` glob to pick it up.

### 4.10 `routes/settings.ts`

```typescript
/**
 * @openapi
 * /api/settings/{key}:
 *   get:
 *     tags: [Settings]
 *     summary: Get a setting by key (public)
 *     description: Public endpoint — no auth required. Used for reading login mode, etc.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         example: loginMode
 *     responses:
 *       200:
 *         description: Setting value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                 value:
 *                   type: string
 *                   nullable: true
 *       404:
 *         description: Setting not found
 *
 *   put:
 *     tags: [Settings]
 *     summary: Update a setting (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Setting updated
 *       403:
 *         description: Forbidden (requires admin role)
 *       404:
 *         description: Setting not found
 */
```

---

## 5. Component Schemas

Add a `components/schemas` section to the Swagger definition in `config/swagger.ts` so that `$ref` references in the route annotations resolve correctly. All request/response shapes from the TypeScript types are captured below.

```typescript
// Inside the `definition` object, add:
components: {
  schemas: {
    // ── Users ───────────────────────────────────────────────
    User: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        role: { type: 'string', enum: ['user', 'approver', 'admin'] },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    // ── Approval Groups ─────────────────────────────────────
    CreateApprovalGroup: {
      type: 'object',
      required: ['name', 'description', 'memberIds'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        memberIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of user IDs to add as members',
        },
      },
    },
    UpdateApprovalGroup: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        memberIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replaces all members with the given IDs',
        },
      },
    },
    ApprovalGroup: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        createdBy: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        members: {
          type: 'array',
          items: { $ref: '#/components/schemas/User' },
        },
      },
    },
    // ── Workflows ───────────────────────────────────────────
    WorkflowColumn: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        workflowId: { type: 'string' },
        label: { type: 'string' },
        columnType: {
          type: 'string',
          enum: ['text', 'long_text', 'single_choice', 'multiple_choice', 'date', 'file'],
        },
        isRequired: { type: 'boolean' },
        sortOrder: { type: 'integer' },
        options: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
      },
    },
    WorkflowApprovalSlot: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        workflowId: { type: 'string' },
        groupId: { type: 'string' },
        slotOrder: { type: 'integer' },
        resolutionMode: {
          type: 'string',
          enum: ['first', 'all'],
        },
        group: { $ref: '#/components/schemas/ApprovalGroup' },
      },
    },
    CreateWorkflow: {
      type: 'object',
      required: ['name', 'columns', 'approvalSlots'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        columns: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label', 'columnType'],
            properties: {
              label: { type: 'string' },
              columnType: {
                type: 'string',
                enum: ['text', 'long_text', 'single_choice', 'multiple_choice', 'date', 'file'],
              },
              isRequired: { type: 'boolean', default: false },
              sortOrder: { type: 'integer' },
              options: {
                type: 'array',
                items: { type: 'string' },
                description: 'Required for single_choice / multiple_choice',
              },
            },
          },
        },
        approvalSlots: {
          type: 'array',
          items: {
            type: 'object',
            required: ['groupId', 'slotOrder', 'resolutionMode'],
            properties: {
              groupId: { type: 'string' },
              slotOrder: { type: 'integer' },
              resolutionMode: {
                type: 'string',
                enum: ['first', 'all'],
              },
            },
          },
        },
      },
    },
    UpdateWorkflow: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['active', 'archived'] },
        columns: {
          type: 'array',
          items: { $ref: '#/components/schemas/WorkflowColumn' },
        },
        approvalSlots: {
          type: 'array',
          items: { $ref: '#/components/schemas/WorkflowApprovalSlot' },
        },
      },
    },
    Workflow: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        createdBy: { type: 'string' },
        status: { type: 'string', enum: ['active', 'archived'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        columns: {
          type: 'array',
          items: { $ref: '#/components/schemas/WorkflowColumn' },
        },
        approvalSlots: {
          type: 'array',
          items: { $ref: '#/components/schemas/WorkflowApprovalSlot' },
        },
      },
    },
    // ── Approval Requests ───────────────────────────────────
    SubmitApproval: {
      type: 'object',
      required: ['workflowId', 'fields'],
      properties: {
        workflowId: { type: 'string' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            required: ['columnId'],
            properties: {
              columnId: { type: 'string' },
              value: { type: 'string' },
              fileFieldId: {
                type: 'string',
                description: 'ID returned from file upload, for file-type columns',
              },
            },
          },
        },
      },
    },
    StepAction: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['approved', 'rejected'] },
        comment: { type: 'string' },
      },
    },
    ApprovalRequest: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        workflowId: { type: 'string' },
        requesterId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['pending', 'in_review', 'approved', 'rejected', 'cancelled'],
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        fields: {
          type: 'array',
          items: { $ref: '#/components/schemas/ApprovalRequestField' },
        },
      },
    },
    ApprovalRequestField: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        requestId: { type: 'string' },
        columnId: { type: 'string' },
        value: { type: 'string', nullable: true },
        label: { type: 'string' },
        columnType: {
          type: 'string',
          enum: ['text', 'long_text', 'single_choice', 'multiple_choice', 'date', 'file'],
        },
      },
    },
  },
},
```

---

## 6. Azure Deployment Considerations

### 6.1 Environment Variable (`NODE_ENV`)

- **Locally**: `NODE_ENV` is `development` (or omitted, defaults to `'development'` in `env.ts`). Swagger uses `http://localhost:3001`.
- **Azure**: Set `NODE_ENV=production` in Azure App Settings so that Swagger uses `https://website.azurewebsites.net`.

### 6.2 CORS

The existing `cors()` middleware in `app.ts` already allows all origins, which covers Swagger UI's ability to call the API from its own page. For production, tighten CORS if needed:

```typescript
app.use(cors({ origin: 'https://website.azurewebsites.net' }));
```

### 6.3 Swagger UI Middleware Order

The Swagger UI middleware must be mounted **before** the global error handler but **after** route definitions. This is already the recommended placement from Section 3.

---

## 7. Verification Checklist

- [ ] Run `npm install swagger-jsdoc swagger-ui-express` and dev types
- [ ] Create `server/src/config/swagger.ts` as shown
- [ ] Add JSDoc annotations to every route file
- [ ] Add component schemas to the Swagger definition
- [ ] Mount `swaggerUi` middleware after routes in `app.ts`
- [ ] Start dev server (`npm run dev`) and visit `http://localhost:3001/api-docs`
- [ ] Confirm all endpoints appear, grouped by tag
- [ ] Test the "Authorize" button with a valid JWT token
- [ ] Execute a GET request from Swagger UI to verify auth flow
- [ ] For each CRUD entity, verify at least one POST/PATCH body example
- [ ] Deploy to Azure, set `NODE_ENV=production`, confirm `https://website.azurewebsites.net/api-docs` loads
- [ ] Verify the Azure Swagger UI uses the production server URL

---

## 8. Summary

| Item                        | Location / Details                                                |
|-----------------------------|-------------------------------------------------------------------|
| Packages                     | `swagger-jsdoc`, `swagger-ui-express`                             |
| Config file                  | `server/src/config/swagger.ts`                                    |
| JSDoc annotations            | In each `routes/*.ts` file + `app.ts` (for health endpoint)      |
| Swagger UI mount             | `app.use('/api-docs', swaggerUi.serve as any, swaggerUi.setup(...))` |
| Local URL                   | `http://localhost:3001/api-docs`                                  |
| Azure URL                   | `https://website.azurewebsites.net/api-docs`                      |
| NODE_ENV in Azure            | Set to `production` in App Settings                               |

This plan is reusable for **any Express + TypeScript project** — just adjust the route file glob in `swagger.ts`, annotate endpoints, and add component schemas matching your models.