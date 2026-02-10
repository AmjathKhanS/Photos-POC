import { useEffect, useState } from 'react';
import { PhotoGrid } from './PhotoGrid';
import type { Photo } from '../types/photo';

interface Location {
  type: 'city' | 'country';
  city?: string;
  country: string;
  count: number;
}

interface LocationPhotosViewProps {
  location: Location;
  onBack: () => void;
  onPhotoClick: (photos: Photo[], index: number) => void;
}

interface PhotoLocation {
  photo_filename: string;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

export function LocationPhotosView({ location, onBack, onPhotoClick }: LocationPhotosViewProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocationPhotos();
  }, [location]);

  const fetchLocationPhotos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch location data
      let url: string;
      if (location.type === 'city' && location.city) {
        url = `/api/locations/city/${encodeURIComponent(location.city)}/${encodeURIComponent(location.country)}`;
      } else {
        url = `/api/locations/country/${encodeURIComponent(location.country)}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch location photos');

      const locationData: PhotoLocation[] = await response.json();

      // Convert location data to photo format
      const photosData: Photo[] = locationData.map((loc) => {
        const baseUrl = window.location.origin;
        return {
          id: loc.photo_filename,
          filename: loc.photo_filename,
          thumbnailUrl: `${baseUrl}/api/photos/thumbnail/${encodeURIComponent(loc.photo_filename)}`,
          fullUrl: `${baseUrl}/api/photos/full/${encodeURIComponent(loc.photo_filename)}`,
          modifiedAt: '',
        };
      });

      setPhotos(photosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (location.type === 'city') {
      return `${location.city}, ${location.country}`;
    }
    return location.country;
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📍</div>
        <h2>Loading photos...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <h2>Error loading photos</h2>
        <p>{error}</p>
        <button onClick={onBack} className="btn-primary" style={{ marginTop: '16px' }}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="location-photos-view">
      <div className="view-header">
        <button onClick={onBack} className="back-button">
          ← Back to Places
        </button>
        <div>
          <h2>📍 {getTitle()}</h2>
          <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </p>
        </div>
      </div>

      <PhotoGrid
        photos={photos}
        onPhotoClick={(index) => onPhotoClick(photos, index)}
        hasMore={false}
        onLoadMore={() => {}}
        loading={false}
      />
    </div>
  );
}
