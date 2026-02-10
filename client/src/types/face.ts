export interface BoundingBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Face {
  id: number;
  photo_filename: string;
  face_index: number;
  bounding_box: BoundingBox;
  person_id: number | null;
  person_name: string | null;
}

export interface Person {
  id: number;
  name: string;
  representative_face_id: number | null;
  thumbnail_face_id?: number | null; // Computed field for quick thumbnail access
  face_count: number;
  created_at: string;
}

export interface ScanStatus {
  status: 'idle' | 'scanning' | 'completed' | 'error';
  total: number;
  processed: number;
  currentPhoto?: string;
  error?: string;
}

export interface FaceStats {
  totalPhotos: number;
  processedPhotos: number;
  totalFaces: number;
  totalPersons: number;
}
