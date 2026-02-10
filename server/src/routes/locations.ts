/**
 * Location API Routes
 * Endpoints for accessing photo location data
 */

import express from 'express';
import * as locationService from '../services/locationService.js';

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
router.get('/city/:city/:country', (req, res) => {
  try {
    const { city, country } = req.params;
    const photos = locationService.getPhotosByCity(city, country);
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
router.get('/country/:country', (req, res) => {
  try {
    const { country } = req.params;
    const photos = locationService.getPhotosByCountry(country);
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

export default router;
