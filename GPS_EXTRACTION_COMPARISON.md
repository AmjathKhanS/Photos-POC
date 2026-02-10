# GPS Extraction: sharp vs exiftool-vendored

## Why Not Use `sharp` (Current Library)?

You're already using `sharp` for thumbnails and image processing. Why add another library?

### Problem with `sharp` for GPS

```typescript
// Using sharp (what you have now)
import sharp from 'sharp';

const metadata = await sharp('/path/to/photo.jpg').metadata();
console.log(metadata);

// Output:
{
  width: 4032,
  height: 3024,
  format: 'jpeg',
  exif: <Buffer 49 49 2a 00...>, // Raw binary buffer ❌
  // GPS data is buried in binary format!
}
```

**Issues**:
1. ❌ GPS data is in **raw binary buffer** - hard to parse
2. ❌ Doesn't automatically convert coordinates (need manual parsing)
3. ❌ Misses many GPS fields (altitude, timestamp, direction)
4. ❌ No coordinate reference handling (N/S, E/W confusion)
5. ❌ Doesn't work well with HEIC/RAW formats

---

## Solution: `exiftool-vendored`

```typescript
// Using exiftool-vendored (recommended)
import { exiftool } from 'exiftool-vendored';

const tags = await exiftool.read('/path/to/photo.jpg');

// Output: Clean, parsed GPS data ✅
{
  GPSLatitude: 47.6062,        // Already converted to decimal
  GPSLongitude: -122.3321,     // Negative = West
  GPSAltitude: 10.5,           // meters above sea level
  GPSDateStamp: '2024:01:15',
  GPSTimeStamp: '14:30:45',
  GPSSpeed: 0,                 // km/h when photo taken
  GPSImgDirection: 45.5        // Compass direction camera faced
}
```

**Benefits**:
1. ✅ GPS data already parsed and converted
2. ✅ Handles coordinate references automatically
3. ✅ Extracts ALL GPS fields (not just lat/long)
4. ✅ Works with ALL formats (JPEG, PNG, HEIC, TIFF, RAW)
5. ✅ Built-in error handling
6. ✅ Includes exiftool binary (no system dependency)

---

## Real-World Example

### Scenario: iPhone Photo with GPS

**Using sharp**:
```typescript
const metadata = await sharp('IMG_1234.HEIC').metadata();
// Result: undefined or incomplete GPS ❌
// Manual parsing needed:
//   - Convert DMS to decimal
//   - Handle N/S, E/W references
//   - Extract from binary buffer
//   - 50+ lines of parsing code
```

**Using exiftool-vendored**:
```typescript
const tags = await exiftool.read('IMG_1234.HEIC');
const gps = {
  lat: tags.GPSLatitude,   // 37.7749 (already decimal)
  lon: tags.GPSLongitude,  // -122.4194 (negative = West)
  alt: tags.GPSAltitude    // 15.2 meters
};
// Result: Clean GPS data in 5 lines ✅
```

---

## Feature Comparison Table

| Feature | sharp | exiftool-vendored |
|---------|-------|-------------------|
| **GPS Extraction** | Raw binary | ✅ Parsed, ready to use |
| **Coordinate Conversion** | Manual | ✅ Automatic (DMS → Decimal) |
| **Altitude** | Missing | ✅ Included |
| **GPS Timestamp** | Missing | ✅ Included |
| **Direction/Speed** | Missing | ✅ Included |
| **HEIC Support** | Basic | ✅ Full support |
| **RAW Formats** | Limited | ✅ Full support (CR2, NEF, ARW) |
| **Error Handling** | Manual | ✅ Built-in |
| **Installation** | Simple | ✅ Includes binary (no system deps) |
| **Bundle Size** | Small | Medium (includes exiftool) |

---

## Code Example: Complete GPS Extraction

### With exiftool-vendored (Recommended)

```typescript
import { exiftool } from 'exiftool-vendored';

async function extractGPS(photoPath: string) {
  try {
    const tags = await exiftool.read(photoPath);

    // Check if GPS exists
    if (!tags.GPSLatitude || !tags.GPSLongitude) {
      return null; // No GPS data
    }

    // GPS data is already in perfect format!
    return {
      latitude: tags.GPSLatitude,    // 47.6062
      longitude: tags.GPSLongitude,  // -122.3321
      altitude: tags.GPSAltitude,    // 10.5 meters
      timestamp: tags.GPSDateStamp,  // '2024:01:15'
      direction: tags.GPSImgDirection // 45.5 degrees
    };

  } catch (error) {
    console.error('Failed to read GPS:', error);
    return null;
  }
}

// Usage
const gps = await extractGPS('/path/to/photo.jpg');
if (gps) {
  console.log(`Photo taken at: ${gps.latitude}, ${gps.longitude}`);
}
```

**Result**: 20 lines of clean code ✅

---

### With sharp (Current) - For Comparison

```typescript
import sharp from 'sharp';

async function extractGPS(photoPath: string) {
  try {
    const metadata = await sharp(photoPath).metadata();

    if (!metadata.exif) {
      return null; // No EXIF data
    }

    // Now you need to:
    // 1. Parse the binary exif buffer
    // 2. Find GPS IFD tags
    // 3. Convert DMS (degrees/minutes/seconds) to decimal
    // 4. Handle N/S/E/W references
    // 5. Extract altitude (different format)
    // 6. Handle different EXIF versions

    // This requires additional libraries like:
    // - exif-parser
    // - piexifjs
    // - exif-reader

    // And 100+ lines of parsing code...

    // Example of manual conversion needed:
    // GPS: 47° 36' 22.3" N, 122° 19' 55.6" W
    // → Convert to: 47.6062, -122.3321

    return null; // Too complex! ❌

  } catch (error) {
    return null;
  }
}
```

**Result**: Needs 100+ lines + extra library ❌

---

## Performance Comparison

| Operation | sharp | exiftool-vendored |
|-----------|-------|-------------------|
| Read GPS from JPEG | ~5ms | ~15ms |
| Read GPS from HEIC | ~10ms | ~20ms |
| Memory usage | Low | Medium |
| Parse complexity | High (manual) | Low (automatic) |

**Verdict**: exiftool-vendored is **slightly slower** (10-15ms per photo) but saves you from writing 100+ lines of parsing code.

---

## Why "vendored"?

**exiftool-vendored** = Node.js wrapper + exiftool binary included

- ✅ No system dependencies (works on Windows, Mac, Linux)
- ✅ No need to install exiftool separately
- ✅ Consistent behavior across platforms
- ✅ Automatic updates

---

## Installation Size

```bash
# exiftool-vendored
npm install exiftool-vendored
# Size: ~30 MB (includes exiftool binary)

# You already have sharp installed:
# Size: ~25 MB
```

**Total**: Only 30 MB extra for complete GPS extraction ✅

---

## Recommendation

**Use BOTH libraries together**:
- ✅ **sharp**: Image processing (thumbnails, resize) ← Keep using this
- ✅ **exiftool-vendored**: GPS/EXIF extraction ← Add this for locations

Your code:
```typescript
// For image processing (keep doing this)
const thumbnail = await sharp(imageBuffer)
  .resize(200, 200)
  .jpeg({ quality: 60 })
  .toBuffer();

// For GPS extraction (add this)
const gps = await exiftool.read(filePath);
if (gps.GPSLatitude) {
  // Save location to database
  await savePhotoLocation({
    filename,
    latitude: gps.GPSLatitude,
    longitude: gps.GPSLongitude
  });
}
```

---

## Summary

### Why exiftool-vendored?

1. ✅ **Ready to use**: GPS data already parsed
2. ✅ **Complete**: All GPS fields (lat, lon, alt, time, direction)
3. ✅ **Accurate**: Handles all coordinate formats correctly
4. ✅ **Universal**: Works with ALL photo formats (JPEG, HEIC, RAW)
5. ✅ **Simple**: 5 lines vs 100+ lines of parsing code
6. ✅ **Reliable**: Industry standard (exiftool is used by pros)

### Cost

- **Time saved**: 4-6 hours of GPS parsing code
- **Bundle size**: +30 MB
- **Performance**: +10-15ms per photo (negligible)

**Worth it?** Absolutely! ✅
