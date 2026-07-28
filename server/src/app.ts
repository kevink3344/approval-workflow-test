import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import workflowRoutes from './routes/workflows';
import approvalRoutes from './routes/approvals';
import approvalGroupRoutes from './routes/approvalGroups';
import uploadRoutes from './routes/uploads';
import adminRoutes from './routes/admin';
import categoryRoutes from './routes/categories';
import settingsRoutes from './routes/settings';
import infoRoutes from './routes/info';
import organizationRoutes from './routes/organizations';
import { errorHandler } from './middleware/errorHandler';
import { orgScope } from './middleware/auth';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Organization-scoped routes (middleware enforces data isolation)
app.use('/api/workflows', orgScope, workflowRoutes);
app.use('/api/approvals', orgScope, approvalRoutes);
app.use('/api/approval-groups', orgScope, approvalGroupRoutes);
app.use('/api/uploads', orgScope, uploadRoutes);
app.use('/api/admin', orgScope, adminRoutes);
app.use('/api/categories', orgScope, categoryRoutes);
app.use('/api/settings', orgScope, settingsRoutes);
app.use('/api/info', infoRoutes);

// Organization management routes
app.use('/api/organizations', organizationRoutes);

// ── Swagger UI ──────────────────────────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve as any,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Approval Workflow API Docs',
    explorer: true,
  }) as any,
);

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
// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use(errorHandler);

export default app;