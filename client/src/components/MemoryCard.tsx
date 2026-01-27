import type { Memory } from '../types/memory';

interface MemoryCardProps {
  memory: Memory;
  onClick: (memory: Memory) => void;
  onDismiss: (memoryId: number) => void;
}

const API_BASE = '/api';

export function MemoryCard({ memory, onClick, onDismiss }: MemoryCardProps) {
  const handleDismissClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to dismiss this memory?')) {
      onDismiss(memory.id);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getMemoryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'on_this_day': 'On This Day',
      'weekly': 'This Week',
      'monthly': 'This Month',
      'seasonal': 'Seasonal',
      'people': 'People'
    };
    return labels[type] || type;
  };

  const coverPhotoUrl = memory.cover_photo_filename
    ? `${API_BASE}/photos/thumbnail/${encodeURIComponent(memory.cover_photo_filename)}`
    : null;

  return (
    <div className="memory-card" onClick={() => onClick(memory)}>
      <div className="memory-card-image">
        {coverPhotoUrl ? (
          <img src={coverPhotoUrl} alt={memory.title} loading="lazy" />
        ) : (
          <div className="memory-card-placeholder">
            <span>📸</span>
          </div>
        )}
        <button
          className="memory-dismiss-btn"
          onClick={handleDismissClick}
          title="Dismiss memory"
        >
          ×
        </button>
      </div>
      <div className="memory-card-content">
        <div className="memory-card-header">
          <span className="memory-type-badge">{getMemoryTypeLabel(memory.memory_type)}</span>
          <span className="memory-photo-count">{memory.photo_count} photos</span>
        </div>
        <h3 className="memory-title">{memory.title}</h3>
        {memory.description && (
          <p className="memory-description">{memory.description}</p>
        )}
        <div className="memory-date">{formatDate(memory.memory_date)}</div>
      </div>
    </div>
  );
}
