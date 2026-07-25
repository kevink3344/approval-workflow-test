import { Router } from 'express';
import multer from 'multer';
import * as uploadController from '../controllers/uploadController';
import { requireAuth } from '../middleware/auth';

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
const router = Router();

// Use memory storage to get the file as a Buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// POST /api/uploads — upload a file (pre-upload before submitting request)
router.post('/', requireAuth, upload.single('file'), uploadController.upload);

// GET /api/uploads/:fieldId — download a file
router.get('/:fieldId', requireAuth, uploadController.download);

export default router;