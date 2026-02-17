import { Router } from 'express';
import { getAutoIndexStatus, stopAutoIndexing, startAutoIndexing } from '../services/autoIndexService.js';

const router = Router();

// GET /api/indexing/status - Get current indexing status
router.get('/status', async (req, res) => {
  try {
    const status = await getAutoIndexStatus();
    res.json(status || { isRunning: false });
  } catch (error) {
    console.error('Error getting indexing status:', error);
    res.status(500).json({ error: 'Failed to get indexing status' });
  }
});

// POST /api/indexing/pause - Pause current indexing
router.post('/pause', async (req, res) => {
  try {
    stopAutoIndexing();
    res.json({ success: true, message: 'Indexing paused' });
  } catch (error) {
    console.error('Error pausing indexing:', error);
    res.status(500).json({ error: 'Failed to pause indexing' });
  }
});

// POST /api/indexing/resume - Resume/start indexing
router.post('/resume', async (req, res) => {
  try {
    await startAutoIndexing();
    res.json({ success: true, message: 'Indexing resumed' });
  } catch (error) {
    console.error('Error resuming indexing:', error);
    res.status(500).json({ error: 'Failed to resume indexing' });
  }
});

export default router;
