import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import mime from 'mime-types';
import { getCacheKey, getFromCache, saveToCache } from './thumbnailService.js';
import * as semanticDb from './semanticSearchDb.js';

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
const THUMBNAIL_SIZE = parseInt(process.env.MAX_THUMBNAIL_SIZE || '200');
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];

// In-memory cache for photo metadata (dimensions and screenshot detection)
// Key: filename:modifiedTime, Value: {width, height, isScreenshot}
const metadataCache = new Map<string, {width?: number, height?: number, isScreenshot: boolean}>();

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

export async function getPhotoList(): Promise<Photo[]> {
  console.log('Reading photos from:', PHOTOS_DIR);
  const files = await fs.readdir(PHOTOS_DIR);
  console.log('Found files:', files.length);

  const supportedFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  });
  console.log('Supported image files:', supportedFiles.length);

  const photoPromises = supportedFiles
    .map(async (filename): Promise<Photo> => {
      const filePath = safePath(PHOTOS_DIR, filename);
      const stats = await fs.stat(filePath);
      const ext = path.extname(filename).toLowerCase();

      // Screenshot detection: Always use filename-based for now (reliable and fast)
      // TODO: Re-enable AI detection after migration runs successfully
      const isScreenshot = SCREENSHOT_PATTERNS.some(pattern => pattern.test(filename));

      // NOTE: Width, height, and advanced detection are not extracted here to keep
      // the initial photo list load fast. They can be added in a future enhancement
      // via a separate endpoint that extracts metadata on-demand.
      const width: number | undefined = undefined;
      const height: number | undefined = undefined;

      return {
        id: Buffer.from(filename).toString('base64url'),
        filename,
        thumbnailUrl: `/api/photos/thumbnail/${encodeURIComponent(filename)}`,
        fullUrl: `/api/photos/full/${encodeURIComponent(filename)}`,
        mimeType: ext === '.heic' ? 'image/jpeg' : (mime.lookup(filename) || 'image/jpeg'),
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        width,
        height,
        isScreenshot
      };
    });

  const photos = await Promise.all(photoPromises);

  // Sort by modification date (newest first)
  return photos.sort((a, b) =>
    new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );
}

async function convertHeicToJpeg(filePath: string): Promise<Buffer> {
  const inputBuffer = await fs.readFile(filePath);
  const outputBuffer = await heicConvert({
    buffer: inputBuffer as any,
    format: 'JPEG',
    quality: 0.9
  });
  return Buffer.from(outputBuffer);
}

async function getImageBuffer(filename: string): Promise<Buffer> {
  const filePath = safePath(PHOTOS_DIR, filename);
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.heic') {
    return convertHeicToJpeg(filePath);
  }

  return fs.readFile(filePath);
}

export async function getThumbnail(filename: string): Promise<ImageResult> {
  const cacheKey = getCacheKey(filename, 'thumbnail');

  // Check cache first
  const cached = await getFromCache(cacheKey);
  if (cached) {
    return { buffer: cached, contentType: 'image/jpeg' };
  }

  // Generate thumbnail
  const imageBuffer = await getImageBuffer(filename);
  const thumbnail = await sharp(imageBuffer)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 60, progressive: true }) // Lower quality, progressive for faster perceived load
    .toBuffer();

  // Save to cache
  await saveToCache(cacheKey, thumbnail);

  return {
    buffer: thumbnail,
    contentType: 'image/jpeg'
  };
}

export async function getFullImage(filename: string): Promise<ImageResult> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.heic') {
    const cacheKey = getCacheKey(filename, 'full');

    // Check cache first for converted HEIC
    const cached = await getFromCache(cacheKey);
    if (cached) {
      return { buffer: cached, contentType: 'image/jpeg' };
    }

    const buffer = await getImageBuffer(filename);
    // Resize very large images for web display
    const processed = await sharp(buffer)
      .resize(2400, 2400, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Cache the converted image
    await saveToCache(cacheKey, processed);

    return {
      buffer: processed,
      contentType: 'image/jpeg'
    };
  }

  const filePath = safePath(PHOTOS_DIR, filename);
  const buffer = await fs.readFile(filePath);

  return {
    buffer,
    contentType: mime.lookup(filename) || 'image/jpeg'
  };
}
