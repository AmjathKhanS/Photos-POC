import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Photo } from '../types/photo';

interface PhotosContextValue {
  photos: Photo[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  page: number;
  loadMore: () => void;
  refetch: () => void;
  isInitialized: boolean;
}

const PhotosContext = createContext<PhotosContextValue | undefined>(undefined);

export function PhotosProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

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
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount - only run when isInitialized changes
  useEffect(() => {
    if (!isInitialized) {
      fetchPhotos(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

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
    setIsInitialized(false);
    fetchPhotos(1, false);
  }, [fetchPhotos]);

  return (
    <PhotosContext.Provider
      value={{
        photos,
        loading,
        error,
        hasMore,
        total,
        page,
        loadMore,
        refetch,
        isInitialized,
      }}
    >
      {children}
    </PhotosContext.Provider>
  );
}

export function usePhotosContext() {
  const context = useContext(PhotosContext);
  if (context === undefined) {
    throw new Error('usePhotosContext must be used within a PhotosProvider');
  }
  return context;
}
