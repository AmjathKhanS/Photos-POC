import { useEffect, useState } from 'react';
import { useDuplicates } from '../hooks/useDuplicates';

interface DuplicatesViewProps {
  onBack?: () => void;
  onPersonClick?: (personId: number) => void;
}

export function DuplicatesView({ onBack, onPersonClick }: DuplicatesViewProps = {}) {
  const { duplicates, loading, error, fetchDuplicates, mergePerson, dismissDuplicate } = useDuplicates();
  const [threshold, setThreshold] = useState(0.85);
  const [mergingPair, setMergingPair] = useState<number | null>(null);

  useEffect(() => {
    fetchDuplicates(threshold);
  }, []);

  const handleMerge = async (
    index: number,
    sourceId: number,
    targetId: number,
    sourceName: string,
    targetName: string
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to merge "${sourceName}" into "${targetName}"?\n\n` +
      `This will:\n` +
      `• Move all faces from ${sourceName} to ${targetName}\n` +
      `• Delete ${sourceName}\n` +
      `• This action cannot be undone!`
    );

    if (!confirmed) return;

    try {
      setMergingPair(index);
      await mergePerson(sourceId, targetId);
      alert(`Successfully merged ${sourceName} into ${targetName}`);
    } catch (err) {
      alert('Failed to merge persons. Please try again.');
    } finally {
      setMergingPair(null);
    }
  };

  const handleDismiss = (index: number) => {
    dismissDuplicate(index);
  };

  const handleThresholdChange = () => {
    fetchDuplicates(threshold);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: '8px 16px',
              marginRight: '10px',
              cursor: 'pointer',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            ← Back
          </button>
        )}
        <h1 style={{ display: 'inline', marginLeft: '10px' }}>Duplicate Person Detection</h1>
      </div>

      {/* Threshold Control */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
      }}>
        <label>
          <strong>Similarity Threshold:</strong>
          <input
            type="range"
            min="0.75"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            style={{ marginLeft: '10px', width: '200px' }}
          />
          <span style={{ marginLeft: '10px' }}>{(threshold * 100).toFixed(0)}%</span>
        </label>
        <button
          onClick={handleThresholdChange}
          disabled={loading}
          style={{
            padding: '8px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Searching...' : 'Find Duplicates'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Analyzing {threshold >= 0.9 ? 'strict' : threshold >= 0.85 ? 'moderate' : 'lenient'} similarities...</p>
        </div>
      )}

      {/* No Duplicates */}
      {!loading && duplicates.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          backgroundColor: '#d4edda',
          color: '#155724',
          borderRadius: '8px'
        }}>
          <h3>✓ No Duplicate Persons Found</h3>
          <p>All persons appear to be unique at {(threshold * 100).toFixed(0)}% similarity threshold.</p>
          <p style={{ marginTop: '10px', fontSize: '14px' }}>
            Try lowering the threshold to find more potential duplicates.
          </p>
        </div>
      )}

      {/* Duplicate Pairs List */}
      {!loading && duplicates.length > 0 && (
        <div>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Found <strong>{duplicates.length}</strong> potential duplicate pair{duplicates.length !== 1 ? 's' : ''}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {duplicates.map((pair, index) => (
              <div
                key={`${pair.person1_id}-${pair.person2_id}`}
                style={{
                  backgroundColor: 'white',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '20px',
                  opacity: mergingPair === index ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {/* Person 1 */}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <img
                      src={`/api/faces/${pair.person1_representative_face_id}/thumbnail`}
                      alt={pair.person1_name}
                      style={{
                        width: '150px',
                        height: '150px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid #007bff'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
                      }}
                    />
                    <h3 style={{ marginTop: '15px' }}>{pair.person1_name}</h3>
                    <p style={{ color: '#666', fontSize: '14px' }}>
                      {pair.person1_face_count} face{pair.person1_face_count !== 1 ? 's' : ''}
                    </p>
                    {onPersonClick && (
                      <button
                        onClick={() => onPersonClick(pair.person1_id)}
                        style={{
                          marginTop: '10px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        View Photos
                      </button>
                    )}
                  </div>

                  {/* Similarity Score */}
                  <div style={{
                    flex: 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 20px'
                  }}>
                    <div style={{
                      fontSize: '36px',
                      fontWeight: 'bold',
                      color: pair.similarity >= 0.9 ? '#28a745' : '#ffc107',
                      marginBottom: '10px'
                    }}>
                      {(pair.similarity * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>Similar</div>
                    <div style={{ margin: '20px 0', fontSize: '24px' }}>⟷</div>
                  </div>

                  {/* Person 2 */}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <img
                      src={`/api/faces/${pair.person2_representative_face_id}/thumbnail`}
                      alt={pair.person2_name}
                      style={{
                        width: '150px',
                        height: '150px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid #007bff'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
                      }}
                    />
                    <h3 style={{ marginTop: '15px' }}>{pair.person2_name}</h3>
                    <p style={{ color: '#666', fontSize: '14px' }}>
                      {pair.person2_face_count} face{pair.person2_face_count !== 1 ? 's' : ''}
                    </p>
                    {onPersonClick && (
                      <button
                        onClick={() => onPersonClick(pair.person2_id)}
                        style={{
                          marginTop: '10px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        View Photos
                      </button>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                  marginTop: '25px',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '15px'
                }}>
                  <button
                    onClick={() => handleMerge(index, pair.person1_id, pair.person2_id, pair.person1_name, pair.person2_name)}
                    disabled={mergingPair === index}
                    style={{
                      padding: '10px 30px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: mergingPair === index ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    Merge {pair.person1_name} → {pair.person2_name}
                  </button>
                  <button
                    onClick={() => handleMerge(index, pair.person2_id, pair.person1_id, pair.person2_name, pair.person1_name)}
                    disabled={mergingPair === index}
                    style={{
                      padding: '10px 30px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: mergingPair === index ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    Merge {pair.person2_name} → {pair.person1_name}
                  </button>
                  <button
                    onClick={() => handleDismiss(index)}
                    disabled={mergingPair === index}
                    style={{
                      padding: '10px 30px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: mergingPair === index ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Not Same Person
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
