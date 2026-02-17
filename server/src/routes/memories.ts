import { Router } from 'express';
import {
  initializeSmartMemories,
  generateDailyMemories,
  generateWeeklyMemories,
  generateMonthlyMemories,
  generateSeasonalMemories,
  generatePersonMemories,
  getActiveMemories,
  getMemory,
  getPhotosInMemory,
  getMemoriesOfType,
  getMemoriesForPerson,
  dismissMemory,
  deleteMemory
} from '../services/memoryService.js';

const router = Router();

// ============ Initialization ============

// POST /api/memories/initialize - Initialize Smart Memories (one-time setup)
router.post('/initialize', async (req, res) => {
  try {
    const result = await initializeSmartMemories();
    if (result.error) {
      return res.status(500).json({ error: result.error, message: result.message });
    }
    res.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Error initializing Smart Memories:', error);
    res.status(500).json({ error: 'Failed to initialize Smart Memories' });
  }
});

// ============ Memory Generation ============

// POST /api/memories/generate/daily - Generate "On This Day" memories
router.post('/generate/daily', async (req, res) => {
  try {
    const result = await generateDailyMemories();
    if (result.error) {
      return res.status(500).json({ error: result.error, message: result.message });
    }
    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Error generating daily memories:', error);
    res.status(500).json({ error: 'Failed to generate daily memories' });
  }
});

// POST /api/memories/generate/weekly - Generate weekly highlight memories
router.post('/generate/weekly', async (req, res) => {
  try {
    const result = await generateWeeklyMemories();
    if (result.error) {
      return res.status(500).json({ error: result.error, message: result.message });
    }
    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Error generating weekly memories:', error);
    res.status(500).json({ error: 'Failed to generate weekly memories' });
  }
});

// POST /api/memories/generate/monthly - Generate monthly highlight memories
router.post('/generate/monthly', async (req, res) => {
  try {
    const result = await generateMonthlyMemories();
    if (result.error) {
      return res.status(500).json({ error: result.error, message: result.message });
    }
    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Error generating monthly memories:', error);
    res.status(500).json({ error: 'Failed to generate monthly memories' });
  }
});

// POST /api/memories/generate/seasonal - Generate seasonal memories
router.post('/generate/seasonal', async (req, res) => {
  try {
    const result = await generateSeasonalMemories();
    if (result.error) {
      return res.status(500).json({ error: result.error, message: result.message });
    }
    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Error generating seasonal memories:', error);
    res.status(500).json({ error: 'Failed to generate seasonal memories' });
  }
});

// POST /api/memories/generate/person/:personId - Generate memories for specific person
router.post('/generate/person/:personId', async (req, res) => {
  try {
    const personId = parseInt(req.params.personId);
    if (isNaN(personId)) {
      return res.status(400).json({ error: 'Invalid person ID' });
    }

    const result = await generatePersonMemories(personId);
    if (result.error) {
      return res.status(500).json({ error: result.error, message: result.message });
    }
    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Error generating person memories:', error);
    res.status(500).json({ error: 'Failed to generate person memories' });
  }
});

// ============ Memory Retrieval ============

// GET /api/memories - Get all active memories (not dismissed)
router.get('/', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const memories = getActiveMemories(limit);
    res.json(memories);
  } catch (error) {
    console.error('Error fetching memories:', error);
    console.error('Full error details:', error instanceof Error ? error.stack : error);
    // Return empty array instead of error to prevent UI breakage
    res.json([]);
  }
});

// GET /api/memories/type/:type - Get memories by type
router.get('/type/:type', (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['on_this_day', 'weekly', 'monthly', 'seasonal', 'people'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid memory type' });
    }

    const memories = getMemoriesOfType(type);
    res.json(memories);
  } catch (error) {
    console.error('Error fetching memories by type:', error);
    // Return empty array instead of error to prevent UI breakage
    res.json([]);
  }
});

// GET /api/memories/person/:personId - Get memories for specific person
router.get('/person/:personId', (req, res) => {
  try {
    const personId = parseInt(req.params.personId);
    if (isNaN(personId)) {
      return res.status(400).json({ error: 'Invalid person ID' });
    }

    const memories = getMemoriesForPerson(personId);
    res.json(memories);
  } catch (error) {
    console.error('Error fetching person memories:', error);
    res.status(500).json({ error: 'Failed to fetch person memories' });
  }
});

// GET /api/memories/:id - Get specific memory details
router.get('/:id', (req, res) => {
  try {
    const memoryId = parseInt(req.params.id);
    if (isNaN(memoryId)) {
      return res.status(400).json({ error: 'Invalid memory ID' });
    }

    const memory = getMemory(memoryId);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    res.json(memory);
  } catch (error) {
    console.error('Error fetching memory:', error);
    res.status(500).json({ error: 'Failed to fetch memory' });
  }
});

// GET /api/memories/:id/photos - Get photos in a specific memory
router.get('/:id/photos', (req, res) => {
  try {
    const memoryId = parseInt(req.params.id);
    if (isNaN(memoryId)) {
      return res.status(400).json({ error: 'Invalid memory ID' });
    }

    const photos = getPhotosInMemory(memoryId);
    res.json(photos);
  } catch (error) {
    console.error('Error fetching memory photos:', error);
    res.status(500).json({ error: 'Failed to fetch memory photos' });
  }
});

// ============ Memory Management ============

// POST /api/memories/:id/dismiss - Dismiss a memory
router.post('/:id/dismiss', (req, res) => {
  try {
    const memoryId = parseInt(req.params.id);
    if (isNaN(memoryId)) {
      return res.status(400).json({ error: 'Invalid memory ID' });
    }

    dismissMemory(memoryId);
    res.json({ success: true, message: 'Memory dismissed' });
  } catch (error) {
    console.error('Error dismissing memory:', error);
    res.status(500).json({ error: 'Failed to dismiss memory' });
  }
});

// DELETE /api/memories/:id - Delete a memory
router.delete('/:id', (req, res) => {
  try {
    const memoryId = parseInt(req.params.id);
    if (isNaN(memoryId)) {
      return res.status(400).json({ error: 'Invalid memory ID' });
    }

    deleteMemory(memoryId);
    res.json({ success: true, message: 'Memory deleted' });
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

export default router;
