import { useState, useEffect, useRef } from 'react';
import type { Person } from '../types/face';
import { getFaceThumbnailUrlDirect } from '../utils/faceThumbnail';

interface PersonCardProps {
  person: Person;
  onClick: () => void;
}

export function PersonCard({ person, onClick }: PersonCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Get thumbnail URL directly from person data (no API call needed!)
  const thumbnailUrl = getFaceThumbnailUrlDirect(
    (person as any).thumbnail_face_id || person.representative_face_id
  );

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    if (!cardRef.current) return;

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
        rootMargin: '50px', // Start loading 50px before visible
        threshold: 0.01
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const showPlaceholder = !thumbnailUrl || imageError || (!imageLoaded && isVisible);

  return (
    <div ref={cardRef} className="person-card" onClick={onClick}>
      <div className="person-avatar">
        {showPlaceholder ? (
          <div className="person-avatar-placeholder">
            {!isVisible ? (
              <div className="placeholder-shimmer"></div>
            ) : imageError || !thumbnailUrl ? (
              person.name.charAt(0).toUpperCase()
            ) : (
              <div className="placeholder-spinner"></div>
            )}
          </div>
        ) : null}

        {thumbnailUrl && isVisible && (
          <img
            src={thumbnailUrl}
            alt={person.name}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              opacity: imageLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out'
            }}
            loading="lazy"
          />
        )}
      </div>
      <div className="person-info">
        <span className="person-name">{person.name}</span>
        <span className="person-count">{person.face_count} photos</span>
      </div>
    </div>
  );
}
