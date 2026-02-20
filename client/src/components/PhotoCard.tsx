import { useState, useRef, memo } from 'react';
import type { Photo } from '../types/photo';

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
  isSelected?: boolean;
  selectionMode?: boolean;
}

export const PhotoCard = memo(function PhotoCard({ photo, onClick, isSelected = false, selectionMode = false }: PhotoCardProps) {
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleImageError = () => {
    // Retry immediately up to 3 times
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      setError(false);
      // Force immediate image reload
      if (imgRef.current) {
        imgRef.current.src = photo.thumbnailUrl + '?retry=' + (retryCount + 1);
      }
    } else {
      setError(true);
    }
  };

  // Prefetch full image on hover for instant lightbox
  const handleMouseEnter = () => {
    const img = new Image();
    img.src = photo.fullUrl;
  };

  // Completely remove failed images from grid - no empty space
  if (error) {
    return null;
  }

  return (
    <div
      ref={cardRef}
      className={`photo-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
    >
      {selectionMode && (
        <div className={`photo-card-checkbox ${isSelected ? 'checked' : ''}`} />
      )}

      <img
        ref={imgRef}
        src={photo.thumbnailUrl}
        alt={photo.filename}
        onError={handleImageError}
        decoding="async"
      />
    </div>
  );
});
