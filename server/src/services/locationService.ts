/**
 * Location Service
 * Handles GPS extraction from photos and location data management
 */

import { exiftool } from 'exiftool-vendored';
import * as locationDb from './locationDb.js';

export interface GPSData {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp?: string;
  accuracy?: number;
}

export interface PhotoLocation extends GPSData {
  photo_filename: string;
  country?: string;
  country_code?: string;
  state?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  location_cluster_id?: number;
}

/**
 * Extract GPS data from a photo file
 * @param photoPath - Full path to the photo file
 * @returns GPS data or null if no GPS found
 */
export async function extractGPSFromPhoto(photoPath: string): Promise<GPSData | null> {
  try {
    const tags = await exiftool.read(photoPath);

    // Check if photo has GPS data
    if (!tags.GPSLatitude || !tags.GPSLongitude) {
      return null; // No GPS data in this photo
    }

    // exiftool-vendored automatically converts to decimal degrees
    // and handles N/S/E/W references (negative for S/W)
    const gpsData: GPSData = {
      latitude: tags.GPSLatitude,
      longitude: tags.GPSLongitude,
    };

    // Add optional fields if available
    if (tags.GPSAltitude !== undefined) {
      gpsData.altitude = tags.GPSAltitude;
    }

    // Combine GPS date and time if available
    if (tags.GPSDateStamp && tags.GPSTimeStamp) {
      try {
        // GPSDateStamp format: "2024:01:15"
        // GPSTimeStamp format: "14:30:45.000" or [14, 30, 45]
        let timeStr = tags.GPSTimeStamp;
        if (Array.isArray(timeStr)) {
          timeStr = timeStr.join(':');
        }
        gpsData.timestamp = `${tags.GPSDateStamp} ${timeStr}`;
      } catch {
        // Ignore timestamp parsing errors
      }
    }

    // Some cameras provide GPS accuracy/precision
    if (tags.GPSHPositioningError !== undefined) {
      gpsData.accuracy = tags.GPSHPositioningError;
    }

    return gpsData;

  } catch (error: any) {
    // Don't log errors for every photo without GPS
    // Only log if it's an actual parsing error
    if (error.message && !error.message.includes('No GPS')) {
      console.error(`Error extracting GPS from ${photoPath}:`, error.message);
    }
    return null;
  }
}

/**
 * Save photo location to database
 * @param location - Photo location data
 */
export async function savePhotoLocation(location: PhotoLocation): Promise<void> {
  try {
    await locationDb.upsertPhotoLocation(location);
  } catch (error: any) {
    console.error(`Error saving location for ${location.photo_filename}:`, error.message);
    throw error;
  }
}

/**
 * Get location data for a specific photo
 * @param filename - Photo filename
 * @returns Location data or null if not found
 */
export function getPhotoLocation(filename: string): PhotoLocation | null {
  return locationDb.getPhotoLocation(filename);
}

/**
 * Get all photos with location data
 * @returns Array of photo locations
 */
export function getAllPhotoLocations(): PhotoLocation[] {
  return locationDb.getAllPhotoLocations();
}

/**
 * Get count of photos with location data
 * @returns Number of photos with GPS coordinates
 */
export function getPhotoLocationCount(): number {
  return locationDb.getPhotoLocationCount();
}

/**
 * Get all unique cities with photo counts
 * @returns Array of cities with photo counts
 */
export function getCitiesWithCounts(): Array<{ city: string; country: string; count: number; avg_lat: number; avg_lon: number }> {
  return locationDb.getCitiesWithCounts();
}

/**
 * Get all unique countries with photo counts
 * @returns Array of countries with photo counts
 */
export function getCountriesWithCounts(): Array<{ country: string; country_code: string; count: number }> {
  return locationDb.getCountriesWithCounts();
}

/**
 * Delete location data for a photo
 * @param filename - Photo filename
 */
export function deletePhotoLocation(filename: string): void {
  locationDb.deletePhotoLocation(filename);
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Cleanup: Close exiftool when shutting down
 */
export async function cleanup(): Promise<void> {
  try {
    await exiftool.end();
  } catch (error) {
    // Ignore cleanup errors
  }
}
