import { useState, useEffect } from 'react';
import type { Face, Person } from '../types/face';

interface FaceTaggingOverlayProps {
  photoFilename: string;
  imageRef: HTMLImageElement | null;
  persons: Person[];
  onAssignFace: (faceId: number, personId: number) => Promise<void>;
  onCreatePerson: (name: string) => Promise<Person>;
}

export function FaceTaggingOverlay({
  photoFilename,
  imageRef,
  persons,
  onAssignFace,
  onCreatePerson
}: FaceTaggingOverlayProps) {
  const [faces, setFaces] = useState<Face[]>([]);
  const [selectedFace, setSelectedFace] = useState<Face | null>(null);
  const [newPersonName, setNewPersonName] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchFaces();
  }, [photoFilename]);

  const fetchFaces = async () => {
    try {
      const response = await fetch(`/api/faces/photo/${encodeURIComponent(photoFilename)}`);
      if (response.ok) {
        const data = await response.json();
        setFaces(data);
      }
    } catch (error) {
      console.error('Error fetching faces:', error);
    }
  };

  if (!imageRef || faces.length === 0) {
    return null;
  }

  // Calculate scale factors
  const rect = imageRef.getBoundingClientRect();
  const scaleX = rect.width / imageRef.naturalWidth;
  const scaleY = rect.height / imageRef.naturalHeight;

  const handleFaceClick = (face: Face, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFace(face);
    setShowPopup(true);

    // Position popup near the face
    const bbox = face.bounding_box;
    const centerX = ((bbox.left + bbox.right) / 2) * scaleX;
    const bottomY = bbox.bottom * scaleY + 10;

    setPopupPosition({ x: centerX, y: bottomY });
  };

  const handleAssign = async (personId: number) => {
    if (selectedFace) {
      await onAssignFace(selectedFace.id, personId);
      await fetchFaces();
      setShowPopup(false);
      setSelectedFace(null);
    }
  };

  const handleCreateAndAssign = async () => {
    if (selectedFace && newPersonName.trim()) {
      const person = await onCreatePerson(newPersonName.trim());
      await onAssignFace(selectedFace.id, person.id);
      await fetchFaces();
      setNewPersonName('');
      setShowPopup(false);
      setSelectedFace(null);
    }
  };

  const closePopup = () => {
    setShowPopup(false);
    setSelectedFace(null);
    setNewPersonName('');
  };

  return (
    <div className="face-tagging-overlay">
      {faces.map(face => {
        const bbox = face.bounding_box;
        const isSelected = selectedFace?.id === face.id;

        return (
          <div
            key={face.id}
            className={`face-box ${isSelected ? 'selected' : ''} ${face.person_name ? 'tagged' : ''}`}
            style={{
              left: bbox.left * scaleX,
              top: bbox.top * scaleY,
              width: (bbox.right - bbox.left) * scaleX,
              height: (bbox.bottom - bbox.top) * scaleY
            }}
            onClick={(e) => handleFaceClick(face, e)}
          >
            {face.person_name && !face.person_name.match(/^Person \d+$/) && (
              <span className="face-label">{face.person_name}</span>
            )}
          </div>
        );
      })}

      {showPopup && selectedFace && (
        <>
          <div className="face-popup-backdrop" onClick={closePopup} />
          <div
            className="face-assign-popup"
            style={{
              left: Math.min(popupPosition.x, rect.width - 220),
              top: Math.min(popupPosition.y, rect.height - 200)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Who is this?</h4>

            {persons.filter(p => !p.name.match(/^Person \d+$/)).length > 0 && (
              <div className="person-list">
                {persons
                  .filter(person => !person.name.match(/^Person \d+$/))
                  .map(person => (
                    <button
                      key={person.id}
                      className="person-option"
                      onClick={() => handleAssign(person.id)}
                    >
                      {person.name}
                    </button>
                  ))}
              </div>
            )}

            <div className="new-person-form">
              <input
                type="text"
                placeholder="Add new person..."
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateAndAssign();
                  if (e.key === 'Escape') closePopup();
                }}
              />
              <button
                onClick={handleCreateAndAssign}
                disabled={!newPersonName.trim()}
              >
                Add
              </button>
            </div>

            <button className="popup-close" onClick={closePopup}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
