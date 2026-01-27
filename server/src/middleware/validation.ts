/**
 * Input Validation and Sanitization Middleware
 *
 * Protects against:
 * - Path traversal attacks
 * - SQL injection
 * - XSS attacks
 * - Invalid inputs
 */

import { Request, Response, NextFunction } from 'express';
import path from 'path';

/**
 * Sanitize filename to prevent path traversal attacks
 *
 * Blocks:
 * - ../ and ..\\ sequences
 * - Absolute paths
 * - Special characters that could be exploited
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path components
  const basename = path.basename(filename);

  // Block suspicious patterns
  if (basename.includes('..') || basename.includes('/') || basename.includes('\\')) {
    throw new Error('Invalid filename: path traversal detected');
  }

  // Only allow alphanumeric, dots, dashes, underscores, and spaces
  if (!/^[a-zA-Z0-9._\- ]+$/.test(basename)) {
    throw new Error('Invalid filename: contains illegal characters');
  }

  return basename;
}

/**
 * Middleware to validate filename parameters
 * Use on routes with :filename parameter
 */
export function validateFilename(req: Request, res: Response, next: NextFunction) {
  try {
    const filename = req.params.filename;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Sanitize the filename
    const sanitized = sanitizeFilename(filename);

    // Replace the parameter with sanitized version
    req.params.filename = sanitized;

    next();
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid filename',
      message: error instanceof Error ? error.message : 'Filename validation failed'
    });
  }
}

/**
 * Sanitize person name to prevent XSS and SQL injection
 */
export function sanitizePersonName(name: string): string {
  // Trim whitespace
  name = name.trim();

  // Length validation
  if (name.length === 0) {
    throw new Error('Name cannot be empty');
  }

  if (name.length > 100) {
    throw new Error('Name too long (max 100 characters)');
  }

  // Only allow letters, numbers, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z0-9\s\-']+$/.test(name)) {
    throw new Error('Name contains illegal characters');
  }

  return name;
}

/**
 * Middleware to validate person name in request body
 */
export function validatePersonName(req: Request, res: Response, next: NextFunction) {
  try {
    const name = req.body.name;

    if (!name) {
      return res.status(400).json({ error: 'Person name is required' });
    }

    // Sanitize the name
    const sanitized = sanitizePersonName(name);

    // Replace with sanitized version
    req.body.name = sanitized;

    next();
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid person name',
      message: error instanceof Error ? error.message : 'Name validation failed'
    });
  }
}

/**
 * Validate numeric ID parameters
 */
export function validateNumericId(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];

    if (!id) {
      return res.status(400).json({ error: `${paramName} is required` });
    }

    const numericId = parseInt(id, 10);

    if (isNaN(numericId) || numericId < 1) {
      return res.status(400).json({ error: `Invalid ${paramName}: must be a positive number` });
    }

    // Store parsed numeric value
    (req.params as any)[paramName] = numericId;

    next();
  };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(req: Request, res: Response, next: NextFunction) {
  const page = req.query.page;
  const limit = req.query.limit;

  if (page) {
    const pageNum = parseInt(page as string, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: 'Invalid page number' });
    }
    if (pageNum > 10000) {
      return res.status(400).json({ error: 'Page number too large' });
    }
  }

  if (limit) {
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({ error: 'Invalid limit' });
    }
    if (limitNum > 1000) {
      return res.status(400).json({ error: 'Limit too large (max 1000)' });
    }
  }

  next();
}

/**
 * Validate memory type parameter
 */
export function validateMemoryType(req: Request, res: Response, next: NextFunction) {
  const type = req.params.type;
  const validTypes = ['on_this_day', 'weekly', 'monthly', 'seasonal', 'people'];

  if (!type) {
    return res.status(400).json({ error: 'Memory type is required' });
  }

  if (!validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Invalid memory type',
      validTypes
    });
  }

  next();
}
