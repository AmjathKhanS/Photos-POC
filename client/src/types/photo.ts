export interface Photo {
  id: string;
  filename: string;
  thumbnailUrl: string;
  fullUrl: string;
  mimeType: string;
  size: number;
  modifiedAt: string;
  width?: number;
  height?: number;
  isScreenshot?: boolean;
  // EXIF metadata
  dateTaken?: string;
  cameraMake?: string;
  cameraModel?: string;
  iso?: number;
  aperture?: number;
  shutterSpeed?: string;
  focalLength?: number;
  lensModel?: string;
}
