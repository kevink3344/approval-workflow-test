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
  },
  // Path to the API routes and their JSDoc annotations
  apis: ['./src/routes/*.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);