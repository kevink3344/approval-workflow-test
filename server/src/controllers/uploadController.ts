import { Request, Response, NextFunction } from 'express';
import client from '../config/database';

const TEMP_REQUEST_ID = '00000000000000000000000000000000'; // 32-char placeholder

// Maximum file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
];

export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file provided.' });
      return;
    }

    if (req.file.size > MAX_FILE_SIZE) {
      res.status(400).json({ message: 'File size exceeds 10 MB limit.' });
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      res.status(400).json({ message: `File type "${req.file.mimetype}" is not allowed.` });
      return;
    }

    const fileData = req.file.buffer;
    const filename = req.file.originalname;
    const mimeType = req.file.mimetype;

    // Insert a temporary row with placeholder request_id
    const result = await client.execute({
      sql: `INSERT INTO approval_request_fields (request_id, column_id, value, file_data, file_mime_type)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id`,
      args: [
        TEMP_REQUEST_ID,
        '00000000000000000000000000000000', // placeholder column_id
        filename,
        fileData,
        mimeType,
      ],
    });

    const row = result.rows[0] as Record<string, unknown>;
    const fieldId = row.id as string;

    res.status(201).json({
      fieldId,
      filename,
      mimeType,
    });
  } catch (err) {
    next(err);
  }
}

export async function download(req: Request, res: Response, next: NextFunction) {
  try {
    const { fieldId } = req.params;

    const result = await client.execute({
      sql: `SELECT arf.*, ar.requester_id, ar.workflow_id
            FROM approval_request_fields arf
            JOIN approval_requests ar ON ar.id = arf.request_id
            WHERE arf.id = ?`,
      args: [fieldId],
    });

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'File not found.' });
      return;
    }

    const row = result.rows[0] as Record<string, unknown>;

    // Check access: admin, requester, or approver can download
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole !== 'admin') {
      const requesterId = row.requester_id as string;
      const requestId = row.request_id as string;

      // Check if user is requester or an approver on this request
      if (requesterId !== userId) {
        const stepCheck = await client.execute({
          sql: 'SELECT id FROM approval_steps WHERE request_id = ? AND approver_id = ? LIMIT 1',
          args: [requestId, userId],
        });
        if (stepCheck.rows.length === 0) {
          res.status(403).json({ message: 'Access denied.' });
          return;
        }
      }
    }

    const fileData = row.file_data as Buffer | null;
    const mimeType = row.file_mime_type as string;
    const filename = row.value as string;

    if (!fileData) {
      res.status(404).json({ message: 'File data is empty.' });
      return;
    }

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileData.length);
    res.send(fileData);
  } catch (err) {
    next(err);
  }
}