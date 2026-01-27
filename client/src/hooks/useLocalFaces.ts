/**
 * Local Face Recognition Hook
 *
 * Orchestrates the face recognition pipeline:
 * 1. Face Detection (MediaPipe)
 * 2. Embedding Extraction (ONNX Runtime + MobileFaceNet)
 * 3. Vector Storage (IndexedDB)
 * 4. Clustering (DBSCAN)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Person, ScanStatus, FaceStats } from '../types/face';
import type { Photo } from '../types/photo';

// New cross-platform services
import { initFaceDetector, detectFaces, isFaceDetectorReady } from '../services/faceDetection';
import { initEmbeddingModel, extractEmbedding, isEmbeddingModelReady } from '../services/faceEmbedding';
import { clusterFaces, findMatchingPerson } from '../services/faceClustering';

// Database
import {
  saveFace,
  getAllPersons,
  createPerson as dbCreatePerson,
  updatePerson,
  deletePerson as dbDeletePerson,
  assignFaceToPerson as dbAssignFaceToPerson,
  getProcessingStatus,
  setProcessingStatus,
  getStats,
  getFacesByPerson,
  StoredPerson,
  clearAllData,
} from '../services/faceDatabase';
import { clearThumbnailCache } from '../utils/faceThumbnail';

interface UseLocalFacesResult {
  persons: Person[];
  scanStatus: ScanStatus;
  stats: FaceStats | null;
  loading: boolean;
  modelsLoaded: boolean;
  startScan: (photos: Photo[]) => Promise<void>;
  runClustering: () => Promise<void>;
  createPerson: (name: string) => Promise<Person>;
  renamePerson: (personId: number, name: string) => Promise<void>;
  deletePerson: (personId: number) => Promise<void>;
  assignFaceToPerson: (faceId: number, personId: number) => Promise<void>;
  refetch: () => void;
  initModels: () => Promise<void>;
  resetAll: () => Promise<void>;
}

function storedPersonToPerson(stored: StoredPerson, faceCount: number): Person {
  return {
    id: stored.id!,
    name: stored.name,
    representative_face_id: stored.representativeFaceId,
    face_count: faceCount,
    created_at: stored.createdAt,
  };
}

export function useLocalFaces(): UseLocalFacesResult {
  const [persons, setPersons] = useState<Person[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus>({ status: 'idle', total: 0, processed: 0 });
  const [stats, setStats] = useState<FaceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const scanningRef = useRef(false);

  // Check if models are loaded
  useEffect(() => {
    setModelsLoaded(isFaceDetectorReady() && isEmbeddingModelReady());
  }, []);

  const fetchPersons = useCallback(async () => {
    try {
      const storedPersons = await getAllPersons();
      const personsWithCounts: Person[] = [];

      for (const sp of storedPersons) {
        const faces = await getFacesByPerson(sp.id!);
        personsWithCounts.push(storedPersonToPerson(sp, faces.length));
      }

      // Sort by face count descending
      personsWithCounts.sort((a, b) => b.face_count - a.face_count);
      setPersons(personsWithCounts);
    } catch (error) {
      console.error('Error fetching persons:', error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const dbStats = await getStats();
      setStats(dbStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  /**
   * Initialize AI models (MediaPipe + ONNX)
   */
  const initModels = useCallback(async () => {
    if (modelsLoaded) return;
    try {
      setLoading(true);
      console.log('Initializing AI models...');

      // Initialize in parallel
      await Promise.all([
        initFaceDetector(),
        initEmbeddingModel()
      ]);

      setModelsLoaded(true);
      console.log('All AI models initialized');
    } catch (error) {
      console.error('Error loading models:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [modelsLoaded]);

  /**
   * Scan photos for faces
   */
  const startScan = useCallback(async (photos: Photo[]) => {
    if (scanningRef.current) return;
    if (photos.length === 0) {
      console.error('No photos to scan');
      setScanStatus({ status: 'error', total: 0, processed: 0, error: 'No photos available to scan' });
      return;
    }
    scanningRef.current = true;

    try {
      setLoading(true);
      setScanStatus({ status: 'scanning', total: photos.length, processed: 0 });

      // Ensure models are loaded
      console.log('Ensuring AI models are loaded...');
      await initModels();

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];

        setScanStatus({
          status: 'scanning',
          total: photos.length,
          processed: i,
          currentPhoto: photo.filename,
        });

        // Check if already processed
        const existing = await getProcessingStatus(photo.id);
        if (existing?.status === 'completed') continue;

        try {
          // Load image
          console.log(`Processing: ${photo.filename}`);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to load image: ${photo.filename}`));
            img.src = photo.fullUrl;
          });

          // Step 1: Detect faces (MediaPipe)
          const detectedFaces = await detectFaces(img);
          console.log(`Found ${detectedFaces.length} faces in: ${photo.filename}`);

          // Step 2: Extract embeddings and save (ONNX)
          for (let j = 0; j < detectedFaces.length; j++) {
            const face = detectedFaces[j];

            // Extract embedding
            const embedding = await extractEmbedding(face.faceImageData);

            // Try to find matching person
            const matchingPersonId = await findMatchingPerson(Array.from(embedding));

            // Save to database
            await saveFace({
              photoId: photo.id,
              photoFilename: photo.filename,
              faceIndex: j,
              boundingBox: {
                top: face.boundingBox.y,
                right: face.boundingBox.x + face.boundingBox.width,
                bottom: face.boundingBox.y + face.boundingBox.height,
                left: face.boundingBox.x,
              },
              embedding: Array.from(embedding),
              personId: matchingPersonId,
              createdAt: new Date().toISOString(),
            });
          }

          await setProcessingStatus(photo.id, 'completed', detectedFaces.length);
        } catch (err) {
          console.error(`Error processing ${photo.filename}:`, err);
          await setProcessingStatus(
            photo.id,
            'failed',
            0,
            err instanceof Error ? err.message : 'Unknown error'
          );
        }
      }

      const finalStats = await getStats();
      console.log(`Scan complete! Found ${finalStats.totalFaces} faces in ${finalStats.processedPhotos} photos`);
      setScanStatus({ status: 'completed', total: photos.length, processed: photos.length });
      await fetchPersons();
      await fetchStats();
    } catch (err) {
      console.error('Scan failed:', err);
      setScanStatus({
        status: 'error',
        total: scanStatus.total,
        processed: scanStatus.processed,
        error: err instanceof Error ? err.message : 'Scan failed',
      });
    } finally {
      setLoading(false);
      scanningRef.current = false;
    }
  }, [fetchPersons, fetchStats, initModels, scanStatus.total, scanStatus.processed]);

  /**
   * Run DBSCAN clustering on unassigned faces
   */
  const runClustering = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Starting DBSCAN clustering...');

      // Use eps=0.8 for normalized embeddings (adjustable)
      const result = await clusterFaces(0.8, 1);
      console.log('Clustering result:', result);

      await fetchPersons();
      await fetchStats();
    } catch (error) {
      console.error('Error running clustering:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchPersons, fetchStats]);

  const createPerson = useCallback(async (name: string): Promise<Person> => {
    const personId = await dbCreatePerson(name);
    const person: Person = {
      id: personId,
      name,
      representative_face_id: null,
      face_count: 0,
      created_at: new Date().toISOString(),
    };
    await fetchPersons();
    return person;
  }, [fetchPersons]);

  const renamePerson = useCallback(async (personId: number, name: string) => {
    const storedPersons = await getAllPersons();
    const person = storedPersons.find(p => p.id === personId);
    if (person) {
      person.name = name;
      await updatePerson(person);
      await fetchPersons();
    }
  }, [fetchPersons]);

  const deletePerson = useCallback(async (personId: number) => {
    await dbDeletePerson(personId);
    await fetchPersons();
    await fetchStats();
  }, [fetchPersons, fetchStats]);

  const assignFaceToPerson = useCallback(async (faceId: number, personId: number) => {
    await dbAssignFaceToPerson(faceId, personId);
    await fetchPersons();
  }, [fetchPersons]);

  const resetAll = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Clearing all face data...');
      await clearAllData();
      clearThumbnailCache();
      setScanStatus({ status: 'idle', total: 0, processed: 0 });
      await fetchPersons();
      await fetchStats();
      console.log('All face data cleared');
    } catch (error) {
      console.error('Error resetting data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchPersons, fetchStats]);

  useEffect(() => {
    fetchPersons();
    fetchStats();
  }, [fetchPersons, fetchStats]);

  return {
    persons,
    scanStatus,
    stats,
    loading,
    modelsLoaded,
    startScan,
    runClustering,
    createPerson,
    renamePerson,
    deletePerson,
    assignFaceToPerson,
    refetch: fetchPersons,
    initModels,
    resetAll,
  };
}
