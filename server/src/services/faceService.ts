import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import {
  getAllFaces as getAllFacesFromDb,
  getFacesByPhoto,
  getFaceById,
  getCompletedPhotosCount,
  getFacesCount,
  getPersonsCount,
  getAllPersons
} from './sqliteDatabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to safely join paths in WSL environment
function safePath(...parts: string[]): string {
  // Use simple string concatenation to avoid path.join converting WSL paths
  return parts.join('/').replace(/\/+/g, '/');
}

// Validate required environment variables
if (!process.env.PHOTOS_DIR) {
  console.error('ERROR: PHOTOS_DIR environment variable is required');
  process.exit(1);
}

const PYTHON_SERVICE_PATH = process.env.FACE_SERVICE_PATH || path.join(__dirname, '../../face-service');
const PHOTOS_DIR = process.env.PHOTOS_DIR;
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.env.DB_DIR || path.join(__dirname, '../../data'), 'faces.db');
const MIN_FACE_CONFIDENCE = parseFloat(process.env.MIN_FACE_CONFIDENCE || '0.6');

// Python executable configuration
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python3';
const VENV_PATH = process.env.PYTHON_VENV_PATH;

// Determine Python command to use
let PYTHON_CMD: string;
if (VENV_PATH) {
  // Use virtual environment
  const venvPython = path.join(VENV_PATH, os.platform() === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  PYTHON_CMD = fs.existsSync(venvPython) ? venvPython : PYTHON_EXECUTABLE;
} else {
  // Use system Python
  PYTHON_CMD = PYTHON_EXECUTABLE;
}

// Helper function to convert WSL paths to Windows paths when using Windows Python
function toWindowsPath(wslPath: string): string {
  if (os.platform() !== 'win32' || !wslPath.startsWith('/mnt/')) {
    return wslPath; // Not Windows or not a WSL path
  }
  // Convert /mnt/x/... to X:\...
  return wslPath.replace(/^\/mnt\/([a-z])\//i, (_, drive) => `${drive.toUpperCase()}:\\`).replace(/\//g, '\\');
}

interface ScanStatus {
  status: 'idle' | 'scanning' | 'completed' | 'error';
  total: number;
  processed: number;
  currentPhoto?: string;
  error?: string;
}

interface Face {
  id: number;
  photo_filename: string;
  face_index: number;
  bounding_box: string | object;
  person_id: number | null;
  person_name?: string | null;
}

let scanStatus: ScanStatus = { status: 'idle', total: 0, processed: 0 };
let scanProcess: ReturnType<typeof spawn> | null = null;

export async function scanAllPhotos(): Promise<{ message: string; error?: string }> {
  if (scanStatus.status === 'scanning') {
    return { message: 'Scan already in progress' };
  }

  // Spawn Python process for face detection (using ONNX for better performance)
  const pythonScript = path.join(PYTHON_SERVICE_PATH, 'face_processor_onnx.py');

  // Verify paths exist
  if (!fs.existsSync(pythonScript)) {
    const error = `Python script not found: ${pythonScript}`;
    console.error(error);
    scanStatus = { status: 'error', total: 0, processed: 0, error };
    return { message: error, error };
  }

  if (!fs.existsSync(PHOTOS_DIR)) {
    const error = `Photos directory not found: ${PHOTOS_DIR}`;
    console.error(error);
    scanStatus = { status: 'error', total: 0, processed: 0, error };
    return { message: error, error };
  }

  // Reset status
  scanStatus = { status: 'scanning', total: 0, processed: 0 };

  console.log('Starting face scan with:', {
    pythonCmd: PYTHON_CMD,
    pythonScript,
    photosDir: PHOTOS_DIR,
    dbPath: DB_PATH
  });

  let stderrOutput = '';

  // On Windows, .bat files need to be executed with shell: true
  const spawnOptions = PYTHON_CMD.endsWith('.bat') ? { shell: true } : {};
  scanProcess = spawn(PYTHON_CMD, [
    pythonScript,
    '--photos-dir', PHOTOS_DIR,
    '--db-path', DB_PATH,
    '--action', 'scan',
    '--min-confidence', MIN_FACE_CONFIDENCE.toString()
  ], spawnOptions);

  scanProcess.stdout?.on('data', (data) => {
    try {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line) {
          const progress = JSON.parse(line);
          scanStatus = {
            status: progress.status || 'scanning',
            total: progress.total || scanStatus.total,
            processed: progress.processed || scanStatus.processed,
            currentPhoto: progress.currentPhoto
          };
        }
      }
    } catch (e) {
      console.log('Python output:', data.toString());
    }
  });

  scanProcess.stderr?.on('data', (data) => {
    const errorText = data.toString();
    console.error('Python error:', errorText);
    stderrOutput += errorText;
  });

  scanProcess.on('close', (code) => {
    if (code === 0) {
      scanStatus.status = 'completed';
    } else {
      scanStatus.status = 'error';
      scanStatus.error = stderrOutput || `Process exited with code ${code}`;
    }
    scanProcess = null;
  });

  scanProcess.on('error', (err) => {
    scanStatus.status = 'error';
    scanStatus.error = `Failed to start Python: ${err.message}. Make sure Python is installed.`;
    console.error('Spawn error:', err);
    scanProcess = null;
  });

  return { message: 'Face scan started' };
}

export function getScanStatus(): ScanStatus {
  return scanStatus;
}

export function getPhotoFaces(filename: string): Face[] {
  const faces = getFacesByPhoto(filename);
  const persons = getAllPersonsFromDb();

  return faces.map(face => {
    const person = face.person_id ? persons.find((p: { id: number }) => p.id === face.person_id) : null;
    return {
      ...face,
      bounding_box: typeof face.bounding_box === 'string'
        ? JSON.parse(face.bounding_box)
        : face.bounding_box,
      person_name: person?.name || null
    };
  });
}

// Get all persons from SQLite database
function getAllPersonsFromDb() {
  return getAllPersons();
}

export function getAllFaces(): Face[] {
  const faces = getAllFacesFromDb();
  const persons = getAllPersonsFromDb();

  return faces.map(face => {
    const person = face.person_id ? persons.find((p: { id: number }) => p.id === face.person_id) : null;
    return {
      ...face,
      bounding_box: typeof face.bounding_box === 'string'
        ? JSON.parse(face.bounding_box)
        : face.bounding_box,
      person_name: person?.name || null
    };
  });
}

export async function getFaceThumbnail(faceId: number, size: number = 150): Promise<{ buffer: Buffer; contentType: string }> {
  // Check cache first (memory -> disk)
  const { getThumbnailFromCache, saveThumbnailToCache } = await import('./thumbnailCache.js');
  const cached = await getThumbnailFromCache(faceId, size);
  if (cached) {
    return cached;
  }

  // Generate thumbnail if not in cache
  const face = getFaceById(faceId);

  if (!face) {
    throw new Error('Face not found');
  }

  const bbox = typeof face.bounding_box === 'string'
    ? JSON.parse(face.bounding_box)
    : face.bounding_box;
  const imagePath = safePath(PHOTOS_DIR, face.photo_filename);

  // Check if file exists
  if (!fs.existsSync(imagePath)) {
    throw new Error('Image file not found');
  }

  // sharp can handle HEIC files directly on Windows - no manual conversion needed!
  // IMPORTANT: Auto-rotate image based on EXIF orientation first
  // This ensures bounding boxes match the oriented view (especially for HEIC from iPhones)
  const orientedImage = sharp(imagePath).rotate(); // Auto-rotate based on EXIF

  // Get metadata AFTER rotation to get correct dimensions
  const metadata = await orientedImage.metadata();
  const imgWidth = metadata.width || 1000;
  const imgHeight = metadata.height || 1000;

  // Add padding and ensure bounds are valid
  const padding = 30;
  const left = Math.max(0, bbox.left - padding);
  const top = Math.max(0, bbox.top - padding);
  const width = Math.min(imgWidth - left, bbox.right - bbox.left + padding * 2);
  const height = Math.min(imgHeight - top, bbox.bottom - bbox.top + padding * 2);

  // Crop face from oriented image
  // sharp handles HEIC->JPEG conversion automatically
  const buffer = await sharp(imagePath)
    .rotate() // Apply EXIF orientation
    .extract({
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height)
    })
    .resize(size, size, {
      fit: 'cover',
      kernel: 'lanczos3' // Better quality
    })
    .jpeg({
      quality: 85,
      progressive: true, // Enable progressive JPEG for faster loading
      mozjpeg: true // Use mozjpeg for smaller file sizes
    })
    .toBuffer();

  const result = { buffer, contentType: 'image/jpeg' };

  // Save to cache for next time
  await saveThumbnailToCache(faceId, buffer, result.contentType, size);

  return result;
}

export function getTotalStats(): { totalPhotos: number; processedPhotos: number; totalFaces: number; totalPersons: number } {
  // Count all supported image files
  let totalPhotos = 0;
  try {
    const files = fs.readdirSync(PHOTOS_DIR);
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
    totalPhotos = files.filter(f =>
      supportedExtensions.includes(path.extname(f).toLowerCase())
    ).length;
  } catch (e) {
    console.error('Error reading photos directory:', e);
  }

  const processedPhotos = getCompletedPhotosCount();
  const totalFaces = getFacesCount();
  const totalPersons = getPersonsCount();

  return { totalPhotos, processedPhotos, totalFaces, totalPersons };
}
