/**
 * Face Detection Service using MediaPipe
 *
 * Cross-platform layer: Uses MediaPipe WASM on web
 * Same logic can be ported to MediaPipe C++ (desktop) or MediaPipe Mobile
 */

import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

export interface FaceBoundingBox {
  x: number;      // left
  y: number;      // top
  width: number;
  height: number;
  // Normalized coordinates (0-1)
  xNorm: number;
  yNorm: number;
  widthNorm: number;
  heightNorm: number;
}

export interface DetectedFace {
  boundingBox: FaceBoundingBox;
  confidence: number;
  // Cropped face image as ImageData for embedding extraction
  faceImageData: ImageData;
}

let faceDetector: FaceDetector | null = null;
let initPromise: Promise<void> | null = null;

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

/**
 * Initialize MediaPipe Face Detector
 */
export async function initFaceDetector(): Promise<void> {
  if (faceDetector) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('Initializing MediaPipe Face Detector...');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU'  // Use GPU if available, falls back to CPU
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
        minSuppressionThreshold: 0.3
      });

      console.log('MediaPipe Face Detector initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Face Detector:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Check if face detector is ready
 */
export function isFaceDetectorReady(): boolean {
  return faceDetector !== null;
}

/**
 * Detect faces in an image
 * Returns bounding boxes and cropped face images for embedding extraction
 */
export async function detectFaces(image: HTMLImageElement | HTMLCanvasElement): Promise<DetectedFace[]> {
  if (!faceDetector) {
    await initFaceDetector();
  }

  if (!faceDetector) {
    throw new Error('Face detector not initialized');
  }

  // Run detection
  const result = faceDetector.detect(image);
  const detections = result.detections;

  if (!detections || detections.length === 0) {
    return [];
  }

  // Get image dimensions
  const imgWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const imgHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;

  // Create canvas for cropping faces
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const faces: DetectedFace[] = [];

  for (const detection of detections) {
    const bbox = detection.boundingBox;
    if (!bbox) continue;

    // MediaPipe returns pixel coordinates
    const x = bbox.originX;
    const y = bbox.originY;
    const width = bbox.width;
    const height = bbox.height;

    // Add padding around face (20% on each side)
    const padding = 0.2;
    const paddedX = Math.max(0, x - width * padding);
    const paddedY = Math.max(0, y - height * padding);
    const paddedWidth = Math.min(imgWidth - paddedX, width * (1 + 2 * padding));
    const paddedHeight = Math.min(imgHeight - paddedY, height * (1 + 2 * padding));

    // Crop face region (standardize to 112x112 for MobileFaceNet)
    const cropSize = 112;
    canvas.width = cropSize;
    canvas.height = cropSize;

    ctx.drawImage(
      image,
      paddedX, paddedY, paddedWidth, paddedHeight,
      0, 0, cropSize, cropSize
    );

    const faceImageData = ctx.getImageData(0, 0, cropSize, cropSize);

    faces.push({
      boundingBox: {
        x: paddedX,
        y: paddedY,
        width: paddedWidth,
        height: paddedHeight,
        xNorm: paddedX / imgWidth,
        yNorm: paddedY / imgHeight,
        widthNorm: paddedWidth / imgWidth,
        heightNorm: paddedHeight / imgHeight
      },
      confidence: detection.categories?.[0]?.score ?? 0,
      faceImageData
    });
  }

  return faces;
}

/**
 * Clean up resources
 */
export function disposeFaceDetector(): void {
  if (faceDetector) {
    faceDetector.close();
    faceDetector = null;
  }
  initPromise = null;
}
