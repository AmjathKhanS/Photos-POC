#!/usr/bin/env node
/**
 * Extract GPS from ALL photos
 * This runs regardless of indexing status
 */

import { register } from 'tsx/esm/api';
const unregister = register();

try {
  console.log('📍 Starting GPS extraction for all photos...\n');

  const { getPhotoList } = await import('./src/services/photoService.ts');
  const { extractGPSFromPhoto, savePhotoLocation } = await import('./src/services/locationService.ts');
  const path = await import('path');

  const PHOTOS_DIR = process.env.PHOTOS_DIR || 'D:/Photos Ai/mobile';

  console.log('📂 Photos directory:', PHOTOS_DIR);
  console.log('🔍 Loading photo list...\n');

  const photos = await getPhotoList();
  console.log(`📊 Found ${photos.length} photos\n`);

  let processed = 0;
  let withGPS = 0;
  let withoutGPS = 0;
  let errors = 0;

  console.log('🚀 Extracting GPS data...\n');

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
        if (i < 10 || i % 50 === 0) {
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

  console.log('\n' + '='.repeat(60));
  console.log('✅ GPS Extraction Complete!\n');
  console.log('📊 Results:');
  console.log(`   Total photos: ${photos.length}`);
  console.log(`   With GPS: ${withGPS}`);
  console.log(`   Without GPS: ${withoutGPS}`);
  console.log(`   Errors: ${errors}`);
  console.log('='.repeat(60));

  if (withGPS > 0) {
    console.log('\n🎉 Success! Your photos with GPS are now in the database!');
    console.log('📍 Go to Places tab and refresh to see them!');
  } else {
    console.log('\n⚠️  No photos with GPS data were found.');
    console.log('   This is normal for screenshots and photos from cameras without GPS.');
  }

} catch (error) {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  unregister();
  process.exit(1);
}

unregister();
process.exit(0);
