#!/usr/bin/env node
/**
 * Extract GPS with timeout protection
 */

import { register } from 'tsx/esm/api';
const unregister = register();

// Timeout wrapper
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
}

async function main() {
  try {
    console.log('📍 Starting GPS extraction with timeout protection...\n');

    const { getPhotoList } = await import('./src/services/photoService.js');
    const { extractGPSFromPhoto, savePhotoLocation } = await import('./src/services/locationService.js');
    const path = await import('path');

    const PHOTOS_DIR = process.env.PHOTOS_DIR || 'D:/Photos Ai/mobile';
    console.log('📂 Photos directory:', PHOTOS_DIR);

    console.log('🔍 Loading photo list...\n');
    const photos = await getPhotoList();
    console.log(`📊 Found ${photos.length} photos\n`);
    console.log('🚀 Starting GPS extraction (5 second timeout per photo)...\n');

    let withGPS = 0;
    let withoutGPS = 0;
    let errors = 0;
    let timeouts = 0;

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const photoPath = path.join(PHOTOS_DIR, photo.filename);

      try {
        // 5 second timeout per photo
        const gpsData = await withTimeout(
          extractGPSFromPhoto(photoPath),
          5000
        );

        if (gpsData) {
          await savePhotoLocation({
            photo_filename: photo.filename,
            ...gpsData
          });
          withGPS++;
          console.log(`✅ [${i + 1}/${photos.length}] ${photo.filename} - GPS: ${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)}`);
        } else {
          withoutGPS++;
          if (withoutGPS <= 10 || i % 50 === 0) {
            console.log(`⊘  [${i + 1}/${photos.length}] ${photo.filename} - No GPS`);
          }
        }

        // Progress every 50 photos
        if ((i + 1) % 50 === 0) {
          console.log(`\n📊 Progress: ${i + 1}/${photos.length} (${Math.round((i + 1)/photos.length*100)}%)`);
          console.log(`   With GPS: ${withGPS}, Without GPS: ${withoutGPS}, Timeouts: ${timeouts}, Errors: ${errors}\n`);
        }

      } catch (error) {
        if (error.message === 'Timeout') {
          timeouts++;
          console.log(`⏱️  [${i + 1}/${photos.length}] ${photo.filename} - Timeout (skipped)`);
        } else {
          errors++;
          console.log(`❌ [${i + 1}/${photos.length}] ${photo.filename} - Error: ${error.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ GPS Extraction Complete!\n');
    console.log('📊 Final Results:');
    console.log(`   Total photos: ${photos.length}`);
    console.log(`   With GPS: ${withGPS}`);
    console.log(`   Without GPS: ${withoutGPS}`);
    console.log(`   Timeouts: ${timeouts}`);
    console.log(`   Errors: ${errors}`);
    console.log('='.repeat(60) + '\n');

    if (withGPS > 0) {
      console.log('🎉 Success! Your photos with GPS are now in the database!');
      console.log('📍 Go to Places tab and refresh to see them!\n');
    } else {
      console.log('⚠️  No photos with GPS data were found.\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    throw error;
  }
}

main()
  .then(() => {
    console.log('Exiting...');
    unregister();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    unregister();
    process.exit(1);
  });
