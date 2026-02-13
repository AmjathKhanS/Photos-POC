import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import mime from 'mime-types';
import { getCacheKey, getFromCache, saveToCache } from './thumbnailService.js';
import * as semanticDb from './semanticSearchDb.js';

// Concurrency limiter for thumbnail generation
const MAX_CONCURRENT_THUMBNAILS = 1000; // Process max 1000 thumbnails at once for instant local file access
let activeThumbnailGenerations = 0;
const thumbnailQueue: Array<() => void> = [];

// Helper to safely join paths in WSL environment
function safePath(...parts: string[]): string {
  // Use simple string concatenation to avoid path.join converting WSL paths
  return parts.join('/').replace(/\/+/g, '/');
}

// Configure the photos directory path from environment variable
import os from 'os';

// Validate PHOTOS_DIR environment variable
if (!process.env.PHOTOS_DIR) {
  console.error('ERROR: PHOTOS_DIR environment variable is not set!');
  console.error('Please set PHOTOS_DIR to your photos directory path.');
  console.error('Example: PHOTOS_DIR=/home/user/photos or PHOTOS_DIR=C:\\Users\\user\\Photos');
  process.exit(1);
}

const PHOTOS_DIR = process.env.PHOTOS_DIR;
const THUMBNAIL_SIZE = parseInt(process.env.MAX_THUMBNAIL_SIZE || '800'); // 800px for ultra-sharp thumbnails on high-DPI displays
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];

// In-memory cache for photo metadata (dimensions and screenshot detection)
// Key: filename:modifiedTime, Value: {width, height, isScreenshot}
const metadataCache = new Map<string, {width?: number, height?: number, isScreenshot: boolean}>();

// In-memory cache for hot thumbnails (most recently accessed)
// Key: filename, Value: {buffer, contentType, timestamp}
const thumbnailMemoryCache = new Map<string, {buffer: Buffer, contentType: string, timestamp: number}>();
const MAX_MEMORY_CACHE_SIZE = 5000; // Cache 5000 thumbnails in memory (~125MB RAM for instant delivery)
const MEMORY_CACHE_TTL = 120 * 60 * 1000; // 120 minutes (2 hours)

// In-memory cache for full images (recently viewed)
const fullImageMemoryCache = new Map<string, {buffer: Buffer, contentType: string, timestamp: number}>();
const MAX_FULL_IMAGE_CACHE_SIZE = 20; // Cache 20 most recent full images in memory (larger files)
const FULL_IMAGE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Common screen resolutions for screenshot detection
const COMMON_SCREEN_RESOLUTIONS = [
  // 16:9 aspect ratio (most common)
  { width: 1920, height: 1080 }, { width: 1080, height: 1920 }, // Full HD
  { width: 2560, height: 1440 }, { width: 1440, height: 2560 }, // 2K
  { width: 3840, height: 2160 }, { width: 2160, height: 3840 }, // 4K
  { width: 1366, height: 768 }, { width: 768, height: 1366 },
  { width: 1600, height: 900 }, { width: 900, height: 1600 },

  // 16:10 aspect ratio
  { width: 1920, height: 1200 }, { width: 1200, height: 1920 },
  { width: 1680, height: 1050 }, { width: 1050, height: 1680 },
  { width: 2560, height: 1600 }, { width: 1600, height: 2560 },

  // 21:9 ultrawide
  { width: 2560, height: 1080 }, { width: 1080, height: 2560 },
  { width: 3440, height: 1440 }, { width: 1440, height: 3440 },

  // Common laptop resolutions
  { width: 1440, height: 900 }, { width: 900, height: 1440 },
  { width: 1280, height: 800 }, { width: 800, height: 1280 },

  // Mobile resolutions (common phones)
  { width: 1080, height: 2340 }, { width: 2340, height: 1080 }, // Various Android
  { width: 1125, height: 2436 }, { width: 2436, height: 1125 }, // iPhone X/XS/11 Pro
  { width: 1170, height: 2532 }, { width: 2532, height: 1170 }, // iPhone 12/13 Pro
  { width: 1284, height: 2778 }, { width: 2778, height: 1284 }, // iPhone 12/13 Pro Max
  { width: 828, height: 1792 }, { width: 1792, height: 828 },   // iPhone XR/11
];

// Screenshot filename patterns
const SCREENSHOT_PATTERNS = [
  /screenshot/i,
  /screen[_\s-]?shot/i,
  /screen[_\s-]?capture/i,
  /screencap/i,
  /snip/i,
  /screen[_\s-]?clip/i,
  /screen[_\s-]?grab/i,
  /scrnshot/i,
  /img_\d{8}_\d{6}/i, // Android screenshot pattern
  /screenshot_\d{8}/i,
  /^scr_\d/i,
];

/**
 * Detect if an image is likely a screenshot based on multiple factors
 */
function isLikelyScreenshot(
  filename: string,
  width: number,
  height: number,
  metadata?: any
): boolean {
  // 1. Check filename patterns (most reliable)
  const matchesFilename = SCREENSHOT_PATTERNS.some(pattern => pattern.test(filename));
  if (matchesFilename) return true;

  // 2. Check if dimensions match common screen resolutions (±5px tolerance)
  const matchesResolution = COMMON_SCREEN_RESOLUTIONS.some(res => {
    const widthMatch = Math.abs(width - res.width) <= 5;
    const heightMatch = Math.abs(height - res.height) <= 5;
    return widthMatch && heightMatch;
  });

  // 3. Check aspect ratios common for screens
  const aspectRatio = width / height;
  const commonAspectRatios = [
    16/9, 9/16,     // Most common
    16/10, 10/16,   // Laptops
    21/9, 9/21,     // Ultrawide
    4/3, 3/4,       // Older screens
    3/2, 2/3,       // Surface devices
  ];

  const matchesAspectRatio = commonAspectRatios.some(ratio =>
    Math.abs(aspectRatio - ratio) < 0.02 // 2% tolerance
  );

  // 4. Check EXIF metadata for screenshot indicators
  let hasScreenshotMetadata = false;
  if (metadata?.exif) {
    const softwareField = metadata.exif.Software || metadata.exif.software || '';
    const makeField = metadata.exif.Make || metadata.exif.make || '';

    hasScreenshotMetadata =
      /screenshot|snip|capture|grab/i.test(softwareField) ||
      /screenshot|snip/i.test(makeField);
  }

  // Screenshot if: matches resolution OR (matches aspect ratio AND has other indicators)
  return matchesResolution || hasScreenshotMetadata || (matchesAspectRatio && matchesFilename);
}

interface Photo {
  id: string;
  filename: string;
  thumbnailUrl: string;
  fullUrl: string;
  mimeType: string;
  size: number;
  modifiedAt: string;
  width?: number;
  height?: number;
  isScreenshot?: boolean;
}

interface ImageResult {
  buffer: Buffer;
  contentType: string;
}

// Cache for photo list (longer TTL for performance)
let photoListCache: Photo[] | null = null;
let photoListCacheTime = 0;
let lastPhotoCount = 0;
const PHOTO_LIST_CACHE_TTL = 30 * 60 * 1000; // 30 minutes (longer cache)

export async function getPhotoList(): Promise<Photo[]> {
  // Return cached list if still valid
  const now = Date.now();
  if (photoListCache && (now - photoListCacheTime) < PHOTO_LIST_CACHE_TTL) {
    console.log('⚡ Returning cached photo list');
    return photoListCache;
  }

  console.log('Reading photos from:', PHOTOS_DIR);
  const files = await fs.readdir(PHOTOS_DIR);
  console.log('Found files:', files.length);

  const supportedFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  });
  console.log('Supported image files:', supportedFiles.length);

  // Process files in batches for better performance
  const BATCH_SIZE = 100;
  const photos: Photo[] = [];

  for (let i = 0; i < supportedFiles.length; i += BATCH_SIZE) {
    const batch = supportedFiles.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (filename): Promise<Photo> => {
      const filePath = safePath(PHOTOS_DIR, filename);
      const stats = await fs.stat(filePath);
      const ext = path.extname(filename).toLowerCase();

      // Screenshot detection: Always use filename-based for now (reliable and fast)
      const isScreenshot = SCREENSHOT_PATTERNS.some(pattern => pattern.test(filename));

      return {
        id: Buffer.from(filename).toString('base64url'),
        filename,
        thumbnailUrl: `/api/photos/thumbnail/${encodeURIComponent(filename)}?v=4`,
        fullUrl: `/api/photos/full/${encodeURIComponent(filename)}`,
        mimeType: ext === '.heic' ? 'image/jpeg' : (mime.lookup(filename) || 'image/jpeg'),
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        width: undefined,
        height: undefined,
        isScreenshot
      };
    });

    photos.push(...await Promise.all(batchPromises));
  }

  // Sort by modification date (newest first)
  const sortedPhotos = photos.sort((a, b) =>
    new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );

  // Cache the result
  photoListCache = sortedPhotos;
  photoListCacheTime = now;
  lastPhotoCount = sortedPhotos.length;

  return sortedPhotos;
}

// Function to invalidate cache (can be called when new photos are added)
export function invalidatePhotoListCache() {
  photoListCache = null;
  photoListCacheTime = 0;
  console.log('📸 Photo list cache invalidated');
}

// Check if new photos have been added without scanning all metadata
async function checkForNewPhotos(): Promise<boolean> {
  try {
    const files = await fs.readdir(PHOTOS_DIR);
    const supportedFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext);
    });

    const currentCount = supportedFiles.length;
    const hasNewPhotos = currentCount !== lastPhotoCount;

    if (hasNewPhotos) {
      console.log(`📸 Detected ${Math.abs(currentCount - lastPhotoCount)} photo changes (${lastPhotoCount} → ${currentCount})`);
    }

    return hasNewPhotos;
  } catch (error) {
    console.error('Error checking for new photos:', error);
    return false;
  }
}

// Start periodic check for new photos
export function startPeriodicPhotoCheck(intervalMs: number = 2 * 60 * 1000) {
  console.log(`🔄 Starting periodic photo check (every ${intervalMs / 1000}s)`);

  setInterval(async () => {
    const hasNewPhotos = await checkForNewPhotos();
    if (hasNewPhotos) {
      invalidatePhotoListCache();
      console.log('✨ New photos detected - cache invalidated');
    }
  }, intervalMs);
}

async function convertHeicToJpeg(filePath: string): Promise<Buffer> {
  const inputBuffer = await fs.readFile(filePath);

  try {
    const outputBuffer = await heicConvert({
      buffer: inputBuffer as any,
      format: 'JPEG',
      quality: 0.9
    });
    return Buffer.from(outputBuffer);
  } catch (error: any) {
    // If conversion fails because file is not actually HEIC (common with misnamed files),
    // return the original buffer - it's probably already a JPEG
    if (error.message && error.message.includes('not a HEIC image')) {
      console.log(`File ${path.basename(filePath)} has .HEIC extension but is not a HEIC file, treating as JPEG`);
      return inputBuffer;
    }
    throw error;
  }
}

async function getImageBuffer(filename: string): Promise<Buffer> {
  const filePath = safePath(PHOTOS_DIR, filename);
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.heic') {
    return convertHeicToJpeg(filePath);
  }

  return fs.readFile(filePath);
}

// Helper to wait for available slot
function waitForSlot(): Promise<void> {
  if (activeThumbnailGenerations < MAX_CONCURRENT_THUMBNAILS) {
    activeThumbnailGenerations++;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    thumbnailQueue.push(() => {
      activeThumbnailGenerations++;
      resolve();
    });
  });
}

// Helper to release slot
function releaseSlot() {
  activeThumbnailGenerations--;
  const next = thumbnailQueue.shift();
  if (next) {
    next();
  }
}

export async function getThumbnail(filename: string): Promise<ImageResult> {
  // Check memory cache first (fastest - instant delivery)
  const memCached = thumbnailMemoryCache.get(filename);
  if (memCached && (Date.now() - memCached.timestamp) < MEMORY_CACHE_TTL) {
    return { buffer: memCached.buffer, contentType: memCached.contentType };
  }

  const cacheKey = getCacheKey(filename, 'thumbnail');

  // Check disk cache (fast - ~2ms)
  const cached = await getFromCache(cacheKey);
  if (cached) {
    addToMemoryCache(filename, cached, 'image/jpeg');
    return { buffer: cached, contentType: 'image/jpeg' };
  }

  // Wait for available processing slot
  await waitForSlot();

  try {
    // Generate high-quality thumbnail optimized for performance
    const imageBuffer = await getImageBuffer(filename);
    const thumbnail = await sharp(imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center',
        kernel: 'lanczos3' // High quality resize
      })
      .sharpen({ sigma: 0.5 }) // Subtle sharpening
      .jpeg({
        quality: 90, // High quality, good compression balance
        progressive: true, // Progressive loading
        mozjpeg: true, // Better compression
        chromaSubsampling: '4:2:0' // Standard subsampling for smaller files
      })
      .toBuffer();

    // Save to disk cache asynchronously (don't wait)
    saveToCache(cacheKey, thumbnail).catch(err =>
      console.error('Cache save error:', err)
    );

    // Add to memory cache
    addToMemoryCache(filename, thumbnail, 'image/jpeg');

    return {
      buffer: thumbnail,
      contentType: 'image/jpeg'
    };
  } finally {
    // Always release the slot
    releaseSlot();
  }
}

// Helper to add to memory cache with LRU eviction
function addToMemoryCache(filename: string, buffer: Buffer, contentType: string) {
  // Remove oldest entries if cache is full
  if (thumbnailMemoryCache.size >= MAX_MEMORY_CACHE_SIZE) {
    const oldestKey = thumbnailMemoryCache.keys().next().value;
    thumbnailMemoryCache.delete(oldestKey);
  }

  thumbnailMemoryCache.set(filename, {
    buffer,
    contentType,
    timestamp: Date.now()
  });
}

// Helper to add full image to memory cache with LRU eviction
function addFullImageToMemoryCache(filename: string, buffer: Buffer, contentType: string) {
  // Remove oldest entries if cache is full
  if (fullImageMemoryCache.size >= MAX_FULL_IMAGE_CACHE_SIZE) {
    const oldestKey = fullImageMemoryCache.keys().next().value;
    fullImageMemoryCache.delete(oldestKey);
  }

  fullImageMemoryCache.set(filename, {
    buffer,
    contentType,
    timestamp: Date.now()
  });
}

export async function getFullImage(filename: string): Promise<ImageResult> {
  // Check memory cache first (fastest)
  const memCached = fullImageMemoryCache.get(filename);
  if (memCached && (Date.now() - memCached.timestamp) < FULL_IMAGE_CACHE_TTL) {
    return { buffer: memCached.buffer, contentType: memCached.contentType };
  }

  const ext = path.extname(filename).toLowerCase();
  const cacheKey = getCacheKey(filename, 'full');

  // Check disk cache
  const diskCached = await getFromCache(cacheKey);
  if (diskCached) {
    const contentType = ext === '.heic' ? 'image/jpeg' : (mime.lookup(filename) || 'image/jpeg');
    addFullImageToMemoryCache(filename, diskCached, contentType);
    return { buffer: diskCached, contentType };
  }

  // Need to process/load image
  const filePath = safePath(PHOTOS_DIR, filename);
  const stats = await fs.stat(filePath);
  const fileSizeInMB = stats.size / (1024 * 1024);

  // For HEIC or large files (>3MB), optimize them
  if (ext === '.heic' || fileSizeInMB > 3) {
    const buffer = await getImageBuffer(filename);

    // Optimize image for web display
    const processed = await sharp(buffer)
      .resize(2400, 2400, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3' // Better quality for full images
      })
      .jpeg({
        quality: 85, // Good quality, smaller size
        progressive: true, // Progressive loading
        mozjpeg: true,
        chromaSubsampling: '4:2:0' // Standard subsampling
      })
      .toBuffer();

    // Save to disk cache asynchronously
    saveToCache(cacheKey, processed).catch(err =>
      console.error('Full image cache save error:', err)
    );

    // Add to memory cache
    addFullImageToMemoryCache(filename, processed, 'image/jpeg');

    return {
      buffer: processed,
      contentType: 'image/jpeg'
    };
  }

  // For smaller regular images, return as-is (but cache for next time)
  const buffer = await fs.readFile(filePath);
  const contentType = mime.lookup(filename) || 'image/jpeg';

  // Cache in memory for quick access
  addFullImageToMemoryCache(filename, buffer, contentType);

  return {
    buffer,
    contentType
  };
}
