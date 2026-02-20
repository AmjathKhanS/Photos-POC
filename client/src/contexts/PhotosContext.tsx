import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Photo } from '../types/photo';
import { fetchWithRetry } from '../utils/fetchWithRetry';

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

  // Aggressively prefetch ALL full images for instant lightbox - local files can handle it
  const prefetchFullImages = useCallback((photos: Photo[]) => {
    // Prefetch ALL photos in the current page immediately - no delays for local files
    photos.forEach((photo) => {
      const img = new Image();
      img.src = photo.fullUrl;
    });
  }, []);

  // Ultra-aggressive: Prefetch ALL remaining pages immediately - fire and forget
  const prefetchAllRemainingPages = useCallback((totalPhotos: number, currentPage: number) => {
    const pageSize = 120;
    const totalPages = Math.ceil(totalPhotos / pageSize);
    const remainingPages = totalPages - currentPage;

    if (remainingPages <= 0) return;

    console.log(`[PhotosContext] 🌐 INSTANT PREFETCH: Firing ALL ${remainingPages} remaining pages (${remainingPages * pageSize} photos) - thumbnails + full images...`);

    // Fire ALL requests instantly - don't wait for anything
    for (let pageNum = currentPage + 1; pageNum <= totalPages; pageNum++) {
      // Fire and forget - maximum parallelization
      (async () => {
        try {
          // Use direct fetch for maximum speed - no retry overhead
          const response = await fetch(`/api/photos?page=${pageNum}&limit=${pageSize}`);
          if (!response.ok) return;

          const data = await response.json();

          // Preload thumbnails + full images immediately for instant lightbox
          data.photos.forEach((photo: Photo) => {
            // Thumbnail
            const thumb = new Image();
            thumb.src = photo.thumbnailUrl;

            // Full image for instant lightbox
            const full = new Image();
            full.src = photo.fullUrl;
          });

          if (pageNum % 10 === 0) {
            console.log(`[PhotosContext] ✅ Prefetched thumbnails + full images up to page ${pageNum}`);
          }
        } catch (err) {
          // Silent fail for prefetch
        }
      })();
    }

    console.log(`[PhotosContext] 🎉 ALL ${totalPhotos} thumbnail + full image requests fired instantly!`);
  }, []);

  const fetchPhotos = useCallback(async (pageNum: number, append: boolean = false) => {
    try {
      console.log(`[PhotosContext] Fetching page ${pageNum}, append=${append}`);
      setLoading(true);
      setError(null);

      const response = await fetchWithRetry(`/api/photos?page=${pageNum}&limit=120`);
      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }
      const data = await response.json();
      console.log(`[PhotosContext] Received ${data.photos.length} photos for page ${pageNum}`);

      // Immediately start preloading thumbnails + full images BEFORE setting state
      data.photos.forEach((photo: Photo) => {
        const thumb = new Image();
        thumb.src = photo.thumbnailUrl;

        const full = new Image();
        full.src = photo.fullUrl;
      });

      // Update state immediately - don't wait for images to load
      if (append) {
        setPhotos(prev => {
          const newPhotos = [...prev, ...data.photos];
          console.log(`[PhotosContext] Total photos after append: ${newPhotos.length}`);
          return newPhotos;
        });
        // Prefetch full images for newly added photos
        prefetchFullImages(data.photos);
      } else {
        setPhotos(data.photos);
        console.log(`[PhotosContext] Set initial photos: ${data.photos.length}`);
        // Prefetch full images for current page
        prefetchFullImages(data.photos);
      }
      setHasMore(data.hasMore);
      setTotal(data.total);
      setIsInitialized(true);
      setLoading(false);

      // ALWAYS prefetch ALL remaining pages - instant firing
      if (data.hasMore) {
        // Fire prefetch for ALL remaining pages regardless of which page we're on
        const totalPages = Math.ceil(data.total / 120);
        const remainingPages = totalPages - pageNum;

        if (remainingPages > 0) {
          console.log(`[PhotosContext] 🚀 Firing instant prefetch for ${remainingPages} remaining pages`);
          prefetchAllRemainingPages(data.total, pageNum);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [prefetchFullImages, prefetchAllRemainingPages]);

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
      console.log(`[PhotosContext] Loading page ${nextPage}...`);
      setPage(nextPage);
      fetchPhotos(nextPage, true);
    } else {
      console.log(`[PhotosContext] Cannot load more: loading=${loading}, hasMore=${hasMore}`);
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
