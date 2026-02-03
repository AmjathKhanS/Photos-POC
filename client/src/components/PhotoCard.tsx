import { useState, useEffect, useRef } from 'react';
import type { Photo } from '../types/photo';

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
  isSelected?: boolean;
  selectionMode?: boolean;
}

export function PhotoCard({ photo, onClick, isSelected = false, selectionMode = false }: PhotoCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleImageLoad = () => {
    setLoaded(true);
    if (imgRef.current) {
      imgRef.current.decode().catch(() => {});
    }
  };

  return (
    <div
      ref={cardRef}
      className={`photo-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {selectionMode && (
        <div className={`photo-card-checkbox ${isSelected ? 'checked' : ''}`} />
      )}

      {!loaded && !error && (
        <div className="photo-card-placeholder">
          <div className="placeholder-spinner"></div>
        </div>
      )}
      {error ? (
        <div className="photo-card-error">
          <span>Failed to load</span>
        </div>
      ) : (
        isVisible && (
          <img
            ref={imgRef}
            src={photo.thumbnailUrl}
            alt={photo.filename}
            onLoad={handleImageLoad}
            onError={() => setError(true)}
            style={{ opacity: loaded ? 1 : 0 }}
            decoding="async"
            fetchpriority="low"
          />
        )
      )}
    </div>
  );
}
