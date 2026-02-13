import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { mergePerson } from './personService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_SERVICE_PATH = path.join(__dirname, '../../face-service');
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/faces.db');

// Use ONNX virtual environment Python
const VENV_PYTHON = path.join(__dirname, '../../../venv_onnx/Scripts/python.exe');
const PYTHON_CMD = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : (os.platform() === 'win32' ? 'python' : 'python3');

// Helper function to convert WSL paths to Windows paths when using Windows Python
function toWindowsPath(wslPath: string): string {
  if (!VENV_PYTHON.includes('.exe')) return wslPath;
  return wslPath.replace(/^\/mnt\/([a-z])\//i, (_, drive) => `${drive.toUpperCase()}:\\`).replace(/\//g, '\\');
}

interface DuplicatePair {
  person1_id: number;
  person1_name: string;
  person1_face_count: number;
  person1_representative_face_id: number;
  person2_id: number;
  person2_name: string;
  person2_face_count: number;
  person2_representative_face_id: number;
  similarity: number;
}

interface DuplicateResult {
  duplicates: DuplicatePair[];
  threshold: number;
  total_pairs: number;
}

export async function findDuplicatePersons(threshold: number = 0.85): Promise<DuplicateResult> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(PYTHON_SERVICE_PATH, 'person_duplicate_detector.py');

    // Verify script exists
    if (!fs.existsSync(pythonScript)) {
      return reject(new Error(`Python script not found: ${pythonScript}`));
    }

    console.log('Running duplicate detection with:', {
      pythonCmd: PYTHON_CMD,
      pythonScript,
      dbPath: DB_PATH,
      threshold
    });

    let stdoutData = '';
    let stderrData = '';

    // On Windows, .bat files need to be executed with shell: true
    const spawnOptions = PYTHON_CMD.endsWith('.bat') ? { shell: true } : {};
    const process = spawn(PYTHON_CMD, [
      toWindowsPath(pythonScript),
      '--db-path', toWindowsPath(DB_PATH),
      '--threshold', threshold.toString()
    ], spawnOptions);

    process.stdout?.on('data', (data) => {
      stdoutData += data.toString();
    });

    process.stderr?.on('data', (data) => {
      const errorText = data.toString();
      console.error('Python stderr:', errorText);
      stderrData += errorText;
    });

    process.on('close', (code) => {
      if (code === 0) {
        try {
          // Parse the last line of stdout (JSON result)
          const lines = stdoutData.trim().split('\n');
          const jsonLine = lines[lines.length - 1];
          const result = JSON.parse(jsonLine);

          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${e}`));
        }
      } else {
        reject(new Error(`Python process exited with code ${code}: ${stderrData}`));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });
  });
}

export function mergePersons(sourcePersonId: number, targetPersonId: number): void {
  console.log(`Merging Person ${sourcePersonId} into Person ${targetPersonId}`);
  mergePerson(sourcePersonId, targetPersonId);
}
