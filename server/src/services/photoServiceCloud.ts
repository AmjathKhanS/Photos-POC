/**
 * Cloud-Ready Photo Service
 *
 * This is a MODIFIED version of photoService.ts that works with both:
 * - Local filesystem (current setup)
 * - Cloudinary cloud storage (for deployment)
 *
 * USAGE:
 * 1. For LOCAL: Set PHOTOS_DIR=/path/to/photos (current behavior)
 * 2. For CLOUD: Set PHOTOS_DIR=cloudinary + CLOUDINARY_URL
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import mime from 'mime-types';
import { getStorageProvider, isCloudStorage } from './cloudStorage.js';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage configuration
const STORAGE_MODE = process.env.PHOTOS_DIR === 'cloudinary' ? 'cloud' : 'local';
const PHOTOS_DIR = process.env.PHOTOS_DIR;

if (!PHOTOS_DIR) {
  console.error('ERROR: PHOTOS_DIR environment variable is required!');
  process.exit(1);
}

// Database for Cloudinary URLs
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/faces.db');
let db: Database.Database | null = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
  }
  return db;
}

// Configuration
const THUMBNAIL_SIZE = parseInt(process.env.MAX_THUMBNAIL_SIZE || '800');

/**
 * Get Cloudinary URL for a local path
 */
function getCloudinaryUrl(localPath: string): string | null {
  if (STORAGE_MODE !== 'cloud') return null;

  const database = getDb();
  const query = database.prepare('SELECT cloudinary_url FROM cloudinary_urls WHERE local_path = ?');
  const result = query.get(localPath) as { cloudinary_url: string } | undefined;
  return result?.cloudinary_url || null;
}

/**
 * Get photo metadata from database
 */
function getPhotoMetadata(filename: string): { path: string; id: number } | null {
  const database = getDb();
  const query = database.prepare('SELECT id, path FROM photos WHERE filename = ?');
  const result = query.get(filename) as { id: number; path: string } | undefined;
  return result || null;
}

/**
 * Get thumbnail - CLOUD AWARE
 *
 * LOCAL MODE: Generate thumbnail using Sharp
 * CLOUD MODE: Return Cloudinary URL with transformation
 */
export async function getThumbnail(filename: string): Promise<{ buffer: Buffer; contentType: string } | { url: string }> {
  const photoMeta = getPhotoMetadata(filename);
  if (!photoMeta) {
    throw new Error(`Photo not found: ${filename}`);
  }

  // ========== CLOUD MODE ==========
  if (STORAGE_MODE === 'cloud') {
    const cloudinaryUrl = getCloudinaryUrl(photoMeta.path);

    if (cloudinaryUrl) {
      // Return Cloudinary URL with thumbnail transformation
      // w_800,h_800,c_limit,q_90,f_auto = max 800px, quality 90%, auto format
      const thumbnailUrl = cloudinaryUrl.replace(
        '/upload/',
        `/upload/w_${THUMBNAIL_SIZE},h_${THUMBNAIL_SIZE},c_limit,q_90,f_auto/`
      );

      return { url: thumbnailUrl } as any;
    }

    // Fallback: Photo not in Cloudinary yet, might still be local
    console.warn(`Photo ${filename} not found in Cloudinary, attempting local fallback`);
    // Fall through to local mode
  }

  // ========== LOCAL MODE ==========
  const fullPath = path.join(PHOTOS_DIR, photoMeta.path);

  // Check if file exists
  try {
    await fs.access(fullPath);
  } catch {
    throw new Error(`Photo file not found: ${fullPath}`);
  }

  // Read file
  const fileBuffer = await fs.readFile(fullPath);
  const ext = path.extname(fullPath).toLowerCase();

  // Handle HEIC conversion
  let inputBuffer = fileBuffer;
  let mimeType = mime.lookup(fullPath) || 'application/octet-stream';

  if (ext === '.heic') {
    const jpegBuffer = await heicConvert({
      buffer: fileBuffer,
      format: 'JPEG',
      quality: 0.9
    });
    inputBuffer = Buffer.from(jpegBuffer);
    mimeType = 'image/jpeg';
  }

  // Generate thumbnail with Sharp
  const thumbnailBuffer = await sharp(inputBuffer)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  return {
    buffer: thumbnailBuffer,
    contentType: 'image/jpeg'
  };
}

/**
 * Get full image - CLOUD AWARE
 *
 * LOCAL MODE: Read from filesystem
 * CLOUD MODE: Return Cloudinary URL
 */
export async function getFullImage(filename: string): Promise<{ buffer: Buffer; contentType: string } | { url: string }> {
  const photoMeta = getPhotoMetadata(filename);
  if (!photoMeta) {
    throw new Error(`Photo not found: ${filename}`);
  }

  // ========== CLOUD MODE ==========
  if (STORAGE_MODE === 'cloud') {
    const cloudinaryUrl = getCloudinaryUrl(photoMeta.path);

    if (cloudinaryUrl) {
      // Return Cloudinary URL with quality optimization
      // q_auto:best,f_auto = best quality, auto format
      const fullImageUrl = cloudinaryUrl.replace(
        '/upload/',
        '/upload/q_auto:best,f_auto/'
      );

      return { url: fullImageUrl } as any;
    }

    console.warn(`Photo ${filename} not found in Cloudinary, attempting local fallback`);
  }

  // ========== LOCAL MODE ==========
  const fullPath = path.join(PHOTOS_DIR, photoMeta.path);

  try {
    await fs.access(fullPath);
  } catch {
    throw new Error(`Photo file not found: ${fullPath}`);
  }

  const fileBuffer = await fs.readFile(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  let mimeType = mime.lookup(fullPath) || 'application/octet-stream';

  // Handle HEIC
  if (ext === '.heic') {
    const jpegBuffer = await heicConvert({
      buffer: fileBuffer,
      format: 'JPEG',
      quality: 0.95
    });
    return {
      buffer: Buffer.from(jpegBuffer),
      contentType: 'image/jpeg'
    };
  }

  return {
    buffer: fileBuffer,
    contentType: mimeType
  };
}

/**
 * Get photo list - CLOUD AWARE
 *
 * Returns photos with appropriate URLs based on storage mode
 */
export async function getPhotoList(): Promise<Array<any>> {
  const database = getDb();
  const query = database.prepare(`
    SELECT id, filename, path, created_at, taken_at, width, height, size
    FROM photos
    ORDER BY taken_at DESC, created_at DESC
  `);

  const photos = query.all() as Array<any>;

  return photos.map(photo => {
    let thumbnailUrl = `/api/photos/thumbnail/${photo.filename}`;
    let fullUrl = `/api/photos/full/${photo.filename}`;

    // In cloud mode, check if we have Cloudinary URL
    if (STORAGE_MODE === 'cloud') {
      const cloudinaryUrl = getCloudinaryUrl(photo.path);
      if (cloudinaryUrl) {
        // Use Cloudinary URLs directly
        thumbnailUrl = cloudinaryUrl.replace(
          '/upload/',
          `/upload/w_${THUMBNAIL_SIZE},h_${THUMBNAIL_SIZE},c_limit,q_90,f_auto/`
        );
        fullUrl = cloudinaryUrl.replace('/upload/', '/upload/q_auto:best,f_auto/');
      }
    }

    return {
      ...photo,
      thumbnailUrl,
      fullUrl,
      mimeType: mime.lookup(photo.filename) || 'application/octet-stream'
    };
  });
}

/**
 * Log storage configuration
 */
export function logPhotoServiceConfig() {
  console.log('📸 Photo Service Configuration:');
  console.log(`   Storage Mode: ${STORAGE_MODE}`);
  if (STORAGE_MODE === 'cloud') {
    console.log(`   ✅ Using Cloudinary for photos`);
    console.log(`   ✅ Thumbnails generated by Cloudinary`);
    console.log(`   ✅ No server-side Sharp processing`);
  } else {
    console.log(`   Photos Directory: ${PHOTOS_DIR}`);
    console.log(`   ✅ Using local filesystem`);
    console.log(`   ✅ Thumbnails generated by Sharp`);
  }
}
