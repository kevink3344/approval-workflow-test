import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Validation/user errors: return 400 with the message directly
  if (
    err.message.includes(' is required') ||
    err.message.includes('Invalid') ||
    err.message.includes('not a valid') ||
    err.message.includes('must be') ||
    err.message.includes('does not belong') ||
    err.message.includes('Cannot submit') ||
    err.message.includes('Options are required') ||
    err.message.includes('options must') ||
    err.message.includes('options are required') ||
    err.message.includes('sortOrder must') ||
    err.message.includes('duplicate sortOrder') ||
    err.message.includes('Column ') ||
    err.message.includes('label is required') ||
    err.message.includes('invalid columnType')
  ) {
    res.status(400).json({ message: err.message });
    return;
  }

  // Auth/authorization errors
  if (
    err.message.includes('Unauthorized') ||
    err.message.includes('not authorized') ||
    err.message.includes('Access denied') ||
    err.message.includes('Only the requester') ||
    err.message.includes('admin access')
  ) {
    res.status(403).json({ message: err.message });
    return;
  }

  // Not found errors
  if (
    err.message.includes('not found') ||
    err.message.includes('Not found')
  ) {
    res.status(404).json({ message: err.message });
    return;
  }

  // Conflict errors
  if (
    err.message.includes('already') ||
    err.message.includes('has already been')
  ) {
    res.status(409).json({ message: err.message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    message: 'An internal server error occurred.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
