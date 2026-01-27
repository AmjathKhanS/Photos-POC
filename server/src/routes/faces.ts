import { Router } from 'express';
import {
  scanAllPhotos,
  getScanStatus,
  getPhotoFaces,
  getAllFaces,
  getFaceThumbnail,
  getTotalStats
} from '../services/faceService.js';
import {
  getAllPersons,
  getPersonById,
  createPerson,
  updatePerson,
  deletePerson,
  getPersonPhotos,
  assignFaceToPerson,
  unassignFace
} from '../services/personService.js';
import { runFaceClustering } from '../services/faceClusterService.js';
import { findDuplicatePersons, mergePersons } from '../services/personDuplicateService.js';

const router = Router();

// ============ Face Scanning ============

// POST /api/faces/scan - Start scanning all photos for faces
router.post('/scan', async (req, res) => {
  try {
    const result = await scanAllPhotos();
    res.json(result);
  } catch (error) {
    console.error('Error starting face scan:', error);
    res.status(500).json({ error: 'Failed to start face scan' });
  }
});

// GET /api/faces/scan/status - Get scanning progress
router.get('/scan/status', (req, res) => {
  const status = getScanStatus();
  res.json(status);
});

// GET /api/faces/stats - Get overall statistics
router.get('/stats', (req, res) => {
  try {
    const stats = getTotalStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============ Face Data ============

// GET /api/faces - Get all faces
router.get('/', (req, res) => {
  try {
    const faces = getAllFaces();
    res.json(faces);
  } catch (error) {
    console.error('Error fetching faces:', error);
    res.status(500).json({ error: 'Failed to fetch faces' });
  }
});

// GET /api/faces/photo/:filename - Get faces in a specific photo
router.get('/photo/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const faces = getPhotoFaces(decodeURIComponent(filename));
    res.json(faces);
  } catch (error) {
    console.error('Error fetching photo faces:', error);
    res.status(500).json({ error: 'Failed to fetch faces for photo' });
  }
});

// GET /api/faces/:faceId/thumbnail - Get face thumbnail
router.get('/:faceId/thumbnail', async (req, res) => {
  try {
    const faceId = parseInt(req.params.faceId);
    const { buffer, contentType } = await getFaceThumbnail(faceId);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating face thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate face thumbnail' });
  }
});

// ============ Person Management ============

// GET /api/faces/persons - List all persons
router.get('/persons', (req, res) => {
  try {
    const persons = getAllPersons();
    res.json(persons);
  } catch (error) {
    console.error('Error fetching persons:', error);
    res.status(500).json({ error: 'Failed to fetch persons' });
  }
});

// GET /api/faces/persons/duplicates - Find duplicate persons
router.get('/persons/duplicates', async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold as string) || 0.85;
    const result = await findDuplicatePersons(threshold);
    res.json(result);
  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({ error: 'Failed to find duplicate persons' });
  }
});

// POST /api/faces/persons/merge - Merge two persons
router.post('/persons/merge', (req, res) => {
  try {
    const { sourcePersonId, targetPersonId } = req.body;

    if (typeof sourcePersonId !== 'number' || typeof targetPersonId !== 'number') {
      return res.status(400).json({ error: 'Source and target person IDs are required' });
    }

    if (sourcePersonId === targetPersonId) {
      return res.status(400).json({ error: 'Cannot merge a person into themselves' });
    }

    mergePersons(sourcePersonId, targetPersonId);
    res.json({ success: true, message: `Person ${sourcePersonId} merged into Person ${targetPersonId}` });
  } catch (error) {
    console.error('Error merging persons:', error);
    res.status(500).json({ error: 'Failed to merge persons' });
  }
});

// GET /api/faces/persons/:id - Get a specific person
router.get('/persons/:id', (req, res) => {
  try {
    const personId = parseInt(req.params.id);
    const person = getPersonById(personId);
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }
    res.json(person);
  } catch (error) {
    console.error('Error fetching person:', error);
    res.status(500).json({ error: 'Failed to fetch person' });
  }
});

// POST /api/faces/persons - Create a new person
router.post('/persons', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' });
    }
    const person = createPerson(name.trim());
    res.json(person);
  } catch (error) {
    console.error('Error creating person:', error);
    res.status(500).json({ error: 'Failed to create person' });
  }
});

// PUT /api/faces/persons/:id - Update person name
router.put('/persons/:id', (req, res) => {
  try {
    const personId = parseInt(req.params.id);
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' });
    }
    updatePerson(personId, name.trim());
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating person:', error);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

// DELETE /api/faces/persons/:id - Delete person
router.delete('/persons/:id', (req, res) => {
  try {
    const personId = parseInt(req.params.id);
    deletePerson(personId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({ error: 'Failed to delete person' });
  }
});

// GET /api/faces/persons/:id/photos - Get all photos containing a person
router.get('/persons/:id/photos', (req, res) => {
  try {
    const personId = parseInt(req.params.id);
    const photos = getPersonPhotos(personId);
    res.json(photos);
  } catch (error) {
    console.error('Error fetching person photos:', error);
    res.status(500).json({ error: 'Failed to fetch person photos' });
  }
});

// ============ Face Assignment ============

// POST /api/faces/:faceId/assign - Assign face to person
router.post('/:faceId/assign', (req, res) => {
  try {
    const faceId = parseInt(req.params.faceId);
    const { personId } = req.body;
    if (typeof personId !== 'number') {
      return res.status(400).json({ error: 'Person ID is required' });
    }
    assignFaceToPerson(faceId, personId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning face:', error);
    res.status(500).json({ error: 'Failed to assign face to person' });
  }
});

// POST /api/faces/:faceId/unassign - Unassign face from person
router.post('/:faceId/unassign', (req, res) => {
  try {
    const faceId = parseInt(req.params.faceId);
    unassignFace(faceId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error unassigning face:', error);
    res.status(500).json({ error: 'Failed to unassign face' });
  }
});

// ============ Face Clustering ============

// POST /api/faces/cluster - Run face clustering algorithm
router.post('/cluster', async (req, res) => {
  try {
    const { eps = 0.5, minSamples = 2 } = req.body;
    const result = await runFaceClustering(eps, minSamples);
    res.json(result);
  } catch (error) {
    console.error('Error running clustering:', error);
    res.status(500).json({ error: 'Failed to run face clustering' });
  }
});

export default router;
