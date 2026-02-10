#!/usr/bin/env node
/**
 * Reverse geocode GPS coordinates to get city/country information
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data/faces.db');

// Rate limiting: Nominatim requires max 1 request per second
const RATE_LIMIT_MS = 1000;

/**
 * Reverse geocode a single coordinate
 */
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PhotoViewerApp/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    const address = data.address || {};

    return {
      country: address.country || null,
      country_code: address.country_code?.toUpperCase() || null,
      state: address.state || address.province || address.region || null,
      city: address.city || address.town || address.village || address.municipality || null,
      postal_code: address.postcode || null,
      address: data.display_name || null
    };
  } catch (error) {
    console.error(`  Error geocoding (${lat}, ${lon}):`, error.message);
    return null;
  }
}

/**
 * Sleep for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🌍 Starting reverse geocoding...\n');
  console.log('Database:', DB_PATH);
  console.log('');

  // Open database
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Get all locations without city/country
  const locations = db.prepare(`
    SELECT id, photo_filename, latitude, longitude, city, country
    FROM photo_locations
    WHERE city IS NULL OR country IS NULL
  `).all();

  console.log(`📊 Found ${locations.length} locations to geocode\n`);

  if (locations.length === 0) {
    console.log('✅ All locations already have city/country data!');
    db.close();
    return;
  }

  // Prepare update statement
  const updateStmt = db.prepare(`
    UPDATE photo_locations
    SET country = ?,
        country_code = ?,
        state = ?,
        city = ?,
        postal_code = ?,
        address = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  let processed = 0;
  let success = 0;
  let failed = 0;

  for (const location of locations) {
    processed++;
    console.log(`[${processed}/${locations.length}] ${location.photo_filename}`);
    console.log(`  GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);

    // Reverse geocode
    const geocode = await reverseGeocode(location.latitude, location.longitude);

    if (geocode) {
      // Update database
      updateStmt.run(
        geocode.country,
        geocode.country_code,
        geocode.state,
        geocode.city,
        geocode.postal_code,
        geocode.address,
        location.id
      );

      console.log(`  ✅ ${geocode.city || '(no city)'}, ${geocode.country || '(no country)'}`);
      success++;
    } else {
      console.log(`  ❌ Failed to geocode`);
      failed++;
    }

    // Rate limiting - wait 1 second between requests
    if (processed < locations.length) {
      await sleep(RATE_LIMIT_MS);
    }

    console.log('');
  }

  console.log('============================================================');
  console.log('✅ Reverse Geocoding Complete!\n');
  console.log('📊 Results:');
  console.log(`   Total: ${locations.length}`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);
  console.log('============================================================\n');

  // Show summary
  const cities = db.prepare(`
    SELECT city, country, COUNT(*) as count
    FROM photo_locations
    WHERE city IS NOT NULL
    GROUP BY city, country
    ORDER BY count DESC
  `).all();

  const countries = db.prepare(`
    SELECT country, COUNT(*) as count
    FROM photo_locations
    WHERE country IS NOT NULL
    GROUP BY country
    ORDER BY count DESC
  `).all();

  if (countries.length > 0) {
    console.log('🌍 Countries:');
    countries.forEach(c => {
      console.log(`   ${c.country}: ${c.count} photos`);
    });
    console.log('');
  }

  if (cities.length > 0) {
    console.log('🏙️ Cities:');
    cities.forEach(c => {
      console.log(`   ${c.city}, ${c.country}: ${c.count} photos`);
    });
    console.log('');
  }

  db.close();
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
