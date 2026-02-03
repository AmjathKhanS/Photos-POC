# Location-Based Photo Organization - Implementation Approach

## Overview

Enable users to browse, search, and organize photos by **geographic location** using GPS EXIF data embedded in photos.

---

## Feature Goals

### Core Features:
1. **Automatic Location Extraction** - Read GPS data from photo EXIF
2. **Location Grouping** - Group photos by city, country, or custom areas
3. **Map View** - Display photos on an interactive map
4. **Location Search** - "Show me photos from Paris"
5. **Reverse Geocoding** - Convert GPS coordinates to place names
6. **Location Timeline** - "Places I visited in 2024"

### Advanced Features:
7. **Location Clustering** - Auto-group nearby photos
8. **Trip Detection** - Identify vacations/trips automatically
9. **Location Statistics** - Most visited places, countries visited
10. **Privacy Controls** - Strip/manage location data

---

## Technical Approach

### Phase 1: Location Extraction (Backend)

#### 1.1 Extract GPS from EXIF
```typescript
// Using exiftool or sharp metadata
interface GPSData {
  latitude: number;      // -90 to 90
  longitude: number;     // -180 to 180
  altitude?: number;     // meters
  timestamp?: string;    // When photo was taken
  accuracy?: number;     // GPS accuracy in meters
}

// EXIF fields to extract:
- GPSLatitude
- GPSLatitudeRef (N/S)
- GPSLongitude
- GPSLongitudeRef (E/W)
- GPSAltitude
- GPSDateStamp
- GPSTimeStamp
```

**Library Options**:
- ✅ **exiftool-vendored** (most comprehensive)
- ✅ **exif-parser** (lightweight, fast)
- ⚠️ **sharp** (basic metadata only)

**Recommendation**: Use `exiftool-vendored` for comprehensive GPS data

#### 1.2 Database Schema
```sql
-- New table: photo_locations
CREATE TABLE photo_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_filename TEXT NOT NULL UNIQUE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude REAL,
  gps_timestamp TIMESTAMP,
  accuracy REAL,

  -- Reverse geocoded data (from external API)
  country TEXT,
  country_code TEXT,
  state TEXT,
  city TEXT,
  address TEXT,
  postal_code TEXT,

  -- Clustering
  location_cluster_id INTEGER,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (photo_filename) REFERENCES photos(filename)
);

-- Indexes for performance
CREATE INDEX idx_photo_locations_coords ON photo_locations(latitude, longitude);
CREATE INDEX idx_photo_locations_city ON photo_locations(city);
CREATE INDEX idx_photo_locations_country ON photo_locations(country);
CREATE INDEX idx_photo_locations_cluster ON photo_locations(location_cluster_id);

-- Location clusters table
CREATE TABLE location_clusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,                    -- "Eiffel Tower area", "Downtown Seattle"
  center_latitude REAL,
  center_longitude REAL,
  radius_meters REAL,           -- Cluster radius
  photo_count INTEGER DEFAULT 0,
  first_visit TIMESTAMP,
  last_visit TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 1.3 Extraction Service
```typescript
// server/src/services/locationService.ts

interface PhotoLocation {
  photo_filename: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  country?: string;
  city?: string;
}

// Extract GPS from photo
async function extractGPSFromPhoto(photoPath: string): Promise<GPSData | null> {
  const exiftool = new ExifTool();
  const metadata = await exiftool.read(photoPath);

  if (!metadata.GPSLatitude || !metadata.GPSLongitude) {
    return null; // No GPS data
  }

  return {
    latitude: convertToDecimal(metadata.GPSLatitude, metadata.GPSLatitudeRef),
    longitude: convertToDecimal(metadata.GPSLongitude, metadata.GPSLongitudeRef),
    altitude: metadata.GPSAltitude,
    timestamp: metadata.GPSDateStamp
  };
}

// Save to database
async function savePhotoLocation(location: PhotoLocation): Promise<void> {
  db.prepare(`
    INSERT OR REPLACE INTO photo_locations
    (photo_filename, latitude, longitude, altitude, country, city)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    location.photo_filename,
    location.latitude,
    location.longitude,
    location.altitude,
    location.country,
    location.city
  );
}
```

---

### Phase 2: Reverse Geocoding

Convert coordinates → place names

#### 2.1 API Options

| Service | Free Tier | Accuracy | Cost |
|---------|-----------|----------|------|
| **Nominatim (OpenStreetMap)** | ✅ Unlimited (1 req/sec) | Good | Free |
| **Google Maps Geocoding** | 40,000/month | Excellent | $5/1000 after |
| **Mapbox Geocoding** | 100,000/month | Excellent | $0.50/1000 after |
| **HERE Geocoding** | 250,000/month | Good | Paid after |
| **LocationIQ** | 5,000/day | Good | Free tier |

**Recommendation**: Start with **Nominatim** (free, unlimited), add Mapbox as premium option

#### 2.2 Reverse Geocoding Implementation
```typescript
// Using Nominatim (OpenStreetMap)
async function reverseGeocode(lat: number, lon: number): Promise<PlaceInfo> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'PhotoViewer/1.0' // Required by Nominatim
    }
  });

  const data = await response.json();

  return {
    country: data.address.country,
    country_code: data.address.country_code,
    state: data.address.state,
    city: data.address.city || data.address.town || data.address.village,
    address: data.display_name,
    postal_code: data.address.postcode
  };
}

// Cache results to avoid repeated API calls
const geocodeCache = new Map<string, PlaceInfo>();

async function reverseGeocodeWithCache(lat: number, lon: number): Promise<PlaceInfo> {
  // Round to 3 decimal places (~100m accuracy) for caching
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  const placeInfo = await reverseGeocode(lat, lon);
  geocodeCache.set(cacheKey, placeInfo);

  return placeInfo;
}
```

#### 2.3 Rate Limiting
```typescript
// Respect API rate limits (Nominatim: max 1 req/sec)
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      await fn();
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 req/sec
    }

    this.processing = false;
  }
}
```

---

### Phase 3: Location Clustering

Group nearby photos into meaningful locations

#### 3.1 Clustering Algorithm

**DBSCAN** (Density-Based Spatial Clustering)
- Groups photos within a radius (e.g., 500m)
- Identifies "noise" (isolated photos)
- Works well for travel photos

```typescript
// Simple clustering by distance
function clusterLocations(locations: PhotoLocation[], radiusMeters: number = 500): LocationCluster[] {
  const clusters: LocationCluster[] = [];
  const visited = new Set<string>();

  for (const location of locations) {
    if (visited.has(location.photo_filename)) continue;

    // Find all nearby photos
    const nearby = locations.filter(loc => {
      const distance = calculateDistance(
        location.latitude, location.longitude,
        loc.latitude, loc.longitude
      );
      return distance <= radiusMeters;
    });

    if (nearby.length >= 3) { // Minimum cluster size
      clusters.push({
        id: clusters.length + 1,
        photos: nearby,
        center: calculateCentroid(nearby),
        radius: radiusMeters,
        name: await generateClusterName(nearby[0]) // From reverse geocoding
      });

      nearby.forEach(loc => visited.add(loc.photo_filename));
    }
  }

  return clusters;
}

// Calculate distance between two GPS points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}
```

---

### Phase 4: Frontend UI

#### 4.1 UI Components

```
┌──────────────────────────────────────┐
│  📍 Places (Locations View)          │
├──────────────────────────────────────┤
│  🗺️ Map View    📋 List View         │
├──────────────────────────────────────┤
│                                       │
│  ┌─────────────────────────────────┐ │
│  │       Interactive Map            │ │
│  │  📍 Paris (125 photos)           │ │
│  │  📍 London (45 photos)           │ │
│  │  📍 New York (89 photos)         │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Countries:                           │
│  🇫🇷 France (125)  🇬🇧 UK (45)        │
│                                       │
│  Cities:                              │
│  📍 Paris (125)   📍 London (45)      │
│  📍 New York (89) 📍 Tokyo (67)       │
└──────────────────────────────────────┘
```

#### 4.2 Map Libraries

| Library | Size | Features | Free? |
|---------|------|----------|-------|
| **Leaflet** | 39KB | Open source, simple | ✅ Yes |
| **Mapbox GL JS** | 500KB | Beautiful, fast | ✅ Free tier |
| **Google Maps** | ~100KB | Comprehensive | ⚠️ Requires API key |
| **react-map-gl** | Small | React wrapper for Mapbox | ✅ Yes |

**Recommendation**: **Leaflet** + **OpenStreetMap** (100% free, no API key)

#### 4.3 React Components

```typescript
// client/src/components/LocationsView.tsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

interface LocationsViewProps {
  onLocationClick: (location: LocationCluster) => void;
}

export const LocationsView: React.FC<LocationsViewProps> = ({ onLocationClick }) => {
  const [locations, setLocations] = useState<LocationCluster[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  useEffect(() => {
    // Fetch location clusters
    fetch('/api/locations/clusters')
      .then(res => res.json())
      .then(data => setLocations(data));
  }, []);

  return (
    <div className="locations-view">
      <div className="view-controls">
        <button onClick={() => setViewMode('map')}>🗺️ Map</button>
        <button onClick={() => setViewMode('list')}>📋 List</button>
      </div>

      {viewMode === 'map' ? (
        <MapContainer center={[20, 0]} zoom={2}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {locations.map(location => (
            <Marker
              key={location.id}
              position={[location.center_latitude, location.center_longitude]}
            >
              <Popup>
                <div onClick={() => onLocationClick(location)}>
                  <h3>{location.name}</h3>
                  <p>{location.photo_count} photos</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      ) : (
        <LocationList locations={locations} onClick={onLocationClick} />
      )}
    </div>
  );
};
```

---

### Phase 5: API Endpoints

```typescript
// server/src/routes/locations.ts

// GET /api/locations - Get all unique locations
router.get('/', async (req, res) => {
  const locations = db.prepare(`
    SELECT city, country, COUNT(*) as photo_count,
           AVG(latitude) as avg_lat, AVG(longitude) as avg_lon
    FROM photo_locations
    WHERE city IS NOT NULL
    GROUP BY city, country
    ORDER BY photo_count DESC
  `).all();

  res.json(locations);
});

// GET /api/locations/clusters - Get location clusters
router.get('/clusters', async (req, res) => {
  const clusters = db.prepare(`
    SELECT * FROM location_clusters
    ORDER BY photo_count DESC
  `).all();

  res.json(clusters);
});

// GET /api/locations/:id/photos - Get photos at a location
router.get('/:id/photos', async (req, res) => {
  const photos = db.prepare(`
    SELECT p.* FROM photos p
    JOIN photo_locations l ON p.filename = l.photo_filename
    WHERE l.location_cluster_id = ?
    ORDER BY p.modifiedAt DESC
  `).all(req.params.id);

  res.json(photos);
});

// GET /api/locations/search?q=Paris - Search locations
router.get('/search', async (req, res) => {
  const query = `%${req.query.q}%`;
  const locations = db.prepare(`
    SELECT DISTINCT city, country, COUNT(*) as count
    FROM photo_locations
    WHERE city LIKE ? OR country LIKE ?
    GROUP BY city, country
  `).all(query, query);

  res.json(locations);
});
```

---

## Implementation Phases

### Phase 1: Basic Location Extraction (Week 1)
- ✅ Install exiftool-vendored
- ✅ Create photo_locations table
- ✅ Extract GPS from photos during indexing
- ✅ Store lat/lon in database
- ✅ Display count of photos with location

### Phase 2: Reverse Geocoding (Week 2)
- ✅ Integrate Nominatim API
- ✅ Add city/country columns
- ✅ Reverse geocode existing GPS data
- ✅ Show locations list (text-based)

### Phase 3: Location Clustering (Week 3)
- ✅ Implement clustering algorithm
- ✅ Create location_clusters table
- ✅ Auto-generate cluster names
- ✅ Group photos by cluster

### Phase 4: Map View (Week 4)
- ✅ Add Leaflet + OpenStreetMap
- ✅ Show markers for each location
- ✅ Click marker → view photos
- ✅ Zoom/pan controls

### Phase 5: Advanced Features (Future)
- ⏳ Trip detection
- ⏳ Location timeline
- ⏳ Heatmap view
- ⏳ Privacy controls

---

## Dependencies

### Backend:
```json
{
  "exiftool-vendored": "^25.0.0",  // GPS extraction
  "node-fetch": "^3.3.0"            // API calls
}
```

### Frontend:
```json
{
  "leaflet": "^1.9.4",              // Map library
  "react-leaflet": "^4.2.1"         // React integration
}
```

---

## Privacy Considerations

### 1. User Controls
- ✅ Option to strip GPS from photos
- ✅ Option to disable location features
- ✅ Don't show exact addresses (only city/country)

### 2. Data Security
- ✅ Don't expose GPS coordinates in public APIs
- ✅ Round coordinates to ~100m for privacy
- ✅ Allow users to delete location data

### 3. UI Warnings
```
⚠️ Some photos contain GPS location data
   [View Locations] [Strip GPS Data]
```

---

## Performance Optimization

### 1. Lazy Loading
- Extract GPS during indexing (background)
- Reverse geocode in batches (1 req/sec limit)
- Cache reverse geocode results

### 2. Database Indexes
- Index on (latitude, longitude) for spatial queries
- Index on city, country for grouping

### 3. Frontend
- Only render visible markers on map
- Use marker clustering for dense areas
- Lazy load photos when location clicked

---

## Testing Strategy

### Test Cases:
1. ✅ Photo with GPS → Location extracted
2. ✅ Photo without GPS → No error
3. ✅ Multiple photos same location → Clustered
4. ✅ Photos across countries → Grouped correctly
5. ✅ Reverse geocoding → Correct city/country
6. ✅ Map view → Markers display correctly

---

## Cost Estimate

### Free Tier (Recommended Start):
- **Nominatim**: Unlimited, free
- **OpenStreetMap**: Free tiles
- **Leaflet**: Open source
- **Total cost**: $0/month ✅

### Premium (If needed):
- **Mapbox**: $5/month for 100k requests
- **Google Maps**: $200 credit/month
- **Total**: ~$5-10/month for heavy usage

---

## Summary

**Best Approach**:
1. Start with **GPS extraction** + **filename-based grouping**
2. Add **Nominatim** reverse geocoding (free, unlimited)
3. Use **Leaflet** + **OpenStreetMap** for map view (free)
4. Implement **clustering** to group nearby photos
5. Upgrade to **Mapbox** if needed for better UX

**Timeline**: 4-6 weeks for full implementation
**Cost**: $0 to start, ~$5/month for premium features

---

**Want to start implementing?** I recommend beginning with Phase 1 (GPS extraction) - it's the foundation for everything else!
