/**
 * Semantic Search API Routes
 * Endpoints for AI-powered photo search
 */

import express from 'express';
import * as semanticSearchService from '../services/semanticSearchService.js';
import * as photoService from '../services/photoService.js';
import * as autoIndexService from '../services/autoIndexService.js';

const router = express.Router();

/**
 * POST /api/semantic-search/index/:filename
 * Index a single photo
 */
router.post('/index/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await semanticSearchService.indexPhoto(filename);

    if (result.success) {
      res.json({
        success: true,
        photoFilename: filename,
        ocrText: result.ocr_text || '',
        visualTags: result.visual_tags || [],
        processingTimeMs: result.processing_time_ms || 0,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to index photo',
      });
    }
  } catch (error) {
    console.error('Index photo error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/semantic-search/batch-index
 * Index multiple photos in batch
 */
router.post('/batch-index', async (req, res) => {
  try {
    const { photoFilenames, limit } = req.body as {
      photoFilenames?: string[];
      limit?: number;
    };

    let filenames: string[];

    if (photoFilenames && Array.isArray(photoFilenames)) {
      filenames = photoFilenames;
    } else {
      // Get all photos and filter unprocessed ones
      const allPhotos = await photoService.getPhotoList();
      const stats = semanticSearchService.getProcessingStats();

      // If no photos are processed yet, start with first N
      if (stats.processed === 0) {
        filenames = allPhotos.slice(0, limit || 10).map((p: any) => p.filename);
      } else {
        // Get unprocessed photos
        // For now, just take first N photos (can be improved with proper status tracking)
        filenames = allPhotos.slice(0, limit || 10).map((p: any) => p.filename);
      }
    }

    if (filenames.length === 0) {
      res.json({
        success: true,
        processed: 0,
        failed: 0,
        message: 'No photos to index',
      });
      return;
    }

    // Start batch indexing (this will take time)
    const startTime = Date.now();
    const result = await semanticSearchService.indexPhotos(
      filenames,
      (processed, total) => {
        console.log(`Indexing progress: ${processed}/${total}`);
      }
    );

    res.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      totalTimeMs: Date.now() - startTime,
      avgTimePerPhotoMs: Math.round((Date.now() - startTime) / filenames.length),
    });
  } catch (error) {
    console.error('Batch index error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/semantic-search/search?query={query}&limit={limit}
 * Search photos using natural language
 */
router.get('/search', async (req, res) => {
  try {
    const { query, limit = '50', threshold = '0.50' } = req.query as {
      query?: string;
      limit?: string;
      threshold?: string;
    };

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Query parameter is required',
      });
      return;
    }

    const startTime = Date.now();
    const results = await semanticSearchService.searchPhotos(
      query,
      parseInt(limit),
      parseFloat(threshold)
    );

    // Enhance results with photo data
    const photos = await photoService.getPhotoList();
    const photoMap = new Map(photos.map((p: any) => [p.filename, p]));

    const enhancedResults = results.map(result => {
      const photo = photoMap.get(result.photo_filename);
      return {
        photo: photo || null,
        score: result.score,
        matchType: result.match_type,
        ocrText: result.ocr_text,
        matchedTags: result.matched_tags,
      };
    }).filter(r => r.photo !== null); // Only include photos that still exist

    res.json({
      success: true,
      query,
      results: enhancedResults,
      count: enhancedResults.length,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/semantic-search/stats
 * Get indexing and search statistics
 */
router.get('/stats', (req, res) => {
  try {
    const processingStats = semanticSearchService.getProcessingStats();
    const semanticStats = semanticSearchService.getSemanticStats();

    res.json({
      success: true,
      processing: processingStats,
      semantic: semanticStats,
      progress: processingStats.total > 0
        ? Math.round((processingStats.processed / processingStats.total) * 100)
        : 0,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/semantic-search/test
 * Test if Python AI service is working
 */
router.post('/test', async (req, res) => {
  try {
    const result = await semanticSearchService.testPythonService();

    if (result.success) {
      res.json({
        success: true,
        message: 'All AI models are working correctly',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Some AI models failed to load',
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * DELETE /api/semantic-search/:filename
 * Clear semantic data for a photo
 */
router.delete('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    semanticSearchService.clearPhotoSemanticData(filename);

    res.json({
      success: true,
      message: `Semantic data cleared for ${filename}`,
    });
  } catch (error) {
    console.error('Clear data error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/semantic-search/auto-index/start
 * Start auto-indexing all photos
 */
router.post('/auto-index/start', async (req, res) => {
  try {
    const { batchSize, delayBetweenBatches } = req.body as {
      batchSize?: number;
      delayBetweenBatches?: number;
    };

    // Check if already running
    const status = autoIndexService.getAutoIndexStatus();
    if (status?.isRunning) {
      res.status(409).json({
        success: false,
        message: 'Auto-indexing already in progress',
        status,
      });
      return;
    }

    // Start in background (don't await)
    autoIndexService.startAutoIndexing({
      batchSize: batchSize || 10,
      delayBetweenBatches: delayBetweenBatches || 3000,
    });

    res.json({
      success: true,
      message: 'Auto-indexing started in background',
    });
  } catch (error) {
    console.error('Auto-index start error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/semantic-search/auto-index/stop
 * Stop auto-indexing
 */
router.post('/auto-index/stop', (req, res) => {
  try {
    autoIndexService.stopAutoIndexing();

    res.json({
      success: true,
      message: 'Auto-indexing stop signal sent',
    });
  } catch (error) {
    console.error('Auto-index stop error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/semantic-search/auto-index/status
 * Get auto-indexing progress
 */
router.get('/auto-index/status', (req, res) => {
  try {
    const status = autoIndexService.getAutoIndexStatus();

    if (!status) {
      res.json({
        success: true,
        isRunning: false,
        message: 'No auto-indexing job running',
      });
      return;
    }

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Auto-index status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
