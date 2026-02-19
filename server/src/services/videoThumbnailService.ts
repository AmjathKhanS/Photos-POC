import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

const CACHE_DIR = process.env.CACHE_DIR || path.join(process.cwd(), 'cache', 'video-thumbnails');

// Check if ffmpeg is available
let ffmpegAvailable: boolean | null = null;

async function checkFfmpegAvailability(): Promise<boolean> {
  if (ffmpegAvailable !== null) {
    return ffmpegAvailable;
  }

  return new Promise((resolve) => {
    const process = spawn('ffmpeg', ['-version']);

    process.on('error', () => {
      ffmpegAvailable = false;
      console.warn('⚠️  ffmpeg not found - using placeholder thumbnails for videos');
      console.warn('   Install ffmpeg to enable real video thumbnails');
      resolve(false);
    });

    process.on('close', (code) => {
      ffmpegAvailable = code === 0;
      if (ffmpegAvailable) {
        console.log('✅ ffmpeg found - real video thumbnails enabled');
      }
      resolve(code === 0);
    });
  });
}

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create video thumbnail cache directory:', error);
  }
}

/**
 * Generate a video thumbnail using ffmpeg
 */
export async function generateVideoThumbnail(videoPath: string, filename: string): Promise<Buffer | null> {
  const hasFfmpeg = await checkFfmpegAvailability();

  if (!hasFfmpeg) {
    return null; // Fall back to placeholder
  }

  await ensureCacheDir();

  // Create cache filename
  const cacheFilename = `${Buffer.from(filename).toString('base64url')}.jpg`;
  const cachePath = path.join(CACHE_DIR, cacheFilename);

  // Check if thumbnail already exists in cache
  if (existsSync(cachePath)) {
    try {
      return await fs.readFile(cachePath);
    } catch (error) {
      console.error('Failed to read cached thumbnail:', error);
    }
  }

  // Generate new thumbnail
  return new Promise((resolve) => {
    const args = [
      '-i', videoPath,           // Input file
      '-ss', '00:00:01',         // Seek to 1 second (skip black frames at start)
      '-vframes', '1',           // Extract 1 frame
      '-vf', 'scale=480:-1',     // Scale to 480px width, maintain aspect ratio
      '-q:v', '2',               // High quality
      '-update', '1',            // Allow single image output
      '-f', 'image2',            // Output format
      'pipe:1'                   // Output to stdout
    ];

    const ffmpeg = spawn('ffmpeg', args);
    const chunks: Buffer[] = [];

    ffmpeg.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    ffmpeg.on('error', (error) => {
      console.error('ffmpeg error:', error);
      resolve(null);
    });

    ffmpeg.on('close', async (code) => {
      if (code === 0 && chunks.length > 0) {
        const thumbnailBuffer = Buffer.concat(chunks);

        // Save to cache
        try {
          await fs.writeFile(cachePath, thumbnailBuffer);
        } catch (error) {
          console.error('Failed to cache thumbnail:', error);
        }

        resolve(thumbnailBuffer);
      } else {
        console.error(`ffmpeg exited with code ${code}`);
        resolve(null);
      }
    });
  });
}

/**
 * Generate a placeholder SVG thumbnail for videos
 */
export function generatePlaceholderThumbnail(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  let iconColor = '#4285f4';
  let iconLabel = 'VIDEO';

  // Different colors for different video types
  if (ext === '.mp4' || ext === '.m4v') {
    iconColor = '#4285f4'; // Blue
    iconLabel = 'MP4';
  } else if (ext === '.mov') {
    iconColor = '#34a853'; // Green
    iconLabel = 'MOV';
  } else if (ext === '.avi') {
    iconColor = '#fbbc04'; // Yellow
    iconLabel = 'AVI';
  } else if (ext === '.mkv') {
    iconColor = '#ea4335'; // Red
    iconLabel = 'MKV';
  } else if (ext === '.webm') {
    iconColor = '#9334e6'; // Purple
    iconLabel = 'WEBM';
  }

  const displayFilename = filename.length > 40 ? filename.substring(0, 37) + '...' : filename;

  return `
    <svg width="480" height="270" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2a2a2a;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>

      <!-- Background -->
      <rect width="480" height="270" fill="url(#bg)"/>

      <!-- Film strip decoration -->
      <rect x="0" y="0" width="480" height="20" fill="#000" opacity="0.2"/>
      <rect x="0" y="250" width="480" height="20" fill="#000" opacity="0.2"/>

      <!-- Play button circle with shadow -->
      <circle cx="240" cy="135" r="50" fill="${iconColor}" opacity="0.9" filter="url(#shadow)"/>

      <!-- Play triangle -->
      <polygon points="225,115 225,155 260,135" fill="white"/>

      <!-- Format badge -->
      <rect x="20" y="20" width="80" height="30" rx="4" fill="${iconColor}" opacity="0.9"/>
      <text x="60" y="40" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${iconLabel}</text>

      <!-- Filename -->
      <text x="240" y="210" font-family="Arial, sans-serif" font-size="13" fill="#bdc1c6" text-anchor="middle" opacity="0.9">${displayFilename}</text>

      <!-- Video icon decorations -->
      <rect x="20" y="230" width="15" height="10" rx="2" fill="${iconColor}" opacity="0.3"/>
      <rect x="40" y="230" width="15" height="10" rx="2" fill="${iconColor}" opacity="0.3"/>
      <rect x="60" y="230" width="15" height="10" rx="2" fill="${iconColor}" opacity="0.3"/>

      <rect x="405" y="230" width="15" height="10" rx="2" fill="${iconColor}" opacity="0.3"/>
      <rect x="425" y="230" width="15" height="10" rx="2" fill="${iconColor}" opacity="0.3"/>
      <rect x="445" y="230" width="15" height="10" rx="2" fill="${iconColor}" opacity="0.3"/>
    </svg>
  `;
}
