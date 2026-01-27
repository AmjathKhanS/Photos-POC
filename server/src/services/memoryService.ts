import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  getAllMemories,
  getMemoryById,
  getMemoryPhotos,
  dismissMemory as dismissMemoryDb,
  deleteMemory as deleteMemoryDb,
  getMemoriesByType,
  getMemoriesByPerson,
  type Memory,
  type MemoryPhoto
} from './sqliteDatabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_SERVICE_PATH = path.join(__dirname, '../../face-service');
const PHOTOS_DIR = process.env.PHOTOS_DIR || (os.platform() === 'win32' ? 'D:\\Photos Ai\\mobile' : '/mnt/d/Photos Ai/mobile');
const DB_PATH = path.join(__dirname, '../../data/faces.db');

// Use ONNX virtual environment Python
const VENV_PYTHON = path.join(__dirname, '../../../venv_onnx/Scripts/python.exe');
const PYTHON_CMD = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : (os.platform() === 'win32' ? 'python' : 'python3');

// Helper function to convert WSL paths to Windows paths when using Windows Python
function toWindowsPath(wslPath: string): string {
  if (!VENV_PYTHON.includes('.exe')) return wslPath; // Not using Windows Python
  // Convert /mnt/x/... to X:\...
  return wslPath.replace(/^\/mnt\/([a-z])\//i, (_, drive) => `${drive.toUpperCase()}:\\`).replace(/\//g, '\\');
}

// ============ Photo Quality Assessment ============

export async function assessPhotoQuality(): Promise<{ message: string; error?: string }> {
  const pythonScript = path.join(PYTHON_SERVICE_PATH, 'photo_quality_analyzer.py');

  // Verify paths exist
  if (!fs.existsSync(pythonScript)) {
    const error = `Python script not found: ${pythonScript}`;
    console.error(error);
    return { message: error, error };
  }

  if (!fs.existsSync(PHOTOS_DIR)) {
    const error = `Photos directory not found: ${PHOTOS_DIR}`;
    console.error(error);
    return { message: error, error };
  }

  console.log('Starting photo quality assessment...');

  return new Promise((resolve) => {
    const process = spawn(PYTHON_CMD, [
      toWindowsPath(pythonScript),
      '--photos-dir', toWindowsPath(PHOTOS_DIR),
      '--db-path', toWindowsPath(DB_PATH),
      '--action', 'analyze-all'
    ]);

    let outputData = '';
    let errorData = '';

    process.stdout?.on('data', (data) => {
      outputData += data.toString();
      console.log('Quality assessment:', data.toString().trim());
    });

    process.stderr?.on('data', (data) => {
      errorData += data.toString();
      console.error('Quality assessment error:', data.toString());
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ message: 'Photo quality assessment completed' });
      } else {
        resolve({ message: 'Quality assessment failed', error: errorData || `Process exited with code ${code}` });
      }
    });

    process.on('error', (err) => {
      resolve({ message: 'Failed to start quality assessment', error: err.message });
    });
  });
}

// ============ Photo Metadata Extraction ============

export async function extractPhotoMetadata(): Promise<{ message: string; error?: string }> {
  const pythonScript = path.join(PYTHON_SERVICE_PATH, 'photo_metadata_extractor.py');

  // Verify paths exist
  if (!fs.existsSync(pythonScript)) {
    const error = `Python script not found: ${pythonScript}`;
    console.error(error);
    return { message: error, error };
  }

  if (!fs.existsSync(PHOTOS_DIR)) {
    const error = `Photos directory not found: ${PHOTOS_DIR}`;
    console.error(error);
    return { message: error, error };
  }

  console.log('Starting photo metadata extraction...');

  return new Promise((resolve) => {
    const process = spawn(PYTHON_CMD, [
      toWindowsPath(pythonScript),
      '--photos-dir', toWindowsPath(PHOTOS_DIR),
      '--db-path', toWindowsPath(DB_PATH),
      '--action', 'extract-all'
    ]);

    let outputData = '';
    let errorData = '';

    process.stdout?.on('data', (data) => {
      outputData += data.toString();
      console.log('Metadata extraction:', data.toString().trim());
    });

    process.stderr?.on('data', (data) => {
      errorData += data.toString();
      console.error('Metadata extraction error:', data.toString());
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ message: 'Photo metadata extraction completed' });
      } else {
        resolve({ message: 'Metadata extraction failed', error: errorData || `Process exited with code ${code}` });
      }
    });

    process.on('error', (err) => {
      resolve({ message: 'Failed to start metadata extraction', error: err.message });
    });
  });
}

// ============ Memory Generation ============

async function runMemoryGenerator(action: string, args: string[] = []): Promise<{ message: string; error?: string; data?: any }> {
  const pythonScript = path.join(PYTHON_SERVICE_PATH, 'memory_generator.py');

  // Verify script exists
  if (!fs.existsSync(pythonScript)) {
    const error = `Python script not found: ${pythonScript}`;
    console.error(error);
    return { message: error, error };
  }

  console.log(`Running memory generator: ${action}`);

  return new Promise((resolve) => {
    const process = spawn(PYTHON_CMD, [
      toWindowsPath(pythonScript),
      '--db-path', toWindowsPath(DB_PATH),
      '--action', action,
      ...args
    ]);

    let outputData = '';
    let errorData = '';

    process.stdout?.on('data', (data) => {
      outputData += data.toString();
    });

    process.stderr?.on('data', (data) => {
      errorData += data.toString();
      console.error(`Memory generator error:`, data.toString());
    });

    process.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(outputData.trim());
          resolve({ message: 'Memory generation completed', data: result });
        } catch (e) {
          resolve({ message: 'Memory generation completed', data: { status: 'completed' } });
        }
      } else {
        resolve({ message: 'Memory generation failed', error: errorData || `Process exited with code ${code}` });
      }
    });

    process.on('error', (err) => {
      resolve({ message: 'Failed to start memory generator', error: err.message });
    });
  });
}

export async function generateDailyMemories(): Promise<{ message: string; error?: string; data?: any }> {
  console.log('Generating daily memories (On This Day)...');
  return runMemoryGenerator('daily');
}

export async function generateWeeklyMemories(): Promise<{ message: string; error?: string; data?: any }> {
  console.log('Generating weekly highlight memories...');
  return runMemoryGenerator('weekly');
}

export async function generateMonthlyMemories(): Promise<{ message: string; error?: string; data?: any }> {
  console.log('Generating monthly highlight memories...');
  return runMemoryGenerator('monthly');
}

export async function generateSeasonalMemories(): Promise<{ message: string; error?: string; data?: any }> {
  console.log('Generating seasonal memories...');
  return runMemoryGenerator('seasonal');
}

export async function generatePersonMemories(personId: number): Promise<{ message: string; error?: string; data?: any }> {
  console.log(`Generating memories for person ${personId}...`);
  return runMemoryGenerator('people', ['--person-id', personId.toString()]);
}

// ============ Memory Retrieval ============

export function getActiveMemories(limit?: number): Memory[] {
  const memories = getAllMemories(false); // false = exclude dismissed
  if (limit) {
    return memories.slice(0, limit);
  }
  return memories;
}

export function getMemory(memoryId: number): Memory | undefined {
  return getMemoryById(memoryId);
}

export function getPhotosInMemory(memoryId: number): MemoryPhoto[] {
  return getMemoryPhotos(memoryId);
}

export function getMemoriesOfType(memoryType: string): Memory[] {
  return getMemoriesByType(memoryType);
}

export function getMemoriesForPerson(personId: number): Memory[] {
  return getMemoriesByPerson(personId);
}

// ============ Memory Management ============

export function dismissMemory(memoryId: number): void {
  dismissMemoryDb(memoryId);
}

export function deleteMemory(memoryId: number): void {
  deleteMemoryDb(memoryId);
}

// ============ Initialization Helper ============

export async function initializeSmartMemories(): Promise<{ message: string; error?: string }> {
  console.log('Initializing Smart Memories...');
  console.log('Step 1/3: Assessing photo quality...');

  // Step 1: Assess photo quality
  const qualityResult = await assessPhotoQuality();
  if (qualityResult.error) {
    return { message: 'Failed at quality assessment', error: qualityResult.error };
  }

  console.log('Step 2/3: Extracting photo metadata...');

  // Step 2: Extract metadata
  const metadataResult = await extractPhotoMetadata();
  if (metadataResult.error) {
    return { message: 'Failed at metadata extraction', error: metadataResult.error };
  }

  console.log('Step 3/3: Generating initial memories...');

  // Step 3: Generate daily memories
  const memoryResult = await generateDailyMemories();
  if (memoryResult.error) {
    return { message: 'Failed at memory generation', error: memoryResult.error };
  }

  return { message: 'Smart Memories initialized successfully!' };
}
