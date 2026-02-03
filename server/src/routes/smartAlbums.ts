/**
 * Smart Albums API Routes
 * Endpoints for AI-generated photo albums
 */

import express from 'express';
import * as smartAlbumsService from '../services/smartAlbumsService.js';
import * as photoService from '../services/photoService.js';

const router = express.Router();

/**
 * GET /api/smart-albums
 * Get all smart albums
 */
router.get('/', (req, res) => {
  try {
    const albums = smartAlbumsService.getAllAlbums();

    res.json({
      success: true,
      albums,
      count: albums.length,
    });
  } catch (error) {
    console.error('Get albums error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/smart-albums/stats
 * Get smart albums statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = smartAlbumsService.getAlbumStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/smart-albums/:id
 * Get album with photos
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const albumId = parseInt(id);

    if (isNaN(albumId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid album ID',
      });
      return;
    }

    const album = smartAlbumsService.getAlbumWithPhotos(albumId);

    if (!album) {
      res.status(404).json({
        success: false,
        error: 'Album not found',
      });
      return;
    }

    // Enhance photos with full metadata
    const allPhotos = await photoService.getPhotoList();
    const photoMap = new Map(allPhotos.map((p: any) => [p.filename, p]));

    const enhancedPhotos = album.photos
      .map(ap => {
        const photo = photoMap.get(ap.photo_filename);
        return photo ? {
          ...photo,
          similarity_score: ap.similarity_score,
          is_cover: ap.is_cover,
        } : null;
      })
      .filter(p => p !== null);

    res.json({
      success: true,
      album: {
        ...album,
        photos: enhancedPhotos,
      },
    });
  } catch (error) {
    console.error('Get album error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/smart-albums/generate
 * Generate smart albums using two-stage AI clustering
 */
router.post('/generate', async (req, res) => {
  try {
    const {
      epsVisual = 0.25,
      minSamples = 2,
      maxWindowDays = 7,
      maxGapDays = 2,
      replaceExisting = true
    } = req.body as {
      epsVisual?: number;
      minSamples?: number;
      maxWindowDays?: number;
      maxGapDays?: number;
      replaceExisting?: boolean;
    };

    console.log(`📸 Generating smart albums (two-stage clustering)...`);
    console.log(`   epsVisual=${epsVisual}, minSamples=${minSamples}, maxWindow=${maxWindowDays}d, maxGap=${maxGapDays}d`);

    const result = await smartAlbumsService.generateSmartAlbums(
      epsVisual,
      minSamples,
      maxWindowDays,
      maxGapDays,
      replaceExisting
    );

    if (result.success) {
      res.json({
        success: true,
        message: `Generated ${result.albums_created} smart albums`,
        albums_created: result.albums_created,
        photos_organized: result.photos_organized,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate albums',
      });
    }
  } catch (error) {
    console.error('Generate albums error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * PUT /api/smart-albums/:id
 * Update album metadata
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const albumId = parseInt(id);

    if (isNaN(albumId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid album ID',
      });
      return;
    }

    const { title, description } = req.body as {
      title?: string;
      description?: string;
    };

    smartAlbumsService.updateAlbum(albumId, { title, description });

    res.json({
      success: true,
      message: 'Album updated successfully',
    });
  } catch (error) {
    console.error('Update album error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * DELETE /api/smart-albums/:id
 * Delete an album
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const albumId = parseInt(id);

    if (isNaN(albumId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid album ID',
      });
      return;
    }

    smartAlbumsService.deleteAlbum(albumId);

    res.json({
      success: true,
      message: `Album ${albumId} deleted successfully`,
    });
  } catch (error) {
    console.error('Delete album error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
