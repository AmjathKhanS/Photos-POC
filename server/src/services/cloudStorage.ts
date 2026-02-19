/**
 * Cloud Storage Service
 *
 * Provides abstraction layer for photo storage.
 * Supports both local filesystem and Cloudinary.
 *
 * Usage:
 * - Local: PHOTOS_DIR=/path/to/photos
 * - Cloud: PHOTOS_DIR=cloudinary + CLOUDINARY_URL=cloudinary://...
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage mode detection
const STORAGE_MODE = process.env.PHOTOS_DIR === 'cloudinary' ? 'cloud' : 'local';
const CLOUDINARY_URL = process.env.CLOUDINARY_URL;

if (STORAGE_MODE === 'cloud' && !CLOUDINARY_URL) {
  console.error('❌ ERROR: CLOUDINARY_URL must be set when PHOTOS_DIR=cloudinary');
  process.exit(1);
}

// Database connection
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/faces.db');
let db: Database.Database | null = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
  }
  return db;
}

/**
 * Storage interface
 */
export interface StorageProvider {
  mode: 'local' | 'cloud';
  getThumbnailUrl(filename: string): string;
  getFullImageUrl(filename: string): string;
  getCloudinaryUrl?(localPath: string): string | null;
}

/**
 * Local storage provider
 */
const localProvider: StorageProvider = {
  mode: 'local',
  getThumbnailUrl(filename: string): string {
    return `/api/photos/thumbnail/${filename}`;
  },
  getFullImageUrl(filename: string): string {
    return `/api/photos/full/${filename}`;
  }
};

/**
 * Cloudinary storage provider
 */
const cloudProvider: StorageProvider = {
  mode: 'cloud',

  getThumbnailUrl(filename: string): string {
    // Get Cloudinary URL from database
    const cloudUrl = this.getCloudinaryUrl!(filename);
    if (cloudUrl) {
      // Return Cloudinary URL with transformation for thumbnail
      // w_800,h_800,c_limit,q_90 = max 800px, quality 90%
      return cloudUrl.replace('/upload/', '/upload/w_800,h_800,c_limit,q_90,f_auto/');
    }
    // Fallback to API endpoint
    return `/api/photos/thumbnail/${filename}`;
  },

  getFullImageUrl(filename: string): string {
    // Get Cloudinary URL from database
    const cloudUrl = this.getCloudinaryUrl!(filename);
    if (cloudUrl) {
      // Return full quality Cloudinary URL
      return cloudUrl.replace('/upload/', '/upload/q_auto:best,f_auto/');
    }
    // Fallback to API endpoint
    return `/api/photos/full/${filename}`;
  },

  getCloudinaryUrl(localPath: string): string | null {
    const database = getDb();
    const query = database.prepare('SELECT cloudinary_url FROM cloudinary_urls WHERE local_path = ?');
    const result = query.get(localPath) as { cloudinary_url: string } | undefined;
    return result?.cloudinary_url || null;
  }
};

/**
 * Get current storage provider
 */
export function getStorageProvider(): StorageProvider {
  return STORAGE_MODE === 'cloud' ? cloudProvider : localProvider;
}

/**
 * Check if using cloud storage
 */
export function isCloudStorage(): boolean {
  return STORAGE_MODE === 'cloud';
}

/**
 * Log storage configuration
 */
export function logStorageConfig() {
  console.log('📦 Storage Configuration:');
  console.log(`   Mode: ${STORAGE_MODE}`);
  if (STORAGE_MODE === 'cloud') {
    const cloudName = CLOUDINARY_URL?.match(/cloudinary:\/\/.*@(.+)/)?.[1];
    console.log(`   Cloudinary: ${cloudName || 'configured'}`);
  } else {
    console.log(`   Photos Directory: ${process.env.PHOTOS_DIR}`);
  }
}
