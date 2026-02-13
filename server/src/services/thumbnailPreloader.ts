import { getPhotoList, getThumbnail } from './photoService.js';

let isPreloading = false;
let preloadProgress = { current: 0, total: 0 };

/**
 * Pre-generate all thumbnails in the background
 * Runs once on server startup
 */
export async function preloadAllThumbnails(): Promise<void> {
  if (isPreloading) {
    console.log('⏳ Thumbnail preloading already in progress...');
    return;
  }

  isPreloading = true;
  console.log('🎨 Starting background thumbnail pre-generation...');

  try {
    const photos = await getPhotoList();
    preloadProgress.total = photos.length;
    preloadProgress.current = 0;

    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 20;
    const batches: string[][] = [];

    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      batches.push(photos.slice(i, i + BATCH_SIZE).map(p => p.filename));
    }

    console.log(`📸 Generating thumbnails for ${photos.length} photos (${batches.length} batches)...`);

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (filename) => {
          try {
            await getThumbnail(filename);
            preloadProgress.current++;

            // Log progress every 50 photos
            if (preloadProgress.current % 50 === 0) {
              const percent = Math.round((preloadProgress.current / preloadProgress.total) * 100);
              console.log(`⚡ Thumbnail progress: ${preloadProgress.current}/${preloadProgress.total} (${percent}%)`);
            }
          } catch (error) {
            // Silently skip failed thumbnails
            preloadProgress.current++;
          }
        })
      );
    }

    console.log(`✅ Thumbnail pre-generation complete! ${preloadProgress.total} thumbnails ready.`);
  } catch (error) {
    console.error('❌ Thumbnail preloading error:', error);
  } finally {
    isPreloading = false;
  }
}

export function getPreloadProgress() {
  return {
    isPreloading,
    progress: preloadProgress
  };
}
