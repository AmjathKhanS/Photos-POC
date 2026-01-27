import { useState } from 'react';
import { usePhotos } from './hooks/usePhotos';
import { PhotoGrid } from './components/PhotoGrid';
import { Lightbox } from './components/Lightbox';
import { LoadingSpinner } from './components/LoadingSpinner';
import { PeopleView } from './components/PeopleView';
import { PersonPhotosView } from './components/PersonPhotosView';
import { DuplicatesView } from './components/DuplicatesView';
import { MemoriesView } from './components/MemoriesView';
import { MemoryDetailView } from './components/MemoryDetailView';
import type { Person } from './types/face';
import type { Photo } from './types/photo';
import type { Memory } from './types/memory';
import './styles/index.css';

type View = 'photos' | 'people' | 'person-photos' | 'duplicates' | 'memories' | 'memory-detail';

// Minimal photo type for lightbox compatibility
interface LightboxPhoto {
  id: string;
  filename: string;
  thumbnailUrl: string;
  fullUrl: string;
}

export default function App() {
  const { photos, loading, error, hasMore, loadMore, total } = usePhotos();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [currentView, setCurrentView] = useState<View>('photos');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  const handlePhotoClick = (index: number) => {
    // Use main gallery photos for lightbox
    setLightboxPhotos(photos);
    setLightboxIndex(index);
  };

  const handleCloseLightbox = () => {
    setLightboxIndex(null);
    setLightboxPhotos([]);
  };

  const handleNavigate = (index: number) => {
    setLightboxIndex(index);
  };

  const handlePersonClick = (person: Person) => {
    setSelectedPerson(person);
    setCurrentView('person-photos');
  };

  const handleBackToPeople = () => {
    setSelectedPerson(null);
    setCurrentView('people');
  };

  const handleShowDuplicates = () => {
    setCurrentView('duplicates');
  };

  const handleBackFromDuplicates = () => {
    setCurrentView('people');
  };

  const handlePersonPhotoClick = (personPhotos: LightboxPhoto[], index: number) => {
    // Use person-specific photos for lightbox
    setLightboxPhotos(personPhotos);
    setLightboxIndex(index);
  };

  const handleMemoryClick = (memory: Memory) => {
    setSelectedMemory(memory);
    setCurrentView('memory-detail');
  };

  const handleBackToMemories = () => {
    setSelectedMemory(null);
    setCurrentView('memories');
  };

  const handleMemoryPhotoClick = (memoryPhotos: Photo[], index: number) => {
    // Use memory-specific photos for lightbox
    setLightboxPhotos(memoryPhotos);
    setLightboxIndex(index);
  };

  if (loading && photos.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error loading photos</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Photo Viewer</h1>
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${currentView === 'photos' ? 'active' : ''}`}
            onClick={() => setCurrentView('photos')}
          >
            Photos
          </button>
          <button
            className={`nav-tab ${currentView === 'people' || currentView === 'person-photos' ? 'active' : ''}`}
            onClick={() => setCurrentView('people')}
          >
            People
          </button>
          <button
            className={`nav-tab ${currentView === 'memories' || currentView === 'memory-detail' ? 'active' : ''}`}
            onClick={() => setCurrentView('memories')}
          >
            Memories
          </button>
        </nav>
        {currentView === 'photos' && (
          <span className="photo-count">{total} photos</span>
        )}
      </header>
      <main>
        {currentView === 'photos' && (
          <PhotoGrid
            photos={photos}
            onPhotoClick={handlePhotoClick}
            hasMore={hasMore}
            onLoadMore={loadMore}
            loading={loading}
          />
        )}
        {currentView === 'people' && (
          <PeopleView
            onPersonClick={handlePersonClick}
            onShowDuplicates={handleShowDuplicates}
          />
        )}
        {currentView === 'person-photos' && selectedPerson && (
          <PersonPhotosView
            person={selectedPerson}
            onBack={handleBackToPeople}
            onPhotoClick={handlePersonPhotoClick}
          />
        )}
        {currentView === 'duplicates' && (
          <DuplicatesView onBack={handleBackFromDuplicates} />
        )}
        {currentView === 'memories' && (
          <MemoriesView onMemoryClick={handleMemoryClick} />
        )}
        {currentView === 'memory-detail' && selectedMemory && (
          <MemoryDetailView
            memory={selectedMemory}
            onBack={handleBackToMemories}
            onPhotoClick={handleMemoryPhotoClick}
          />
        )}
      </main>
      {lightboxIndex !== null && lightboxPhotos.length > 0 && (
        <Lightbox
          photos={lightboxPhotos as Photo[]}
          currentIndex={lightboxIndex}
          onClose={handleCloseLightbox}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
