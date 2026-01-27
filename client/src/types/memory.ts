export interface Memory {
  id: number;
  memory_type: 'on_this_day' | 'weekly' | 'monthly' | 'seasonal' | 'people';
  title: string;
  description: string | null;
  date_start: string | null;
  date_end: string | null;
  person_id: number | null;
  memory_date: string;
  photo_count: number;
  cover_photo_filename: string | null;
  generated_at: string;
  is_dismissed: number;
}

export interface MemoryPhoto {
  memory_id: number;
  photo_filename: string;
  importance_score: number;
  display_order: number;
}

export interface MemoryWithPhotos extends Memory {
  photos: MemoryPhoto[];
}
