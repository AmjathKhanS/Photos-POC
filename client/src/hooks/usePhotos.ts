import { useState, useEffect, useCallback } from 'react';
import type { Photo } from '../types/photo';

interface UsePhotosResult {
  photos: Photo[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  loadMore: () => void;
  refetch: () => void;
}

export function usePhotos(): UsePhotosResult {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchPhotos = useCallback(async (pageNum: number, append: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/photos?page=${pageNum}&limit=50`);
      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }
      const data = await response.json();

      if (append) {
        setPhotos(prev => [...prev, ...data.photos]);
      } else {
        setPhotos(data.photos);
      }
      setHasMore(data.hasMore);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos(1, false);
  }, [fetchPhotos]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPhotos(nextPage, true);
    }
  }, [loading, hasMore, page, fetchPhotos]);

  const refetch = useCallback(() => {
    setPage(1);
    setPhotos([]);
    fetchPhotos(1, false);
  }, [fetchPhotos]);

  return { photos, loading, error, hasMore, total, loadMore, refetch };
}
