import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import mime from 'mime-types';
import { getCacheKey, getFromCache, saveToCache } from './thumbnailService.js';

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

interface Photo {
  id: string;
  filename: string;
  thumbnailUrl: string;
  fullUrl: string;
  mimeType: string;
  size: number;
  modifiedAt: string;
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
      const filePath = path.join(PHOTOS_DIR, filename);
      const stats = await fs.stat(filePath);
      const ext = path.extname(filename).toLowerCase();

      return {
        id: Buffer.from(filename).toString('base64url'),
        filename,
        thumbnailUrl: `/api/photos/thumbnail/${encodeURIComponent(filename)}`,
        fullUrl: `/api/photos/full/${encodeURIComponent(filename)}`,
        mimeType: ext === '.heic' ? 'image/jpeg' : (mime.lookup(filename) || 'image/jpeg'),
        size: stats.size,
        modifiedAt: stats.mtime.toISOString()
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
  const filePath = path.join(PHOTOS_DIR, filename);
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

  const filePath = path.join(PHOTOS_DIR, filename);
  const buffer = await fs.readFile(filePath);

  return {
    buffer,
    contentType: mime.lookup(filename) || 'image/jpeg'
  };
}
