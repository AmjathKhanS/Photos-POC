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

export function runFaceClustering(eps?: number, minSamples?: number): Promise<ClusteringResult> {
  return new Promise((resolve, reject) => {
    // Use environment variables for optimal clustering or fallback to parameters
    const clusteringEps = eps ?? parseFloat(process.env.CLUSTERING_EPS || '0.65');
    const clusteringMinSamples = minSamples ?? parseInt(process.env.CLUSTERING_MIN_SAMPLES || '2');
    const clusteringMetric = process.env.CLUSTERING_METRIC || 'cosine';

    console.log(`Running face clustering with eps=${clusteringEps}, minSamples=${clusteringMinSamples}, metric=${clusteringMetric}`);

    // Use ONNX clustering (optimized for 512-D embeddings with cosine similarity)
    const pythonScript = path.join(PYTHON_SERVICE_PATH, 'face_clustering_onnx.py');

    // On Windows, .bat files need to be executed with shell: true
    const spawnOptions = PYTHON_CMD.endsWith('.bat') ? { shell: true } : {};
    const clusterProcess = spawn(PYTHON_CMD, [
      toWindowsPath(pythonScript),
      '--db-path', toWindowsPath(DB_PATH),
      '--eps', clusteringEps.toString(),
      '--min-samples', clusteringMinSamples.toString(),
      '--metric', clusteringMetric  // Use cosine similarity for ONNX embeddings
    ], spawnOptions);

    let output = '';
    let errorOutput = '';

    clusterProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });

    clusterProcess.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    clusterProcess.on('close', (code) => {
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

    clusterProcess.on('error', (err) => {
      reject(err);
    });
  });
}
