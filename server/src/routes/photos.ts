import { Router } from 'express';
import { getPhotoList, getThumbnail, getFullImage } from '../services/photoService.js';
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
    const { buffer, contentType } = await getThumbnail(filename);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
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

export default router;
