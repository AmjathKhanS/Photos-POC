/**
 * Smart Albums Service
 * Orchestrates Python clustering service and manages album lifecycle
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as smartAlbumsDb from './smartAlbumsDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_CMD = process.env.PYTHON_EXECUTABLE || 'python3';
const CLUSTERING_SERVICE_PATH = path.join(__dirname, '../../ai/smart_albums_service.py');
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/faces.db');

interface ClusteringResult {
  success: boolean;
  albums: Array<{
    title: string;
    description: string;
    cover_photo_filename: string;
    start_date: string | null;
    end_date: string | null;
    photo_count: number;
    avg_similarity: number;
    photos: Array<{
      filename: string;
      similarity_score: number;
    }>;
  }>;
  count: number;
  error?: string;
}

/**
 * Call Python clustering service with two-stage clustering parameters
 */
async function callClusteringService(
  epsVisual: number = 0.25,
  minSamples: number = 2,
  maxWindowDays: number = 7,
  maxGapDays: number = 2
): Promise<ClusteringResult> {
  return new Promise((resolve, reject) => {
    const process = spawn(PYTHON_CMD, [
      CLUSTERING_SERVICE_PATH,
      '--db-path', DB_PATH,
      '--eps-visual', epsVisual.toString(),
      '--min-samples', minSamples.toString(),
      '--max-window-days', maxWindowDays.toString(),
      '--max-gap-days', maxGapDays.toString(),
    ]);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error('Clustering service error:', stderr);
        reject(new Error(`Clustering service exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        console.error('Failed to parse clustering output:', stdout);
        reject(new Error(`Invalid JSON from clustering service: ${error}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Failed to start clustering service: ${error.message}`));
    });
  });
}

/**
 * Generate smart albums using two-stage AI clustering
 */
export async function generateSmartAlbums(
  epsVisual: number = 0.25,
  minSamples: number = 2,
  maxWindowDays: number = 7,
  maxGapDays: number = 2,
  replaceExisting: boolean = true
): Promise<{
  success: boolean;
  albums_created: number;
  photos_organized: number;
  error?: string;
}> {
  try {
    console.log('🎨 Starting smart album generation (two-stage clustering)...');
    console.log(`   Parameters: epsVisual=${epsVisual}, minSamples=${minSamples}, maxWindow=${maxWindowDays}d, maxGap=${maxGapDays}d`);

    // Call Python clustering service with new parameters
    const clusteringResult = await callClusteringService(epsVisual, minSamples, maxWindowDays, maxGapDays);

    if (!clusteringResult.success) {
      throw new Error(clusteringResult.error || 'Clustering failed');
    }

    // Clear existing albums if requested
    if (replaceExisting) {
      console.log('🗑️  Clearing existing smart albums...');
      smartAlbumsDb.clearAllAlbums();
    }

    // Save albums to database
    console.log(`💾 Saving ${clusteringResult.albums.length} albums to database...`);
    let totalPhotos = 0;

    for (const albumData of clusteringResult.albums) {
      // Create album
      const albumId = smartAlbumsDb.createAlbum(
        albumData.title,
        albumData.description,
        albumData.cover_photo_filename,
        albumData.start_date,
        albumData.end_date,
        albumData.photo_count,
        albumData.avg_similarity,
        'two_stage_clustering'
      );

      // Add photos to album
      const photos = albumData.photos.map(p => ({
        filename: p.filename,
        similarity_score: p.similarity_score,
        is_cover: p.filename === albumData.cover_photo_filename,
      }));

      smartAlbumsDb.addPhotosToAlbum(albumId, photos);
      totalPhotos += photos.length;
    }

    console.log(`✅ Created ${clusteringResult.albums.length} smart albums with ${totalPhotos} photos`);

    return {
      success: true,
      albums_created: clusteringResult.albums.length,
      photos_organized: totalPhotos,
    };
  } catch (error) {
    console.error('Smart album generation failed:', error);
    return {
      success: false,
      albums_created: 0,
      photos_organized: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get all smart albums
 */
export function getAllAlbums() {
  return smartAlbumsDb.getAllAlbums();
}

/**
 * Get album with photos
 */
export function getAlbumWithPhotos(albumId: number) {
  return smartAlbumsDb.getAlbumWithPhotos(albumId);
}

/**
 * Get album statistics
 */
export function getAlbumStats() {
  return smartAlbumsDb.getAlbumStats();
}

/**
 * Delete an album
 */
export function deleteAlbum(albumId: number) {
  smartAlbumsDb.deleteAlbum(albumId);
}

/**
 * Update album metadata
 */
export function updateAlbum(albumId: number, updates: Partial<{
  title: string;
  description: string;
}>) {
  smartAlbumsDb.updateAlbum(albumId, updates);
}
