import React, { useMemo } from 'react';
import { PhotoGrid } from './PhotoGrid';
import type { Photo } from '../types/photo';

interface ScreenshotsViewProps {
  photos: Photo[];
  onPhotoClick: (index: number) => void;
}

export const ScreenshotsView: React.FC<ScreenshotsViewProps> = ({ photos, onPhotoClick }) => {
  // Filter photos that are detected as screenshots
  const screenshotPhotos = useMemo(() => {
    console.log('[ScreenshotsView] Total photos:', photos.length);

    const filtered = photos.filter(photo => {
      // Use backend's isScreenshot flag
      const isMatch = photo.isScreenshot === true;
      if (isMatch) {
        console.log('[ScreenshotsView] Screenshot found:', photo.filename, 'isScreenshot:', photo.isScreenshot);
      }
      return isMatch;
    });

    console.log('[ScreenshotsView] Filtered screenshots:', filtered.length);
    return filtered;
  }, [photos]);

  // Count detection methods for info display
  const detectionStats = useMemo(() => {
    let metadataBased = 0;
    let filenameBased = 0;

    screenshotPhotos.forEach(photo => {
      if (photo.isScreenshot !== undefined && photo.isScreenshot) {
        metadataBased++;
      } else {
        filenameBased++;
      }
    });

    return { metadataBased, filenameBased };
  }, [screenshotPhotos]);

  if (screenshotPhotos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📸</div>
        <h2>No Screenshots Found</h2>
        <p>Screenshots and screen snips will appear here automatically.</p>
        <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '12px' }}>
          Detection uses: filename patterns, screen resolutions, aspect ratios, and EXIF metadata
        </p>
      </div>
    );
  }

  return (
    <div className="screenshots-view">
      <div className="view-header">
        <div>
          <h2>Screenshots & Snips</h2>
          <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>
            {detectionStats.metadataBased > 0 && `${detectionStats.metadataBased} detected by AI analysis`}
            {detectionStats.metadataBased > 0 && detectionStats.filenameBased > 0 && ', '}
            {detectionStats.filenameBased > 0 && `${detectionStats.filenameBased} by filename`}
          </p>
        </div>
        <span className="photo-count">
          {screenshotPhotos.length} {screenshotPhotos.length === 1 ? 'screenshot' : 'screenshots'}
        </span>
      </div>

      <PhotoGrid
        photos={screenshotPhotos}
        onPhotoClick={onPhotoClick}
        hasMore={false}
        onLoadMore={() => {}}
        loading={false}
      />
    </div>
  );
};
