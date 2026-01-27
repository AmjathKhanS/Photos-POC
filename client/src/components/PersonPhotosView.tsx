import { useState, useEffect } from 'react';
import type { Person } from '../types/face';

interface PersonPhoto {
  id: string;
  filename: string;
  thumbnailUrl: string;
  fullUrl: string;
}

interface PersonPhotosViewProps {
  person: Person;
  onBack: () => void;
  onPhotoClick: (photos: PersonPhoto[], index: number) => void;
}

export function PersonPhotosView({
  person,
  onBack,
  onPhotoClick,
}: PersonPhotosViewProps) {
  const [personPhotos, setPersonPhotos] = useState<PersonPhoto[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(person.name);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPersonPhotos();
  }, [person.id]);

  const fetchPersonPhotos = async () => {
    try {
      setLoading(true);
      // Fetch from backend API
      const response = await fetch(`/api/faces/persons/${person.id}/photos`);
      if (!response.ok) {
        throw new Error('Failed to fetch person photos');
      }
      const photoData = await response.json();

      // Construct photo objects from API response
      const photos: PersonPhoto[] = photoData.map((p: { filename: string }) => ({
        id: btoa(p.filename),
        filename: p.filename,
        thumbnailUrl: `/api/photos/thumbnail/${encodeURIComponent(p.filename)}`,
        fullUrl: `/api/photos/full/${encodeURIComponent(p.filename)}`,
      }));

      setPersonPhotos(photos);
    } catch (error) {
      console.error('Error fetching person photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (newName.trim() && newName !== person.name) {
      try {
        // Update via backend API
        const response = await fetch(`/api/faces/persons/${person.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim() })
        });
        if (!response.ok) {
          throw new Error('Failed to rename person');
        }
      } catch (error) {
        console.error('Error renaming person:', error);
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setNewName(person.name);
      setIsEditing(false);
    }
  };

  const handlePhotoClick = (index: number) => {
    // Pass the person's photos and the clicked index to open lightbox
    onPhotoClick(personPhotos, index);
  };

  return (
    <div className="person-photos-view">
      <div className="person-photos-header">
        <button className="btn-back" onClick={onBack}>
          ← Back to People
        </button>
        <div className="person-photos-title">
          {isEditing ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              autoFocus
              className="person-name-input"
            />
          ) : (
            <h2 onClick={() => setIsEditing(true)} className="person-name-editable">
              {newName || person.name}
              <span className="edit-hint">✏️</span>
            </h2>
          )}
          <span className="photo-count">{personPhotos.length} photos</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading photos...</p>
        </div>
      ) : personPhotos.length === 0 ? (
        <div className="people-empty">
          <p>No photos found for {person.name}.</p>
        </div>
      ) : (
        <div className="photo-grid">
          {personPhotos.map((photo, index) => (
            <div
              key={photo.id}
              className="photo-card"
              onClick={() => handlePhotoClick(index)}
            >
              <img
                src={photo.thumbnailUrl}
                alt={photo.filename}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
