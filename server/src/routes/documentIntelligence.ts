/**
 * Document Intelligence API Routes
 * Endpoints for document classification, search, and management
 */

import express from 'express';
import * as documentService from '../services/documentIntelligenceService.js';
import * as photoService from '../services/photoService.js';

const router = express.Router();

/**
 * GET /api/documents
 * Get all documents with optional filters
 */
router.get('/', (req, res) => {
  try {
    const filters = {
      document_type: req.query.document_type as string | undefined,
      min_amount: req.query.min_amount ? parseFloat(req.query.min_amount as string) : undefined,
      max_amount: req.query.max_amount ? parseFloat(req.query.max_amount as string) : undefined,
      start_date: req.query.start_date as string | undefined,
      end_date: req.query.end_date as string | undefined,
      has_expiry: req.query.has_expiry === 'true',
      is_starred: req.query.is_starred === 'true' ? true : req.query.is_starred === 'false' ? false : undefined,
      search_query: req.query.q as string | undefined,
    };

    const documents = documentService.getAllDocuments(filters);

    // Enhance with photo URLs
    const enhancedDocuments = documents.map(doc => ({
      ...doc,
      thumbnailUrl: `http://localhost:3002/api/photos/thumbnail/${doc.photo_filename}`,
      fullUrl: `http://localhost:3002/api/photos/full/${doc.photo_filename}`,
      extracted_names: doc.extracted_names ? JSON.parse(doc.extracted_names) : [],
      extracted_entities: doc.extracted_entities ? JSON.parse(doc.extracted_entities) : {},
    }));

    res.json({
      success: true,
      documents: enhancedDocuments,
      count: enhancedDocuments.length,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/documents/stats
 * Get document statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = documentService.getDocumentStats();

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
 * GET /api/documents/alerts
 * Get active alerts
 */
router.get('/alerts', (req, res) => {
  try {
    const alerts = documentService.getActiveAlerts();

    res.json({
      success: true,
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/documents/alerts/:id/dismiss
 * Dismiss an alert
 */
router.post('/alerts/:id/dismiss', (req, res) => {
  try {
    const alertId = parseInt(req.params.id);

    if (isNaN(alertId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid alert ID',
      });
      return;
    }

    documentService.dismissAlert(alertId);

    res.json({
      success: true,
      message: 'Alert dismissed',
    });
  } catch (error) {
    console.error('Dismiss alert error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/documents/expiring
 * Get documents expiring soon
 */
router.get('/expiring', (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 30;
    const documents = documentService.getExpiringDocuments(daysAhead);

    // Enhance with photo URLs
    const enhancedDocuments = documents.map(doc => ({
      ...doc,
      thumbnailUrl: `http://localhost:3002/api/photos/thumbnail/${doc.photo_filename}`,
      fullUrl: `http://localhost:3002/api/photos/full/${doc.photo_filename}`,
      extracted_names: doc.extracted_names ? JSON.parse(doc.extracted_names) : [],
      extracted_entities: doc.extracted_entities ? JSON.parse(doc.extracted_entities) : {},
    }));

    res.json({
      success: true,
      documents: enhancedDocuments,
      count: enhancedDocuments.length,
    });
  } catch (error) {
    console.error('Get expiring documents error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/documents/search
 * Full-text search documents
 */
router.get('/search', (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
      return;
    }

    const documents = documentService.searchDocuments(query);

    // Enhance with photo URLs
    const enhancedDocuments = documents.map(doc => ({
      ...doc,
      thumbnailUrl: `http://localhost:3002/api/photos/thumbnail/${doc.photo_filename}`,
      fullUrl: `http://localhost:3002/api/photos/full/${doc.photo_filename}`,
      extracted_names: doc.extracted_names ? JSON.parse(doc.extracted_names) : [],
      extracted_entities: doc.extracted_entities ? JSON.parse(doc.extracted_entities) : {},
    }));

    res.json({
      success: true,
      documents: enhancedDocuments,
      count: enhancedDocuments.length,
      query,
    });
  } catch (error) {
    console.error('Search documents error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/documents/:filename
 * Get document by filename
 */
router.get('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const document = documentService.getDocumentByFilename(filename);

    if (!document) {
      res.status(404).json({
        success: false,
        error: 'Document not found',
      });
      return;
    }

    // Enhance with photo URLs
    const enhancedDocument = {
      ...document,
      thumbnailUrl: `http://localhost:3002/api/photos/thumbnail/${document.photo_filename}`,
      fullUrl: `http://localhost:3002/api/photos/full/${document.photo_filename}`,
      extracted_names: document.extracted_names ? JSON.parse(document.extracted_names) : [],
      extracted_entities: document.extracted_entities ? JSON.parse(document.extracted_entities) : {},
    };

    res.json({
      success: true,
      document: enhancedDocument,
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/documents/process
 * Process all documents in library
 */
router.post('/process', async (req, res) => {
  try {
    console.log('📄 Processing all documents...');

    const result = await documentService.processAllDocuments();

    if (result.success) {
      res.json({
        success: true,
        message: `Processed ${result.processed} documents`,
        total: result.total,
        processed: result.processed,
        failed: result.failed,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to process documents',
      });
    }
  } catch (error) {
    console.error('Process documents error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/documents/:filename/star
 * Star/unstar a document
 */
router.post('/:filename/star', (req, res) => {
  try {
    const { filename } = req.params;
    const { is_starred } = req.body;

    documentService.toggleStar(filename, is_starred);

    res.json({
      success: true,
      message: is_starred ? 'Document starred' : 'Document unstarred',
    });
  } catch (error) {
    console.error('Toggle star error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * DELETE /api/documents/:filename
 * Delete document metadata
 */
router.delete('/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    documentService.deleteDocument(filename);

    res.json({
      success: true,
      message: 'Document metadata deleted',
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
