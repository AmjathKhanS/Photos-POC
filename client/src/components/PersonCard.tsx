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
  const [retryCount, setRetryCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Get thumbnail URL directly from person data (no API call needed!)
  const thumbnailUrl = getFaceThumbnailUrlDirect(
    (person as any).thumbnail_face_id || person.representative_face_id
  );

  // Add cache buster for retries
  const thumbnailUrlWithRetry = thumbnailUrl && retryCount > 0
    ? `${thumbnailUrl}?retry=${retryCount}`
    : thumbnailUrl;

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
    setImageError(false);
  };

  const handleImageError = () => {
    // Retry up to 2 times before giving up
    if (retryCount < 2) {
      console.log(`Retrying thumbnail for ${person.name} (attempt ${retryCount + 1})...`);
      setRetryCount(retryCount + 1);
      setImageLoaded(false);
    } else {
      console.error(`Failed to load thumbnail for ${person.name} after ${retryCount + 1} attempts`);
      setImageError(true);
    }
  };

  const showPlaceholder = !thumbnailUrlWithRetry || imageError || (!imageLoaded && isVisible);

  return (
    <div ref={cardRef} className="person-card" onClick={onClick}>
      <div className="person-avatar">
        {showPlaceholder ? (
          <div className="person-avatar-placeholder">
            {!isVisible ? (
              <div className="placeholder-shimmer"></div>
            ) : imageError || !thumbnailUrlWithRetry ? (
              person.name.charAt(0).toUpperCase()
            ) : (
              <div className="placeholder-spinner"></div>
            )}
          </div>
        ) : null}

        {thumbnailUrlWithRetry && isVisible && (
          <img
            src={thumbnailUrlWithRetry}
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
