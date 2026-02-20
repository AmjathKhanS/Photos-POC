/**
 * Location API Routes
 * Endpoints for accessing photo location data
 */

import express from 'express';
import * as locationService from '../services/locationService.js';
// import { getPhotoByFilename } from '../services/photoService.js'; // Not exported in cloud version

const router = express.Router();

/**
 * GET /api/locations/count
 * Get count of photos with location data
 */
router.get('/count', (req, res) => {
  try {
    const count = locationService.getPhotoLocationCount();
    res.json({ count });
  } catch (error: any) {
    console.error('Error getting location count:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/locations
 * Get all photo locations
 */
router.get('/', (req, res) => {
  try {
    const locations = locationService.getAllPhotoLocations();
    res.json(locations);
  } catch (error: any) {
    console.error('Error getting photo locations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/locations/cities
 * Get all unique cities with photo counts
 */
router.get('/cities', (req, res) => {
  try {
    const cities = locationService.getCitiesWithCounts();
    res.json(cities);
  } catch (error: any) {
    console.error('Error getting cities:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/locations/countries
 * Get all unique countries with photo counts
 */
router.get('/countries', (req, res) => {
  try {
    const countries = locationService.getCountriesWithCounts();
    res.json(countries);
  } catch (error: any) {
    console.error('Error getting countries:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/locations/city/:city/:country
 * Get all photos from a specific city
 */
router.get('/city/:city/:country', async (req, res) => {
  try {
    const { city, country } = req.params;
    const locations = locationService.getPhotosByCity(decodeURIComponent(city), decodeURIComponent(country));

    // Convert location data to full photo objects
    const photoPromises = locations.map(loc => getPhotoByFilename(loc.photo_filename));
    const photos = (await Promise.all(photoPromises)).filter(p => p !== null);

    res.json(photos);
  } catch (error: any) {
    console.error('Error getting photos by city:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/locations/country/:country
 * Get all photos from a specific country
 */
router.get('/country/:country', async (req, res) => {
  try {
    const { country } = req.params;
    const locations = locationService.getPhotosByCountry(decodeURIComponent(country));

    // Convert location data to full photo objects
    const photoPromises = locations.map(loc => getPhotoByFilename(loc.photo_filename));
    const photos = (await Promise.all(photoPromises)).filter(p => p !== null);

    res.json(photos);
  } catch (error: any) {
    console.error('Error getting photos by country:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/locations/:filename
 * Get location data for a specific photo
 */
router.get('/:filename', (req, res) => {
  try {
    const location = locationService.getPhotoLocation(req.params.filename);

    if (!location) {
      return res.status(404).json({ error: 'Location not found for this photo' });
    }

    res.json(location);
  } catch (error: any) {
    console.error('Error getting photo location:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/locations/:filename
 * Delete location data for a specific photo
 */
router.delete('/:filename', (req, res) => {
  try {
    locationService.deletePhotoLocation(req.params.filename);
    res.json({ success: true, message: 'Location data deleted' });
  } catch (error: any) {
    console.error('Error deleting photo location:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/locations/enrich
 * Enrich existing locations with city/country names via reverse geocoding
 * Query param: force=true to re-enrich all locations
 */
router.post('/enrich', async (req, res) => {
  try {
    const forceAll = req.query.force === 'true';
    const locations = locationService.getAllPhotoLocations();

    // Filter locations that don't have city/country data (or force re-enrich all)
    const locationsToEnrich = forceAll
      ? locations
      : locations.filter(loc => !loc.city && !loc.country);

    if (locationsToEnrich.length === 0) {
      return res.json({
        success: true,
        message: 'All locations already have city/country data',
        enriched: 0,
        total: locations.length
      });
    }

    console.log(`🌍 Enriching ${locationsToEnrich.length} locations with reverse geocoding...`);

    let enriched = 0;
    for (const location of locationsToEnrich) {
      try {
        const enrichedLocation = await locationService.enrichLocationData(location, forceAll);

        // Only update if we got new data (or if forcing, always save)
        if (forceAll || enrichedLocation.city || enrichedLocation.country) {
          await locationService.savePhotoLocation(enrichedLocation);
          enriched++;
          console.log(`   ✓ ${location.photo_filename}: ${enrichedLocation.city || '(no city)'}, ${enrichedLocation.country || '(no country)'}`);
        }
      } catch (error) {
        console.error(`   ✗ ${location.photo_filename}:`, error);
      }
    }

    console.log(`✅ Enriched ${enriched}/${locationsToEnrich.length} locations`);

    res.json({
      success: true,
      message: `Successfully enriched ${enriched} locations`,
      enriched,
      total: locations.length,
      skipped: locationsToEnrich.length - enriched
    });
  } catch (error: any) {
    console.error('Error enriching locations:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
