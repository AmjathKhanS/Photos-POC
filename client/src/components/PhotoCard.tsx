import { useState } from 'react';
import type { Photo } from '../types/photo';

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="photo-card" onClick={onClick}>
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
        <img
          src={photo.thumbnailUrl}
          alt={photo.filename}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
    </div>
  );
}
