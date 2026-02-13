/**
 * Auto-Indexing Service
 * Automatically indexes photos in the background (like Google Photos)
 */

import * as photoService from './photoService.js';
import * as semanticSearchService from './semanticSearchService.js';
import * as semanticDb from './semanticSearchDb.js';
import * as locationService from './locationService.js';
import path from 'path';

interface AutoIndexOptions {
  batchSize?: number;           // Photos per batch (default: 10)
  delayBetweenBatches?: number; // Milliseconds between batches (default: 2000)
  maxRetries?: number;          // Retry failed photos (default: 2)
  onProgress?: (stats: IndexingStats) => void;
  onComplete?: (stats: IndexingStats) => void;
  stopOnError?: boolean;        // Stop if batch fails (default: false)
}

interface IndexingStats {
  total: number;
  processed: number;
  failed: number;
  remaining: number;
  progress: number;
  isRunning: boolean;
  currentBatch?: number;
  totalBatches?: number;
  errors: Array<{ filename: string; error: string }>;
}

let currentIndexingJob: IndexingStats | null = null;
let shouldStop = false;

/**
 * Get current auto-indexing status
 */
export function getAutoIndexStatus(): IndexingStats | null {
  return currentIndexingJob;
}

/**
 * Stop the current auto-indexing job
 */
export function stopAutoIndexing(): void {
  shouldStop = true;
}

/**
 * Get list of unindexed photos
 */
async function getUnindexedPhotos(): Promise<string[]> {
  try {
    const allPhotos = await photoService.getPhotoList();
    const unindexed: string[] = [];

    for (const photo of allPhotos) {
      const status = semanticDb.getProcessingStatus(photo.filename);

      // Photo needs indexing if:
      // 1. Never processed before, OR
      // 2. Processing failed, OR
      // 3. Only partially processed
      if (!status ||
          status.error_message ||
          !status.ocr_processed ||
          !status.clip_processed) {
        unindexed.push(photo.filename);
      }
    }

    return unindexed;
  } catch (error) {
    console.error('Failed to get unindexed photos:', error);
    return [];
  }
}

/**
 * Auto-index all photos in the background
 */
export async function startAutoIndexing(options: AutoIndexOptions = {}): Promise<void> {
  // Prevent multiple indexing jobs
  if (currentIndexingJob?.isRunning) {
    console.log('⚠️  Auto-indexing already in progress, skipping...');
    return;
  }

  const {
    batchSize = 10,  // Process 10 photos per batch
    delayBetweenBatches = 500,  // Shorter delay for faster processing
    maxRetries = 2,
    onProgress,
    onComplete,
    stopOnError = false,
  } = options;

  shouldStop = false;

  try {
    console.log('🚀 Starting auto-indexing service...');

    // Get all unindexed photos
    const unindexedPhotos = await getUnindexedPhotos();

    if (unindexedPhotos.length === 0) {
      console.log('✓ All photos are already indexed!');
      return;
    }

    console.log(`📊 Found ${unindexedPhotos.length} photos to index`);

    // Initialize stats
    const totalBatches = Math.ceil(unindexedPhotos.length / batchSize);
    currentIndexingJob = {
      total: unindexedPhotos.length,
      processed: 0,
      failed: 0,
      remaining: unindexedPhotos.length,
      progress: 0,
      isRunning: true,
      currentBatch: 0,
      totalBatches,
      errors: [],
    };

    // Process in batches
    for (let i = 0; i < unindexedPhotos.length; i += batchSize) {
      // Check if should stop
      if (shouldStop) {
        console.log('⏸️  Auto-indexing stopped by user');
        break;
      }

      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = unindexedPhotos.slice(i, i + batchSize);

      currentIndexingJob.currentBatch = batchNumber;

      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} photos)`);

      // Process batch
      const results = await processBatch(batch, maxRetries);

      // Update stats
      currentIndexingJob.processed += results.succeeded;
      currentIndexingJob.failed += results.failed;
      currentIndexingJob.remaining = unindexedPhotos.length - currentIndexingJob.processed - currentIndexingJob.failed;
      currentIndexingJob.progress = Math.round((currentIndexingJob.processed / unindexedPhotos.length) * 100);
      currentIndexingJob.errors.push(...results.errors);

      console.log(`   ✓ Succeeded: ${results.succeeded}`);
      console.log(`   ✗ Failed: ${results.failed}`);
      console.log(`   📊 Progress: ${currentIndexingJob.progress}%`);

      // Call progress callback
      if (onProgress) {
        onProgress({ ...currentIndexingJob });
      }

      // Stop on error if configured
      if (stopOnError && results.failed > 0) {
        console.error('⚠️  Stopping auto-indexing due to errors');
        break;
      }

      // Delay between batches (avoid overloading system)
      if (i + batchSize < unindexedPhotos.length) {
        await sleep(delayBetweenBatches);
      }
    }

    // Mark as complete
    currentIndexingJob.isRunning = false;

    console.log('\n✅ Auto-indexing complete!');
    console.log(`   📊 Total: ${currentIndexingJob.total}`);
    console.log(`   ✓ Processed: ${currentIndexingJob.processed}`);
    console.log(`   ✗ Failed: ${currentIndexingJob.failed}`);

    // Call completion callback
    if (onComplete) {
      onComplete({ ...currentIndexingJob });
    }

  } catch (error) {
    console.error('❌ Auto-indexing failed:', error);
    if (currentIndexingJob) {
      currentIndexingJob.isRunning = false;
    }
  }
}

/**
 * Process a batch of photos
 */
async function processBatch(filenames: string[], maxRetries: number): Promise<{
  succeeded: number;
  failed: number;
  errors: Array<{ filename: string; error: string }>;
}> {
  const results = {
    succeeded: 0,
    failed: 0,
    errors: [] as Array<{ filename: string; error: string }>,
  };

  for (const filename of filenames) {
    let success = false;
    let lastError = '';

    // Retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await semanticSearchService.indexPhoto(filename);

        if (result.success) {
          success = true;
          console.log(`   ✓ ${filename}`);
          break;
        } else {
          lastError = result.error || 'Unknown error';

          // Skip HEIC files (known issue)
          if (lastError.includes('HEIC') || lastError.includes('cannot identify')) {
            console.log(`   ⊘ ${filename} (HEIC format - skipping)`);
            break;
          }

          if (attempt < maxRetries) {
            console.log(`   ⚠️  ${filename} failed (attempt ${attempt}/${maxRetries}), retrying...`);
            await sleep(1000);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt < maxRetries) {
          await sleep(1000);
        }
      }
    }

    // Extract GPS data (runs regardless of indexing success)
    try {
      const photoPath = path.join(process.env.PHOTOS_DIR || '', filename);
      const gpsData = await locationService.extractGPSFromPhoto(photoPath);

      if (gpsData) {
        await locationService.savePhotoLocation({
          photo_filename: filename,
          ...gpsData,
        });
        console.log(`   📍 GPS extracted: ${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)}`);
      }
    } catch (gpsError) {
      // GPS extraction errors don't count as indexing failures
      // Just log silently for debugging
    }

    if (success) {
      results.succeeded++;
    } else {
      results.failed++;
      results.errors.push({ filename, error: lastError });
      console.log(`   ✗ ${filename} (${lastError})`);
    }
  }

  return results;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Start auto-indexing on server startup (runs in background)
 */
export function initAutoIndexing(): void {
  // Wait 5 seconds after server starts, then begin indexing
  setTimeout(async () => {
    console.log('\n🔍 Checking for unindexed photos...');
    const unindexed = await getUnindexedPhotos();

    if (unindexed.length > 0) {
      console.log(`📸 Found ${unindexed.length} photos to index - starting background indexing...`);

      startAutoIndexing({
        batchSize: 10,
        delayBetweenBatches: 3000, // 3 seconds between batches
        maxRetries: 1,
        onProgress: (stats) => {
          // Progress updates logged automatically
        },
        onComplete: (stats) => {
          console.log(`\n🎉 Background indexing complete! ${stats.processed}/${stats.total} photos indexed.`);
        },
      });
    } else {
      console.log('✓ All photos already indexed!');
    }
  }, 5000);
}
