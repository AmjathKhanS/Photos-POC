/**
 * Face Embedding Service using ONNX Runtime
 *
 * CROSS-PLATFORM ARCHITECTURE:
 * - Web: onnxruntime-web (this file)
 * - Desktop: onnxruntime (C++/C#) with same model
 * - Mobile: onnxruntime-mobile with same model
 *
 * Model: SFace (face_recognition_sface_2021dec.onnx)
 * - Input: 1x3x112x112 (NCHW, normalized to [-1,1])
 * - Output: 1x128 (L2-normalized embedding)
 *
 * PRIVACY: All processing happens locally. No data leaves the device.
 */

import * as ort from 'onnxruntime-web';

// Embedding dimension (SFace model outputs 128-dim)
export const EMBEDDING_DIM = 128;

// Model input size
const INPUT_WIDTH = 112;
const INPUT_HEIGHT = 112;

// Model path
const MODEL_PATH = '/models/face_recognition.onnx';

let session: ort.InferenceSession | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize ONNX Runtime session
 */
export async function initEmbeddingModel(): Promise<void> {
  if (session) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('Initializing ONNX Runtime for face embeddings...');

      // Configure ONNX Runtime - use WASM backend
      ort.env.wasm.numThreads = 1;

      // Create session with WASM backend only (most compatible)
      session = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });

      console.log('ONNX face embedding model loaded successfully');
      console.log('  Input:', session.inputNames);
      console.log('  Output:', session.outputNames);
    } catch (error) {
      console.error('Failed to load ONNX embedding model:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Check if model is ready
 */
export function isEmbeddingModelReady(): boolean {
  return session !== null;
}

/**
 * Preprocess face image for SFace model
 * Input: ImageData (any size, will be resized)
 * Output: Float32Array in NCHW format, normalized to [-1, 1]
 */
function preprocessFace(imageData: ImageData): Float32Array {
  // Create canvas to resize if needed
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_WIDTH;
  canvas.height = INPUT_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Draw and resize
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0, INPUT_WIDTH, INPUT_HEIGHT);
  const resizedData = ctx.getImageData(0, 0, INPUT_WIDTH, INPUT_HEIGHT);

  // Convert to NCHW format and normalize to [-1, 1]
  const { data, width, height } = resizedData;
  const tensor = new Float32Array(3 * height * width);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];

      // NCHW layout: all R, then all G, then all B
      // Normalize to [-1, 1]: (pixel / 127.5) - 1
      const rIdx = y * width + x;
      const gIdx = height * width + y * width + x;
      const bIdx = 2 * height * width + y * width + x;

      tensor[rIdx] = (r / 127.5) - 1;
      tensor[gIdx] = (g / 127.5) - 1;
      tensor[bIdx] = (b / 127.5) - 1;
    }
  }

  return tensor;
}

/**
 * L2 normalize embedding vector
 */
function l2Normalize(embedding: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) {
    norm += embedding[i] * embedding[i];
  }
  norm = Math.sqrt(norm);

  if (norm === 0) return embedding;

  const normalized = new Float32Array(embedding.length);
  for (let i = 0; i < embedding.length; i++) {
    normalized[i] = embedding[i] / norm;
  }
  return normalized;
}

/**
 * Extract face embedding from cropped face image
 * Returns L2-normalized Float32Array(128)
 */
export async function extractEmbedding(faceImageData: ImageData): Promise<Float32Array> {
  if (!session) {
    await initEmbeddingModel();
  }

  if (!session) {
    throw new Error('ONNX session not initialized');
  }

  // Preprocess image
  const inputTensor = preprocessFace(faceImageData);

  // Create ONNX tensor
  const tensor = new ort.Tensor('float32', inputTensor, [1, 3, INPUT_HEIGHT, INPUT_WIDTH]);

  // Run inference
  const inputName = session.inputNames[0];
  const feeds: Record<string, ort.Tensor> = { [inputName]: tensor };

  const results = await session.run(feeds);

  // Get output
  const outputName = session.outputNames[0];
  const output = results[outputName];
  const embedding = new Float32Array(output.data as Float32Array);

  // L2 normalize
  return l2Normalize(embedding);
}

/**
 * Dispose of ONNX session
 */
export function disposeEmbeddingModel(): void {
  if (session) {
    session.release();
    session = null;
  }
  initPromise = null;
}
