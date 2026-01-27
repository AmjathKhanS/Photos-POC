import { useState, useEffect } from 'react';
import type { Person } from '../types/face';
import { getFaceThumbnailUrl } from '../utils/faceThumbnail';

interface PersonCardProps {
  person: Person;
  onClick: () => void;
}

export function PersonCard({ person, onClick }: PersonCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadThumbnail() {
      setLoading(true);
      try {
        const url = await getFaceThumbnailUrl(person.id);
        if (mounted) {
          setThumbnailUrl(url);
        }
      } catch (error) {
        console.error('Error loading thumbnail:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadThumbnail();

    return () => {
      mounted = false;
    };
  }, [person.id]);

  return (
    <div className="person-card" onClick={onClick}>
      <div className="person-avatar">
        {loading ? (
          <div className="person-avatar-placeholder">
            <div className="placeholder-spinner"></div>
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={person.name}
          />
        ) : (
          <div className="person-avatar-placeholder">
            {person.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="person-info">
        <span className="person-name">{person.name}</span>
        <span className="person-count">{person.face_count} photos</span>
      </div>
    </div>
  );
}
