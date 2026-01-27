import { useMemoryPhotos } from '../hooks/useMemoryPhotos';
import { PhotoGrid } from './PhotoGrid';
import { LoadingSpinner } from './LoadingSpinner';
import type { Memory } from '../types/memory';
import type { Photo } from '../types/photo';

interface MemoryDetailViewProps {
  memory: Memory;
  onBack: () => void;
  onPhotoClick: (photos: Photo[], index: number) => void;
}

export function MemoryDetailView({ memory, onBack, onPhotoClick }: MemoryDetailViewProps) {
  const { photos, loading, error } = useMemoryPhotos(memory.id);

  const formatDateRange = () => {
    if (memory.date_start && memory.date_end) {
      const start = new Date(memory.date_start);
      const end = new Date(memory.date_end);

      if (start.toDateString() === end.toDateString()) {
        return start.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      }

      return `${start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })} - ${end.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}`;
    }

    return new Date(memory.memory_date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getMemoryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'on_this_day': 'On This Day',
      'weekly': 'Weekly Highlights',
      'monthly': 'Monthly Highlights',
      'seasonal': 'Seasonal Memories',
      'people': 'People Memories'
    };
    return labels[type] || type;
  };

  if (loading && photos.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error loading memory photos</h2>
        <p>{error}</p>
        <button className="btn-secondary" onClick={onBack}>
          Back to Memories
        </button>
      </div>
    );
  }

  return (
    <div className="memory-detail-view">
      <div className="memory-detail-header">
        <button className="btn-back" onClick={onBack}>
          ← Back
        </button>
        <div className="memory-detail-info">
          <span className="memory-type-badge">{getMemoryTypeLabel(memory.memory_type)}</span>
          <h2>{memory.title}</h2>
          {memory.description && <p className="memory-detail-description">{memory.description}</p>}
          <div className="memory-detail-meta">
            <span className="memory-detail-date">{formatDateRange()}</span>
            <span className="memory-detail-count">{photos.length} photos</span>
          </div>
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
