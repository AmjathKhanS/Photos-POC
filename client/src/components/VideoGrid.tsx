import { useState, useEffect } from 'react';
import type { Video } from '../types/video';

interface VideoGridProps {
  onVideoClick: (video: Video) => void;
}

export function VideoGrid({ onVideoClick }: VideoGridProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/videos');
        const data = await response.json();

        if (response.ok) {
          setVideos(data.videos || []);
        } else {
          setError('Failed to load videos');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load videos');
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  if (loading) {
    return (
      <div className="video-grid-loading">
        <div className="loading-spinner"></div>
        <p>Loading videos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-grid-error">
        <h3>⚠️ Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="video-grid-empty">
        <div className="empty-icon">🎥</div>
        <h3>No Videos Found</h3>
        <p>No video files were found in your photos directory</p>
        <p className="supported-formats">
          Supported formats: MP4, MOV, AVI, MKV, WEBM, M4V, 3GP, WMV
        </p>
      </div>
    );
  }

  return (
    <div className="video-view">
      <div className="video-header">
        <h2>🎥 Videos</h2>
        <p className="video-count">{videos.length} videos</p>
      </div>

      <div className="video-grid">
        {videos.map((video) => (
          <div
            key={video.id}
            className="video-card"
            onClick={() => onVideoClick(video)}
          >
            <div className="video-thumbnail">
              <img src={video.thumbnailUrl} alt={video.filename} loading="lazy" />
              <div className="video-play-overlay">
                <div className="play-button">▶</div>
              </div>
              <div className="video-duration-badge">
                {(video.size / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
            <div className="video-info">
              <span className="video-filename" title={video.filename}>
                {video.filename}
              </span>
              <span className="video-date">
                {new Date(video.modifiedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
