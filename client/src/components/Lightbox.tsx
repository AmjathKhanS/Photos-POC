import { useState, useEffect, useRef } from 'react';
import type { Photo } from '../types/photo';
import { useKeyboard } from '../hooks/useKeyboard';

interface LightboxProps {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate
}: LightboxProps) {
  const [loading, setLoading] = useState(true);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const currentPhoto = photos[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  useKeyboard({
    onEscape: onClose,
    onArrowLeft: handlePrevious,
    onArrowRight: handleNext,
    enabled: true
  });

  useEffect(() => {
    setLoading(true);
    setShowThumbnail(true);
    setThumbnailLoaded(false);
  }, [currentIndex]);

  // Aggressively prefetch surrounding images for instant navigation
  useEffect(() => {
    // Prefetch 10 images in each direction for instant navigation
    const prefetchRange = 10;
    const startIndex = Math.max(0, currentIndex - prefetchRange);
    const endIndex = Math.min(photos.length - 1, currentIndex + prefetchRange);

    for (let i = startIndex; i <= endIndex; i++) {
      if (i !== currentIndex) {
        const img = new Image();
        img.src = photos[i].fullUrl;
      }
    }
  }, [currentIndex, photos]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleImageLoad = () => {
    setLoading(false);
    // Instantly hide thumbnail when full image loads (no delay for local files)
    setShowThumbnail(false);
  };

  const handleThumbnailLoad = () => {
    setThumbnailLoaded(true);
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="lightbox-close" onClick={onClose}>
          &times;
        </button>

        {/* Navigation buttons */}
        {currentIndex > 0 && (
          <button className="lightbox-nav lightbox-prev" onClick={handlePrevious}>
            &#8249;
          </button>
        )}
        {currentIndex < photos.length - 1 && (
          <button className="lightbox-nav lightbox-next" onClick={handleNext}>
            &#8250;
          </button>
        )}

        {/* Image container */}
        <div className="lightbox-image-container">
          {/* Show thumbnail as instant placeholder while full image loads */}
          {showThumbnail && (
            <div className="lightbox-thumbnail-placeholder">
              <img
                src={currentPhoto.thumbnailUrl}
                alt={currentPhoto.filename}
                onLoad={handleThumbnailLoad}
                style={{
                  filter: loading ? 'blur(8px)' : 'blur(0px)',
                  opacity: thumbnailLoaded ? 1 : 0,
                  transition: 'opacity 0.01s, filter 0.05s', // Ultra-fast for local files
                  transform: 'scale(1.05)' // Slight scale to hide blur edges
                }}
              />
            </div>
          )}

          {/* Full resolution image */}
          <div className="lightbox-image-wrapper">
            <img
              ref={imageRef}
              src={currentPhoto.fullUrl}
              alt={currentPhoto.filename}
              onLoad={handleImageLoad}
              style={{
                opacity: loading ? 0 : 1,
                transition: 'opacity 0.05s ease-in' // Instant for prefetched local files
              }}
              decoding="async"
              loading="eager"
            />
          </div>
        </div>

        {/* Photo info */}
        <div className="lightbox-info">
          <span className="lightbox-filename">{currentPhoto.filename}</span>
          <span className="lightbox-counter">
            {currentIndex + 1} / {photos.length}
          </span>
        </div>
      </div>
    </div>
  );
}
