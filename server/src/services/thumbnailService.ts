import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const CACHE_DIR = process.env.CACHE_DIR || path.join(os.tmpdir(), 'photo-viewer-cache');

export async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

export function getCacheKey(filename: string, type: 'thumbnail' | 'full'): string {
  const hash = crypto.createHash('md5').update(filename).digest('hex');
  return path.join(CACHE_DIR, `${type}-${hash}.jpg`);
}

export async function getFromCache(cacheKey: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(cacheKey);
  } catch {
    return null;
  }
}

export async function saveToCache(cacheKey: string, buffer: Buffer): Promise<void> {
  await ensureCacheDir();
  await fs.writeFile(cacheKey, buffer);
}
