import { useEffect, useRef } from 'react';
import type { Photo } from '../types/photo';
import { PhotoCard } from './PhotoCard';

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (index: number) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
  selectedPhotoIds?: Set<string>;
  selectionMode?: boolean;
}

export function PhotoGrid({
  photos,
  onPhotoClick,
  hasMore,
  onLoadMore,
  loading,
  selectedPhotoIds = new Set(),
  selectionMode = false
}: PhotoGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // PhotoCards handle their own prefetching now - no need for duplicate work here

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          // Trigger immediately without delay
          console.log('[PhotoGrid] 🔄 Loading next page...');
          onLoadMore();
        }
      },
      {
        threshold: 0,
        rootMargin: '50000px' // Load 50 screens ahead for instant local file access
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, onLoadMore, loading]);

  return (
    <div className="photo-grid-container">
      <div className="photo-grid">
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onClick={() => onPhotoClick(index)}
            isSelected={selectedPhotoIds.has(photo.id)}
            selectionMode={selectionMode}
          />
        ))}
      </div>
      {hasMore && (
        <div ref={loadMoreRef} className="load-more" style={{ opacity: 0, height: '1px' }}>
          {/* Hidden trigger for pagination - no visible loader */}
        </div>
      )}
    </div>
  );
}
