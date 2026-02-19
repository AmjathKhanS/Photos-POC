import { useEffect, useRef, useState } from 'react';
import type { Video } from '../types/video';

interface VideoPlayerProps {
  video: Video;
  onClose: () => void;
}

export function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [metadata, setMetadata] = useState<{ filename: string; size: string; sizeFormatted: string } | null>(null);

  useEffect(() => {
    // Prevent body scroll when video player is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    // Fetch video metadata
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`/api/videos/info/${encodeURIComponent(video.filename)}`);
        if (response.ok) {
          const data = await response.json();
          setMetadata(data);
        }
      } catch (error) {
        console.error('Failed to fetch video metadata:', error);
      }
    };

    fetchMetadata();
  }, [video.filename]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && videoRef.current) {
        e.preventDefault();
        if (videoRef.current.paused) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose]);

  return (
    <div className="video-player-overlay" onClick={onClose}>
      <div className="video-player-content" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="video-player-close" onClick={onClose}>
          &times;
        </button>

        {/* Video container */}
        <div className="video-player-container">
          <video
            ref={videoRef}
            src={video.videoUrl}
            controls
            autoPlay
            className="video-player"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Video info */}
        <div className="video-player-info">
          <div className="video-player-header">
            <span className="video-player-filename">{video.filename}</span>
          </div>

          {metadata && (
            <div className="video-player-details">
              <span className="detail-item">
                {metadata.sizeFormatted}
              </span>
              <span className="detail-item">
                {new Date(video.modifiedAt).toLocaleDateString()}
              </span>
              <span className="detail-item">
                {video.mimeType}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
