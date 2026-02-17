/**
 * Reverse Geocoding Service
 * Converts GPS coordinates to location names using OpenStreetMap Nominatim
 */

import https from 'https';

export interface ReverseGeocodingResult {
  country?: string;
  country_code?: string;
  state?: string;
  city?: string;
  address?: string;
  postal_code?: string;
}

// Cache to avoid repeated API calls for same coordinates
const geocodeCache = new Map<string, ReverseGeocodingResult>();

// Rate limiting - Nominatim requires max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate cache key from coordinates (rounded to 3 decimal places)
 */
function getCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/**
 * Reverse geocode coordinates to location name
 * Uses OpenStreetMap Nominatim API (free, no API key needed)
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param skipCache - Skip cache and force fresh API call
 * @returns Location information or null if geocoding fails
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  skipCache: boolean = false
): Promise<ReverseGeocodingResult | null> {
  // Check cache first (unless skipCache is true)
  const cacheKey = getCacheKey(latitude, longitude);
  if (!skipCache && geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // Rate limiting - ensure at least 1 second between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

    const response = await new Promise<string>((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'PhotoViewerApp/1.0' // Nominatim requires a user agent
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });

    const data = JSON.parse(response);

    if (!data || data.error) {
      return null;
    }

    const address = data.address || {};

    // Extract city/town/village from various address fields
    // OpenStreetMap uses different fields depending on location type
    let city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.hamlet ||
      address.suburb ||
      address.county ||
      address.state_district;

    // For rural/remote areas without a defined city, use alternative identifiers
    if (!city && address.road) {
      // Use road/locality name as a fallback (e.g., "Chandragad-Mahableshwar")
      city = address.road;
    } else if (!city && address.tourism) {
      // Tourist/landmark areas
      city = address.tourism;
    } else if (!city && (address.state || address.region)) {
      // Use state as last resort
      city = `${address.state || address.region} (Region)`;
    }

    // Extract location details
    const result: ReverseGeocodingResult = {
      country: address.country,
      country_code: address.country_code?.toUpperCase(),
      state: address.state || address.region,
      city: city,
      postal_code: address.postcode,
    };

    // Build a simple address string
    const addressParts = [
      address.road,
      address.suburb || address.neighbourhood,
      result.city,
      result.state
    ].filter(Boolean);

    if (addressParts.length > 0) {
      result.address = addressParts.join(', ');
    }

    // Cache the result
    geocodeCache.set(cacheKey, result);

    return result;

  } catch (error: any) {
    console.error(`Reverse geocoding failed for ${latitude}, ${longitude}:`, error.message);
    return null;
  }
}

/**
 * Clear the geocoding cache (for memory management)
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: geocodeCache.size,
    keys: Array.from(geocodeCache.keys())
  };
}
