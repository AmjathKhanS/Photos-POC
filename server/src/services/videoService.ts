import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';

// Validate PHOTOS_DIR environment variable
if (!process.env.PHOTOS_DIR) {
  console.error('ERROR: PHOTOS_DIR environment variable is not set!');
  process.exit(1);
}

const PHOTOS_DIR = process.env.PHOTOS_DIR;
const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp', '.wmv'];

interface Video {
  id: string;
  filename: string;
  videoUrl: string;
  thumbnailUrl: string;
  mimeType: string;
  size: number;
  modifiedAt: string;
}

// Cache for video list
let videoListCache: Video[] | null = null;
let videoListCacheTime = 0;
const VIDEO_LIST_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function getVideoList(): Promise<Video[]> {
  // Return cached list if still valid
  const now = Date.now();
  if (videoListCache && (now - videoListCacheTime) < VIDEO_LIST_CACHE_TTL) {
    console.log('⚡ Returning cached video list');
    return videoListCache;
  }

  console.log('Reading videos from:', PHOTOS_DIR);
  const files = await fs.readdir(PHOTOS_DIR);

  const videoFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return SUPPORTED_VIDEO_EXTENSIONS.includes(ext);
  });

  console.log('Found video files:', videoFiles.length);

  const videos: Video[] = [];

  for (const filename of videoFiles) {
    const filePath = path.join(PHOTOS_DIR, filename);
    const stats = await fs.stat(filePath);
    const ext = path.extname(filename).toLowerCase();

    videos.push({
      id: Buffer.from(filename).toString('base64url'),
      filename,
      videoUrl: `/api/videos/stream/${encodeURIComponent(filename)}`,
      thumbnailUrl: `/api/videos/thumbnail/${encodeURIComponent(filename)}`,
      mimeType: mime.lookup(filename) || 'video/mp4',
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    });
  }

  // Sort by modification date (newest first)
  const sortedVideos = videos.sort((a, b) =>
    new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );

  // Cache the result
  videoListCache = sortedVideos;
  videoListCacheTime = now;

  return sortedVideos;
}

export function invalidateVideoListCache() {
  videoListCache = null;
  videoListCacheTime = 0;
  console.log('🎥 Video list cache invalidated');
}

export async function getVideoPath(filename: string): Promise<string> {
  return path.join(PHOTOS_DIR, filename);
}

export async function getVideoStats(filename: string) {
  const filePath = path.join(PHOTOS_DIR, filename);
  const stats = await fs.stat(filePath);
  return {
    size: stats.size,
    mimeType: mime.lookup(filename) || 'video/mp4',
  };
}
