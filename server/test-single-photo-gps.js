#!/usr/bin/env node
/**
 * Test GPS extraction on a single photo
 */

import { register } from 'tsx/esm/api';
const unregister = register();

try {
  const { extractGPSFromPhoto, savePhotoLocation } = await import('./src/services/locationService.ts');
  const path = await import('path');

  const PHOTOS_DIR = process.env.PHOTOS_DIR || 'D:/Photos Ai/mobile';
  const testPhoto = 'IMG_1741.HEIC'; // We know this has GPS

  console.log('📍 Testing GPS extraction on single photo...\n');
  console.log('Photo:', testPhoto);

  const photoPath = path.join(PHOTOS_DIR, testPhoto);
  console.log('Full path:', photoPath);

  console.log('\nExtracting GPS...');
  const gpsData = await extractGPSFromPhoto(photoPath);

  if (gpsData) {
    console.log('✅ GPS found!');
    console.log('   Latitude:', gpsData.latitude);
    console.log('   Longitude:', gpsData.longitude);
    console.log('   Altitude:', gpsData.altitude, 'm');

    console.log('\nSaving to database...');
    await savePhotoLocation({
      photo_filename: testPhoto,
      ...gpsData
    });

    console.log('✅ Saved to database!');

    // Check count
    const { getPhotoLocationCount } = await import('./src/services/locationService.ts');
    const count = getPhotoLocationCount();
    console.log('\n📊 Total photos with location:', count);

  } else {
    console.log('❌ No GPS data found in this photo');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('\nStack:', error.stack);
} finally {
  unregister();
  process.exit(0);
}
