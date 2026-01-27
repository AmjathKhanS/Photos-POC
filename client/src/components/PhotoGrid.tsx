import { useEffect, useRef } from 'react';
import type { Photo } from '../types/photo';
import { PhotoCard } from './PhotoCard';

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (index: number) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
}

export function PhotoGrid({ photos, onPhotoClick, hasMore, onLoadMore, loading }: PhotoGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
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
          />
        ))}
      </div>
      {hasMore && (
        <div ref={loadMoreRef} className="load-more">
          {loading ? 'Loading more...' : 'Scroll for more'}
        </div>
      )}
    </div>
  );
}
