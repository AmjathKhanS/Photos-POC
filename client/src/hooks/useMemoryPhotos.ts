import { useState, useEffect } from 'react';
import type { MemoryPhoto } from '../types/memory';
import type { Photo } from '../types/photo';

const API_BASE = '/api';

export function useMemoryPhotos(memoryId: number) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch memory photos (filenames with scores)
        const photosResponse = await fetch(`${API_BASE}/memories/${memoryId}/photos`);
        if (!photosResponse.ok) {
          throw new Error('Failed to fetch memory photos');
        }

        const memoryPhotos: MemoryPhoto[] = await photosResponse.json();

        // Convert to Photo format with proper URLs
        const photoList: Photo[] = memoryPhotos.map((mp, index) => ({
          id: `${memoryId}-${index}`,
          filename: mp.photo_filename,
          thumbnailUrl: `${API_BASE}/photos/thumbnail/${encodeURIComponent(mp.photo_filename)}`,
          fullUrl: `${API_BASE}/photos/full/${encodeURIComponent(mp.photo_filename)}`,
          mimeType: 'image/jpeg',
          size: 0,
          modifiedAt: new Date().toISOString()
        }));

        setPhotos(photoList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching memory photos:', err);
      } finally {
        setLoading(false);
      }
    };

    if (memoryId) {
      fetchPhotos();
    }
  }, [memoryId]);

  return {
    photos,
    loading,
    error
  };
}
