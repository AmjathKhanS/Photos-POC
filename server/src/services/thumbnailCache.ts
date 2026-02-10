/**
 * Thumbnail Cache Service
 * Provides fast thumbnail access with disk and memory caching
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = process.env.THUMBNAIL_CACHE_DIR || path.join(__dirname, '../../data/thumbnail-cache');
const MAX_MEMORY_CACHE_SIZE = 100; // Max thumbnails in memory
const MAX_MEMORY_CACHE_BYTES = 50 * 1024 * 1024; // 50MB

// In-memory LRU cache
interface CacheEntry {
  buffer: Buffer;
  contentType: string;
  size: number;
  lastAccessed: number;
}

class ThumbnailMemoryCache {
  private cache = new Map<string, CacheEntry>();
  private totalSize = 0;

  get(key: string): { buffer: Buffer; contentType: string } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Update last accessed
    entry.lastAccessed = Date.now();
    return { buffer: entry.buffer, contentType: entry.contentType };
  }

  set(key: string, buffer: Buffer, contentType: string): void {
    const size = buffer.length;

    // Evict old entries if needed
    while (
      (this.cache.size >= MAX_MEMORY_CACHE_SIZE || this.totalSize + size > MAX_MEMORY_CACHE_BYTES) &&
      this.cache.size > 0
    ) {
      this.evictOldest();
    }

    this.cache.set(key, {
      buffer,
      contentType,
      size,
      lastAccessed: Date.now()
    });
    this.totalSize += size;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.totalSize -= entry.size;
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
  }

  getStats() {
    return {
      entries: this.cache.size,
      totalSizeBytes: this.totalSize,
      totalSizeMB: (this.totalSize / (1024 * 1024)).toFixed(2)
    };
  }
}

const memoryCache = new ThumbnailMemoryCache();

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Generate cache key from face ID and options
 */
function getCacheKey(faceId: number, size: number = 150): string {
  return `face_${faceId}_${size}`;
}

/**
 * Generate file path for cached thumbnail
 */
function getCachePath(cacheKey: string): string {
  // Use hash to avoid file system limitations
  const hash = crypto.createHash('md5').update(cacheKey).digest('hex');
  return path.join(CACHE_DIR, `${hash}.jpg`);
}

/**
 * Get thumbnail from cache (memory -> disk)
 */
export async function getThumbnailFromCache(
  faceId: number,
  size: number = 150
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const cacheKey = getCacheKey(faceId, size);

  // Check memory cache first
  const memCached = memoryCache.get(cacheKey);
  if (memCached) {
    return memCached;
  }

  // Check disk cache
  const cachePath = getCachePath(cacheKey);
  if (fs.existsSync(cachePath)) {
    try {
      const buffer = await fsPromises.readFile(cachePath);
      const contentType = 'image/jpeg';

      // Store in memory cache for faster next access
      memoryCache.set(cacheKey, buffer, contentType);

      return { buffer, contentType };
    } catch (error) {
      console.error('Error reading thumbnail cache:', error);
      // Fall through to return null
    }
  }

  return null;
}

/**
 * Save thumbnail to cache (both memory and disk)
 */
export async function saveThumbnailToCache(
  faceId: number,
  buffer: Buffer,
  contentType: string,
  size: number = 150
): Promise<void> {
  const cacheKey = getCacheKey(faceId, size);

  // Save to memory cache
  memoryCache.set(cacheKey, buffer, contentType);

  // Save to disk cache
  const cachePath = getCachePath(cacheKey);
  try {
    await fsPromises.writeFile(cachePath, buffer);
  } catch (error) {
    console.error('Error writing thumbnail cache:', error);
  }
}

/**
 * Invalidate cache for specific face
 */
export async function invalidateThumbnailCache(faceId: number): Promise<void> {
  const cacheKey = getCacheKey(faceId);
  const cachePath = getCachePath(cacheKey);

  // Remove from disk
  if (fs.existsSync(cachePath)) {
    try {
      await fsPromises.unlink(cachePath);
    } catch (error) {
      console.error('Error deleting thumbnail cache:', error);
    }
  }

  // Memory cache will be evicted naturally via LRU
}

/**
 * Clear entire cache
 */
export async function clearThumbnailCache(): Promise<void> {
  // Clear memory cache
  memoryCache.clear();

  // Clear disk cache
  try {
    const files = await fsPromises.readdir(CACHE_DIR);
    await Promise.all(
      files.map(file => fsPromises.unlink(path.join(CACHE_DIR, file)))
    );
  } catch (error) {
    console.error('Error clearing thumbnail cache:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const diskFiles = fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).length : 0;
  const diskSize = fs.existsSync(CACHE_DIR)
    ? fs.readdirSync(CACHE_DIR).reduce((total, file) => {
        const filePath = path.join(CACHE_DIR, file);
        return total + fs.statSync(filePath).size;
      }, 0)
    : 0;

  return {
    memory: memoryCache.getStats(),
    disk: {
      entries: diskFiles,
      totalSizeBytes: diskSize,
      totalSizeMB: (diskSize / (1024 * 1024)).toFixed(2),
      path: CACHE_DIR
    }
  };
}
