/**
 * Cloud-Ready Photo Routes
 *
 * Handles both local and cloud storage modes:
 * - LOCAL: Returns image buffers
 * - CLOUD: Redirects to Cloudinary URLs
 */

import { Router } from 'express';
import { getThumbnail, getFullImage, getPhotoList } from '../services/photoServiceCloud.js';
import { validateFilename, validatePagination } from '../middleware/validation.js';

const router = Router();

// GET /api/photos - List all photos (with pagination)
router.get('/', validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const allPhotos = await getPhotoList();
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const photos = allPhotos.slice(startIndex, endIndex);

    res.set('Cache-Control', 'private, max-age=60');
    res.json({
      photos,
      total: allPhotos.length,
      page,
      totalPages: Math.ceil(allPhotos.length / limit),
      hasMore: endIndex < allPhotos.length
    });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// GET /api/photos/thumbnail/:filename - Get thumbnail
router.get('/thumbnail/:filename', validateFilename, async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await getThumbnail(filename);

    // CLOUD MODE: Redirect to Cloudinary
    if ('url' in result) {
      // Redirect to Cloudinary URL (301 permanent redirect for caching)
      res.redirect(301, result.url);
      return;
    }

    // LOCAL MODE: Return buffer
    const THUMBNAIL_VERSION = 'v4';
    const etag = `"${Buffer.from(filename + THUMBNAIL_VERSION).toString('base64')}"`;

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.set('Content-Type', result.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('ETag', etag);
    res.set('Connection', 'keep-alive');
    res.set('Keep-Alive', 'timeout=30, max=1000');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(result.buffer);
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

// GET /api/photos/full/:filename - Get full-size image
router.get('/full/:filename', validateFilename, async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await getFullImage(filename);

    // CLOUD MODE: Redirect to Cloudinary
    if ('url' in result) {
      res.redirect(301, result.url);
      return;
    }

    // LOCAL MODE: Return buffer
    res.set('Content-Type', result.contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(result.buffer);
  } catch (error) {
    console.error('Error fetching full image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

export default router;
