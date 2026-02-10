#!/bin/bash
# Quick check of location data in database

echo "📍 Checking location data..."
echo ""

node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/faces.db', { readonly: true });

try {
  const count = db.prepare('SELECT COUNT(*) as count FROM photo_locations').get();
  console.log('📊 Total photos with GPS:', count.count);
  console.log('');

  const countries = db.prepare('SELECT country, COUNT(*) as count FROM photo_locations WHERE country IS NOT NULL GROUP BY country').all();
  if (countries.length > 0) {
    console.log('🌍 Countries:');
    countries.forEach(c => console.log('   ' + c.country + ': ' + c.count + ' photos'));
    console.log('');
  }

  const cities = db.prepare('SELECT city, country, COUNT(*) as count FROM photo_locations WHERE city IS NOT NULL GROUP BY city, country ORDER BY count DESC').all();
  if (cities.length > 0) {
    console.log('🏙️ Cities:');
    cities.forEach(c => console.log('   ' + c.city + ', ' + c.country + ': ' + c.count + ' photos'));
    console.log('');
  }

  if (count.count === 0) {
    console.log('⚠️  No location data found. Run ./extract-gps-wsl.sh to extract GPS data.');
  } else if (cities.length === 0) {
    console.log('⚠️  GPS coordinates found but no city/country names.');
    console.log('   Run reverse geocoding to add location names.');
  } else {
    console.log('✅ Location data is ready! Start the server to view in Places tab.');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  db.close();
}
" 2>&1 | grep -v "Warning"
