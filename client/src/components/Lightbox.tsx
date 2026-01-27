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
  }, [currentIndex]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleImageLoad = () => {
    setLoading(false);
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
          {loading && (
            <div className="lightbox-loading">
              <div className="spinner"></div>
            </div>
          )}
          <div className="lightbox-image-wrapper">
            <img
              ref={imageRef}
              src={currentPhoto.fullUrl}
              alt={currentPhoto.filename}
              onLoad={handleImageLoad}
              style={{ opacity: loading ? 0 : 1 }}
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
