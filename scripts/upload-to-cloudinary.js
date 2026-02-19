/**
 * Upload Photos to Cloudinary
 *
 * This script uploads all photos from your local directory to Cloudinary
 * and updates the database with Cloudinary URLs.
 *
 * Prerequisites:
 * 1. Create Cloudinary account: https://cloudinary.com/users/register/free
 * 2. Get your credentials from: https://cloudinary.com/console
 * 3. Install dependencies: npm install cloudinary better-sqlite3
 *
 * Usage:
 * node scripts/upload-to-cloudinary.js
 */

import { v2 as cloudinary } from 'cloudinary';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from project root
dotenv.config({ path: path.join(__dirname, '../.env') });

// ============ CONFIGURATION ============

// Load environment variables
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

const PHOTOS_DIR = process.env.PHOTOS_DIR || 'D:/Photos Ai';
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../server/data/faces.db');

// Validation
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('❌ ERROR: Cloudinary credentials not found!');
  console.error('');
  console.error('Please set these environment variables:');
  console.error('  CLOUDINARY_CLOUD_NAME=your_cloud_name');
  console.error('  CLOUDINARY_API_KEY=your_api_key');
  console.error('  CLOUDINARY_API_SECRET=your_api_secret');
  console.error('');
  console.error('Get your credentials from: https://cloudinary.com/console');
  process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});

// ============ DATABASE SETUP ============

let db;
try {
  db = new Database(DB_PATH);

  // Create cloudinary_urls table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS cloudinary_urls (
      local_path TEXT PRIMARY KEY,
      cloudinary_url TEXT NOT NULL,
      cloudinary_public_id TEXT NOT NULL,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Database connected');
} catch (error) {
  console.error('❌ Failed to connect to database:', error);
  process.exit(1);
}

// ============ HELPER FUNCTIONS ============

/**
 * Get all photo files from database
 */
function getAllPhotos() {
  const query = db.prepare('SELECT photo_filename FROM photo_metadata ORDER BY photo_filename');
  return query.all();
}

/**
 * Check if photo is already uploaded
 */
function isAlreadyUploaded(localPath) {
  const query = db.prepare('SELECT cloudinary_url FROM cloudinary_urls WHERE local_path = ?');
  const result = query.get(localPath);
  return result !== undefined;
}

/**
 * Save Cloudinary URL to database
 */
function saveCloudinaryUrl(localPath, cloudinaryUrl, publicId) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO cloudinary_urls (local_path, cloudinary_url, cloudinary_public_id)
    VALUES (?, ?, ?)
  `);
  insert.run(localPath, cloudinaryUrl, publicId);
}

/**
 * Upload a single photo to Cloudinary
 */
async function uploadPhoto(localPath, photoId) {
  const fullPath = path.join(PHOTOS_DIR, localPath);

  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${fullPath}`);
    return null;
  }

  try {
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(fullPath, {
      folder: 'photoviewer',
      public_id: `photo_${photoId}`,
      resource_type: 'auto', // Handles images and videos
      overwrite: false,
      use_filename: true,
      unique_filename: true
    });

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error(`❌ Failed to upload ${localPath}:`, error.message);
    return null;
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format time to human readable
 */
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ============ MAIN UPLOAD FUNCTION ============

async function main() {
  console.log('');
  console.log('📸 PhotoViewer → Cloudinary Upload Tool');
  console.log('=========================================');
  console.log('');
  console.log(`📁 Photos Directory: ${PHOTOS_DIR}`);
  console.log(`💾 Database: ${DB_PATH}`);
  console.log(`☁️  Cloudinary Cloud: ${CLOUDINARY_CLOUD_NAME}`);
  console.log('');

  // Get all photos from database
  const photos = getAllPhotos();
  console.log(`📊 Found ${photos.length} photos in database`);

  // Check how many are already uploaded
  const alreadyUploaded = photos.filter(p => isAlreadyUploaded(p.photo_filename)).length;
  const toUpload = photos.length - alreadyUploaded;

  console.log(`✅ Already uploaded: ${alreadyUploaded}`);
  console.log(`⏳ To upload: ${toUpload}`);
  console.log('');

  if (toUpload === 0) {
    console.log('🎉 All photos are already uploaded to Cloudinary!');
    db.close();
    return;
  }

  // Confirm upload
  console.log('⚠️  This will upload photos to Cloudinary.');
  console.log('   Make sure you have enough storage quota (25GB free tier).');
  console.log('');

  const startTime = Date.now();
  let uploaded = 0;
  let failed = 0;
  let skipped = 0;
  let totalBytes = 0;

  console.log('🚀 Starting upload...');
  console.log('');

  // Upload in batches to avoid rate limits
  const BATCH_SIZE = 5;

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (photo) => {
      // Skip if already uploaded
      if (isAlreadyUploaded(photo.photo_filename)) {
        skipped++;
        return;
      }

      const fullPath = path.join(PHOTOS_DIR, photo.photo_filename);

      // Get file size
      let fileSize = 0;
      try {
        const stats = fs.statSync(fullPath);
        fileSize = stats.size;
      } catch (err) {
        // File doesn't exist
      }

      // Upload - use filename as ID (remove extension for clean public_id)
      const photoId = path.basename(photo.photo_filename, path.extname(photo.photo_filename));
      const result = await uploadPhoto(photo.photo_filename, photoId);

      if (result) {
        // Save to database
        saveCloudinaryUrl(photo.photo_filename, result.url, result.publicId);
        uploaded++;
        totalBytes += fileSize;

        const progress = Math.round(((i + batch.indexOf(photo) + 1) / photos.length) * 100);
        console.log(`[${progress}%] ✅ Uploaded: ${photo.photo_filename} (${formatBytes(fileSize)})`);
      } else {
        failed++;
        console.log(`[${progress}%] ❌ Failed: ${photo.photo_filename}`);
      }
    }));

    // Small delay between batches
    if (i + BATCH_SIZE < photos.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const elapsed = Date.now() - startTime;

  console.log('');
  console.log('=========================================');
  console.log('📊 Upload Summary');
  console.log('=========================================');
  console.log(`✅ Uploaded: ${uploaded} photos`);
  console.log(`⏭️  Skipped: ${skipped} (already uploaded)`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📦 Total size: ${formatBytes(totalBytes)}`);
  console.log(`⏱️  Time: ${formatTime(elapsed)}`);
  console.log('');

  if (uploaded > 0) {
    console.log('🎉 Upload complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Deploy backend to Railway');
    console.log('2. Set PHOTOS_DIR=cloudinary in Railway environment');
    console.log('3. Set CLOUDINARY_URL in Railway environment');
    console.log('');
  }

  db.close();
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  if (db) db.close();
  process.exit(1);
});
