import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_SERVICE_PATH = path.join(__dirname, '../../face-service');
// Use SQLite database for clustering (ONNX works with SQLite)
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/faces.db');

// Use ONNX virtual environment Python (optimized for 512-D embeddings)
const VENV_PYTHON = path.join(__dirname, '../../../venv_onnx/Scripts/python.exe');
const PYTHON_CMD = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : (os.platform() === 'win32' ? 'python' : 'python3');

// Helper function to convert WSL paths to Windows paths when using Windows Python
function toWindowsPath(wslPath: string): string {
  if (!VENV_PYTHON.includes('.exe')) return wslPath; // Not using Windows Python
  // Convert /mnt/x/... to X:\...
  return wslPath.replace(/^\/mnt\/([a-z])\//i, (_, drive) => `${drive.toUpperCase()}:\\`).replace(/\//g, '\\');
}

interface ClusteringResult {
  status: string;
  totalFaces?: number;
  clustersFound?: number;
  outliers?: number;
  personsCreated?: number;
  message?: string;
  error?: string;
}

export function runFaceClustering(eps: number = 0.5, minSamples: number = 2): Promise<ClusteringResult> {
  return new Promise((resolve, reject) => {
    // Use ONNX clustering (optimized for 512-D embeddings with cosine similarity)
    const pythonScript = path.join(PYTHON_SERVICE_PATH, 'face_clustering_onnx.py');

    const process = spawn(PYTHON_CMD, [
      toWindowsPath(pythonScript),
      '--db-path', toWindowsPath(DB_PATH),
      '--eps', eps.toString(),
      '--min-samples', minSamples.toString(),
      '--metric', 'cosine'  // Use cosine similarity for ONNX embeddings
    ]);

    let output = '';
    let errorOutput = '';

    process.stdout?.on('data', (data) => {
      output += data.toString();
    });

    process.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch (e) {
          resolve({ status: 'completed', message: output.trim() });
        }
      } else {
        reject(new Error(errorOutput || `Process exited with code ${code}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}
