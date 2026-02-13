import React, { useEffect } from 'react';
import { useSmartAlbumsContext, type SmartAlbum } from '../contexts/SmartAlbumsContext';

interface SmartAlbumsViewProps {
  onAlbumClick: (album: SmartAlbum) => void;
  onGenerateAlbums: () => void;
}

export const SmartAlbumsView: React.FC<SmartAlbumsViewProps> = ({
  onAlbumClick,
  onGenerateAlbums,
}) => {
  const { albums, loading, error, generating, refetch, generateAlbums, fetchIfNeeded } = useSmartAlbumsContext();

  // Fetch albums data when this view is shown
  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const handleGenerateAlbums = async () => {
    try {
      await generateAlbums({
        epsVisual: 0.25,      // Visual similarity threshold (pure cosine distance)
        minSamples: 2,         // Minimum 2 photos per album
        maxWindowDays: 7,      // Maximum 7-day span per album
        maxGapDays: 2,         // Maximum 2-day gap between photos
        replaceExisting: true,
      });
      onGenerateAlbums();
    } catch (err) {
      console.error('Failed to generate albums:', err);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (startDate.toDateString() === endDate.toDateString()) {
      return formatDate(start);
    }

    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDate.getDate()}-${endDate.getDate()} ${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }

    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (loading) {
    return (
      <div className="smart-albums-loading">
        <div className="loading-spinner"></div>
        <p>Loading smart albums...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="smart-albums-error">
        <h3>⚠️ Error</h3>
        <p>{error}</p>
        <button onClick={refetch} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="smart-albums-view">
      <div className="smart-albums-header">
        <div className="header-content">
          <h2>🎨 Smart Albums</h2>
          <p className="subtitle">
            AI-generated albums based on visual similarity and time
          </p>
        </div>
        <div className="header-actions">
          <button
            className="refresh-button"
            onClick={refetch}
            disabled={loading}
            title="Refresh albums"
          >
            <span>{loading ? '⟳' : '↻'}</span>
          </button>
          <button
            onClick={handleGenerateAlbums}
            disabled={generating}
            className="generate-button"
          >
            {generating ? '⏳ Generating...' : '✨ Generate Albums'}
          </button>
        </div>
      </div>

      {albums.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📸</div>
          <h3>No Smart Albums Yet</h3>
          <p>Click "Generate Albums" to automatically organize your photos into albums</p>
          <button onClick={handleGenerateAlbums} disabled={generating} className="generate-button-large">
            {generating ? '⏳ Generating Albums...' : '✨ Generate Smart Albums'}
          </button>
        </div>
      ) : (
        <>
          <div className="albums-stats">
            <div className="stat">
              <span className="stat-value">{albums.length}</span>
              <span className="stat-label">Albums</span>
            </div>
            <div className="stat">
              <span className="stat-value">{albums.reduce((sum, a) => sum + a.photo_count, 0)}</span>
              <span className="stat-label">Photos</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {Math.round((albums.reduce((sum, a) => sum + (a.avg_similarity || 0), 0) / albums.length) * 100)}%
              </span>
              <span className="stat-label">Avg Similarity</span>
            </div>
          </div>

          <div className="albums-grid">
            {albums.map((album) => (
              <div
                key={album.id}
                className="album-card"
                onClick={() => onAlbumClick(album)}
              >
                <div className="album-cover">
                  {album.cover_photo_filename ? (
                    <img
                      src={`http://localhost:3002/api/photos/thumbnail/${album.cover_photo_filename}`}
                      alt={album.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="album-cover-placeholder">📷</div>
                  )}
                  <div className="album-overlay">
                    <span className="photo-count">{album.photo_count} photos</span>
                  </div>
                </div>
                <div className="album-info">
                  <h3 className="album-title">{album.title}</h3>
                  {album.description && (
                    <p className="album-description">{album.description}</p>
                  )}
                  <div className="album-meta">
                    <span className="album-date">
                      📅 {formatDateRange(album.start_date, album.end_date)}
                    </span>
                    {album.avg_similarity && (
                      <span className="album-similarity">
                        ✨ {Math.round(album.avg_similarity * 100)}% similar
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
