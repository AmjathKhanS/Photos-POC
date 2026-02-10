#!/usr/bin/env node
/**
 * Extract GPS from ALL photos - FIXED VERSION
 */

import { register } from 'tsx/esm/api';
const unregister = register();

async function main() {
  try {
    console.log('📍 Starting GPS extraction for all photos...\n');

    const { getPhotoList } = await import('./src/services/photoService.js');
    const { extractGPSFromPhoto, savePhotoLocation } = await import('./src/services/locationService.js');
    const path = await import('path');

    const PHOTOS_DIR = process.env.PHOTOS_DIR || 'D:/Photos Ai/mobile';

    console.log('📂 Photos directory:', PHOTOS_DIR);
    console.log('🔍 Loading photo list...\n');

    const photos = await getPhotoList();
    console.log(`📊 Found ${photos.length} photos\n`);
    console.log('🚀 Starting GPS extraction...\n');

    let processed = 0;
    let withGPS = 0;
    let withoutGPS = 0;
    let errors = 0;

    // Process photos one by one
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const photoPath = path.join(PHOTOS_DIR, photo.filename);

      try {
        const gpsData = await extractGPSFromPhoto(photoPath);

        if (gpsData) {
          await savePhotoLocation({
            photo_filename: photo.filename,
            ...gpsData
          });
          withGPS++;
          console.log(`✅ [${i + 1}/${photos.length}] ${photo.filename} - GPS: ${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)}`);
        } else {
          withoutGPS++;
          // Only show first 10 "no GPS" messages to reduce spam
          if (withoutGPS <= 10) {
            console.log(`⊘  [${i + 1}/${photos.length}] ${photo.filename} - No GPS`);
          }
        }

        processed++;

        // Progress update every 50 photos
        if (processed % 50 === 0) {
          console.log(`\n📊 Progress: ${processed}/${photos.length} (${Math.round(processed/photos.length*100)}%)`);
          console.log(`   With GPS: ${withGPS}, Without GPS: ${withoutGPS}\n`);
        }

      } catch (error) {
        errors++;
        console.log(`❌ [${i + 1}/${photos.length}] ${photo.filename} - Error: ${error.message}`);
      }
    }

    // Final results
    console.log('\n' + '='.repeat(60));
    console.log('✅ GPS Extraction Complete!\n');
    console.log('📊 Final Results:');
    console.log(`   Total photos: ${photos.length}`);
    console.log(`   With GPS: ${withGPS}`);
    console.log(`   Without GPS: ${withoutGPS}`);
    console.log(`   Errors: ${errors}`);
    console.log('='.repeat(60) + '\n');

    if (withGPS > 0) {
      console.log('🎉 Success! Your photos with GPS are now in the database!');
      console.log('📍 Go to Places tab in your browser and refresh to see them!\n');
    } else {
      console.log('⚠️  No photos with GPS data were found.');
      console.log('   This is normal for screenshots and photos from cameras without GPS.\n');
    }

    return withGPS;

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run main function and ensure proper exit
main()
  .then((count) => {
    console.log(`Extracted GPS from ${count} photos.`);
    unregister();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    unregister();
    process.exit(1);
  });
