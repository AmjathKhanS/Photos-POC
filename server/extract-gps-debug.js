#!/usr/bin/env node
/**
 * Extract GPS - DEBUG VERSION
 * Shows exactly what's happening
 */

import { register } from 'tsx/esm/api';
const unregister = register();

async function main() {
  try {
    console.log('📍 Starting GPS extraction (DEBUG MODE)...\n');

    console.log('Step 1: Importing modules...');
    const { getPhotoList } = await import('./src/services/photoService.js');
    console.log('✓ photoService imported');

    const { extractGPSFromPhoto, savePhotoLocation } = await import('./src/services/locationService.js');
    console.log('✓ locationService imported');

    const path = await import('path');
    console.log('✓ path imported\n');

    const PHOTOS_DIR = process.env.PHOTOS_DIR || 'D:/Photos Ai/mobile';
    console.log('📂 Photos directory:', PHOTOS_DIR);

    console.log('\nStep 2: Loading photo list...');
    const photos = await getPhotoList();
    console.log(`✓ Found ${photos.length} photos\n`);

    console.log('Step 3: Testing GPS extraction on first 3 photos...\n');

    // Test only first 3 photos
    for (let i = 0; i < Math.min(3, photos.length); i++) {
      const photo = photos[i];
      console.log(`\n[${i + 1}] Processing: ${photo.filename}`);

      const photoPath = path.join(PHOTOS_DIR, photo.filename);
      console.log(`   Path: ${photoPath}`);

      try {
        console.log('   Calling extractGPSFromPhoto...');
        const gpsData = await extractGPSFromPhoto(photoPath);

        if (gpsData) {
          console.log('   ✅ GPS FOUND!');
          console.log('   Latitude:', gpsData.latitude);
          console.log('   Longitude:', gpsData.longitude);

          console.log('   Saving to database...');
          await savePhotoLocation({
            photo_filename: photo.filename,
            ...gpsData
          });
          console.log('   ✅ Saved!');
        } else {
          console.log('   ⊘ No GPS data');
        }
      } catch (error) {
        console.log('   ❌ ERROR:', error.message);
        console.log('   Stack:', error.stack);
      }
    }

    console.log('\n\n✅ Debug test complete!');
    console.log('If this worked, we can process all 403 photos.');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\nExiting...');
    unregister();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    unregister();
    process.exit(1);
  });
