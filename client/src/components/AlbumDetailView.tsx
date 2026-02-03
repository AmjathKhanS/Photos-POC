import React, { useState, useEffect } from 'react';
import type { Photo } from '../types/photo';

interface SmartAlbum {
  id: number;
  title: string;
  description: string | null;
  cover_photo_filename: string | null;
  start_date: string | null;
  end_date: string | null;
  photo_count: number;
  avg_similarity: number | null;
}

interface AlbumPhoto extends Photo {
  similarity_score: number | null;
  is_cover: boolean;
}

interface AlbumDetailViewProps {
  album: SmartAlbum;
  onBack: () => void;
  onPhotoClick: (photos: Photo[], index: number) => void;
}

export const AlbumDetailView: React.FC<AlbumDetailViewProps> = ({
  album,
  onBack,
  onPhotoClick,
}) => {
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedTitle, setEditedTitle] = useState(album.title);
  const [editedDescription, setEditedDescription] = useState(album.description || '');

  const loadAlbumPhotos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`http://localhost:3002/api/smart-albums/${album.id}`);
      const data = await response.json();

      if (data.success) {
        setPhotos(data.album.photos);
      } else {
        setError(data.error || 'Failed to load album photos');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load album photos');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`http://localhost:3002/api/smart-albums/${album.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editedTitle,
          description: editedDescription,
        }),
      });

      const data = await response.json();

      if (data.success) {
        album.title = editedTitle;
        album.description = editedDescription;
        setEditMode(false);
      } else {
        setError(data.error || 'Failed to update album');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update album');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${album.title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3002/api/smart-albums/${album.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        onBack();
      } else {
        setError(data.error || 'Failed to delete album');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete album');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  useEffect(() => {
    loadAlbumPhotos();
  }, [album.id]);

  if (loading) {
    return (
      <div className="album-detail-loading">
        <div className="loading-spinner"></div>
        <p>Loading album...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="album-detail-error">
        <h3>⚠️ Error</h3>
        <p>{error}</p>
        <button onClick={loadAlbumPhotos} className="retry-button">
          Retry
        </button>
        <button onClick={onBack} className="back-button">
          ← Back to Albums
        </button>
      </div>
    );
  }

  return (
    <div className="album-detail-view">
      <div className="album-detail-header">
        <button onClick={onBack} className="back-button">
          ← Back to Albums
        </button>

        <div className="album-header-content">
          {editMode ? (
            <div className="album-edit-form">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="album-title-input"
                placeholder="Album title"
              />
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="album-description-input"
                placeholder="Album description"
                rows={2}
              />
              <div className="edit-actions">
                <button onClick={handleSaveEdit} className="save-button">
                  Save
                </button>
                <button onClick={() => setEditMode(false)} className="cancel-button">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="album-title-section">
                <h2>{album.title}</h2>
                <div className="album-actions">
                  <button onClick={() => setEditMode(true)} className="edit-button" title="Edit album">
                    ✏️
                  </button>
                  <button onClick={handleDelete} className="delete-button" title="Delete album">
                    🗑️
                  </button>
                </div>
              </div>
              {album.description && <p className="album-description-large">{album.description}</p>}
              <div className="album-metadata">
                <span className="meta-item">
                  📸 {photos.length} photos
                </span>
                <span className="meta-item">
                  📅 {formatDate(album.start_date)} - {formatDate(album.end_date)}
                </span>
                {album.avg_similarity && (
                  <span className="meta-item">
                    ✨ {Math.round(album.avg_similarity * 100)}% similarity
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="album-photos-grid">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className={`photo-card ${photo.is_cover ? 'cover-photo' : ''}`}
            onClick={() => onPhotoClick(photos, index)}
          >
            <img
              src={photo.thumbnailUrl}
              alt={photo.filename}
              loading="lazy"
            />
            {photo.is_cover && (
              <div className="cover-badge">Cover</div>
            )}
            {photo.similarity_score !== null && (
              <div className="similarity-badge">
                {Math.round(photo.similarity_score * 100)}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
