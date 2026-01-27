import { useFaces } from '../hooks/useFaces';
import { PersonCard } from './PersonCard';
import type { Person } from '../types/face';

interface PeopleViewProps {
  onPersonClick: (person: Person) => void;
  onShowDuplicates?: () => void;
}

export function PeopleView({ onPersonClick, onShowDuplicates }: PeopleViewProps) {
  const {
    persons,
    scanStatus,
    stats,
    loading,
    startScan,
    runClustering,
  } = useFaces();

  const isScanning = scanStatus.status === 'scanning';
  const progress = scanStatus.total > 0
    ? Math.round((scanStatus.processed / scanStatus.total) * 100)
    : 0;

  const handleStartScan = async () => {
    try {
      // Backend ONNX scan - no need to load photos
      await startScan();
    } catch (error) {
      console.error('Error during scan:', error);
    }
  };

  return (
    <div className="people-view">
      <div className="people-header">
        <div className="people-title">
          <h2>People</h2>
          {stats && (
            <span className="people-stats">
              {stats.totalFaces} faces found in {stats.processedPhotos} photos
            </span>
          )}
        </div>
        <div className="people-actions">
          <button
            onClick={handleStartScan}
            disabled={isScanning || loading}
            className="btn-primary"
          >
            {isScanning
              ? `Scanning... ${progress}%`
              : 'Scan All Photos'}
          </button>
          <button
            onClick={runClustering}
            disabled={isScanning || loading || (stats?.totalFaces || 0) === 0}
            className="btn-secondary"
          >
            Auto-Group Faces
          </button>
          {onShowDuplicates && persons.length > 1 && (
            <button
              onClick={onShowDuplicates}
              disabled={isScanning || loading}
              className="btn-secondary"
              style={{ backgroundColor: '#ffc107', borderColor: '#ffc107' }}
            >
              Find Duplicates
            </button>
          )}
        </div>
      </div>

      {isScanning && (
        <div className="scan-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="progress-text">
            Processing: {scanStatus.currentPhoto} ({scanStatus.processed}/{scanStatus.total})
          </span>
        </div>
      )}

      {scanStatus.status === 'error' && scanStatus.error && (
        <div className="scan-error">
          <strong>Error:</strong> {scanStatus.error}
        </div>
      )}

      {persons.length === 0 && !isScanning && scanStatus.status !== 'error' && (
        <div className="people-empty">
          <p>No people found yet.</p>
          <p>Click "Scan All Photos" to detect faces using ONNX (server-side), then "Auto-Group Faces" to group similar faces together.</p>
        </div>
      )}

      <div className="people-grid">
        {persons.map(person => (
          <PersonCard
            key={person.id}
            person={person}
            onClick={() => onPersonClick(person)}
          />
        ))}
      </div>
    </div>
  );
}
