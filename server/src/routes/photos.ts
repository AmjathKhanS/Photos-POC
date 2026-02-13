import { Router } from 'express';
import { getPhotoList, getThumbnail, getFullImage, invalidatePhotoListCache } from '../services/photoService.js';
import { validateFilename, validatePagination } from '../middleware/validation.js';
import { getPreloadProgress } from '../services/thumbnailPreloader.js';

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

    // Optimize response
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

    // Generate ETag for efficient caching
    const THUMBNAIL_VERSION = 'v4'; // v4 = 600px, 90% quality
    const etag = `"${Buffer.from(filename + THUMBNAIL_VERSION).toString('base64')}"`;

    // Check if client has cached version
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    const { buffer, contentType } = await getThumbnail(filename);

    // Aggressive caching for performance
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
    res.set('ETag', etag);
    res.set('Connection', 'keep-alive');
    res.set('Keep-Alive', 'timeout=30, max=1000');
    res.set('X-Content-Type-Options', 'nosniff');

    res.send(buffer);
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

// GET /api/photos/full/:filename - Get full-size image
router.get('/full/:filename', validateFilename, async (req, res) => {
  try {
    const { filename } = req.params;
    const { buffer, contentType } = await getFullImage(filename);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    console.error('Error fetching full image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// GET /api/photos/preload-progress - Get thumbnail preload progress
router.get('/preload-progress', (req, res) => {
  const progress = getPreloadProgress();
  res.json(progress);
});

// POST /api/photos/refresh - Manually refresh photo list
router.post('/refresh', async (req, res) => {
  try {
    invalidatePhotoListCache();
    const photos = await getPhotoList();
    res.json({
      success: true,
      message: 'Photo list refreshed',
      total: photos.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing photo list:', error);
    res.status(500).json({ error: 'Failed to refresh photo list' });
  }
});

// GET /api/photos/thumbnail-info/:filename - Get thumbnail info for debugging
router.get('/thumbnail-info/:filename', validateFilename, async (req, res) => {
  try {
    const { filename } = req.params;
    const { buffer, contentType } = await getThumbnail(filename);

    // Use sharp to get actual dimensions
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(buffer).metadata();

    res.json({
      filename,
      contentType,
      sizeKB: (buffer.length / 1024).toFixed(2),
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha
    });
  } catch (error) {
    console.error('Error getting thumbnail info:', error);
    res.status(500).json({ error: 'Failed to get thumbnail info' });
  }
});

export default router;
