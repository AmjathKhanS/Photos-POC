#!/usr/bin/env node
/**
 * Test GPS Extraction
 * Checks a few photos to see if they have GPS metadata
 */

import { exiftool } from 'exiftool-vendored';
import fs from 'fs/promises';
import path from 'path';

const PHOTOS_DIR = process.env.PHOTOS_DIR || 'D:/Photos Ai/mobile';

async function testGPS() {
  console.log('📍 Testing GPS extraction from photos...\n');
  console.log('Photos directory:', PHOTOS_DIR);

  try {
    const files = await fs.readdir(PHOTOS_DIR);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|heic)$/i.test(f)).slice(0, 20);

    console.log(`\nChecking ${imageFiles.length} photos for GPS data...\n`);

    let foundGPS = 0;

    for (const filename of imageFiles) {
      const filePath = path.join(PHOTOS_DIR, filename);

      try {
        const tags = await exiftool.read(filePath);

        if (tags.GPSLatitude && tags.GPSLongitude) {
          foundGPS++;
          console.log(`✅ ${filename}`);
          console.log(`   GPS: ${tags.GPSLatitude}, ${tags.GPSLongitude}`);
          if (tags.GPSAltitude) {
            console.log(`   Altitude: ${tags.GPSAltitude}m`);
          }
          console.log('');
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }

    console.log('\n📊 Results:');
    console.log(`   Checked: ${imageFiles.length} photos`);
    console.log(`   With GPS: ${foundGPS} photos`);
    console.log(`   Without GPS: ${imageFiles.length - foundGPS} photos`);

    if (foundGPS > 0) {
      console.log('\n✨ Great! Your photos have GPS data!');
      console.log('   After running the migration, these will appear in Places tab.');
    } else {
      console.log('\n⚠️  None of the checked photos have GPS metadata.');
      console.log('   Photos taken with smartphones usually have GPS data.');
      console.log('   Screenshots and photos from cameras without GPS won\'t have location data.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await exiftool.end();
  }
}

testGPS();
