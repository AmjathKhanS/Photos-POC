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
}
