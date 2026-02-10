import { useState, useMemo, useEffect } from 'react';
import { usePhotos } from './hooks/usePhotos';
import { useSemanticSearch } from './hooks/useSemanticSearch';
import { PhotoGrid } from './components/PhotoGrid';
import { Lightbox } from './components/Lightbox';
import { LoadingSpinner } from './components/LoadingSpinner';
import { PeopleView } from './components/PeopleView';
import { PersonPhotosView } from './components/PersonPhotosView';
import { DuplicatesView } from './components/DuplicatesView';
import { MemoriesView } from './components/MemoriesView';
import { MemoryDetailView } from './components/MemoryDetailView';
import { SmartAlbumsView } from './components/SmartAlbumsView';
import { AlbumDetailView } from './components/AlbumDetailView';
import { ScreenshotsView } from './components/ScreenshotsView';
import { PlacesView } from './components/PlacesView';
import { IndexingStatusBar } from './components/IndexingStatusBar';
import { Sidebar } from './components/Sidebar';
import { SearchBar, SearchMode } from './components/SearchBar';
import { Breadcrumbs } from './components/Breadcrumbs';
import { FilterBar, FilterOptions } from './components/FilterBar';
import { MobileMenu } from './components/MobileMenu';
import { SelectionToolbar } from './components/SelectionToolbar';
import type { Person } from './types/face';
import type { Photo } from './types/photo';
import type { Memory } from './types/memory';
import './styles/index.css';

type View = 'photos' | 'places' | 'people' | 'person-photos' | 'duplicates' | 'memories' | 'memory-detail' | 'smart-albums' | 'album-detail' | 'screenshots';

// Minimal photo type for lightbox compatibility
interface LightboxPhoto {
  id: string;
  filename: string;
  thumbnailUrl: string;
  fullUrl: string;
}

export default function App() {
  const { photos, loading, error, hasMore, loadMore, total } = usePhotos();
  const { search: semanticSearch } = useSemanticSearch();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [currentView, setCurrentView] = useState<View>('photos');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMode, setSearchMode] = useState<SearchMode>('filename');
  const [semanticResults, setSemanticResults] = useState<Photo[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    dateRange: 'all',
    fileTypes: [],
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [locationCount, setLocationCount] = useState<number>(0);

  // Fetch location count on mount
  useEffect(() => {
    fetch('/api/locations/count')
      .then(res => res.json())
      .then(data => setLocationCount(data.count))
      .catch(err => console.error('Error fetching location count:', err));
  }, []);

  // Handle search
  const handleSearch = (query: string, mode: SearchMode) => {
    setSearchQuery(query);
    setSearchMode(mode);

    // Trigger semantic search if in AI mode
    if (mode === 'semantic' && query.trim()) {
      semanticSearch(query).then(results => {
        setSemanticResults(results.map(r => r.photo));
      });
    } else {
      setSemanticResults([]);
    }
  };

  // Apply all filters to photos
  const filteredPhotos = useMemo(() => {
    // Use semantic search results if in AI mode
    if (searchMode === 'semantic' && searchQuery.trim()) {
      return semanticResults;
    }

    let filtered = photos;

    // Apply filename search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(photo =>
        photo.filename.toLowerCase().includes(query)
      );
    }

    // Apply file type filter
    if (filterOptions.fileTypes.length > 0) {
      filtered = filtered.filter(photo => {
        const ext = photo.filename.split('.').pop()?.toLowerCase();
        return ext && filterOptions.fileTypes.includes(ext);
      });
    }

    // Apply date range filter
    if (filterOptions.dateRange !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      filtered = filtered.filter(photo => {
        const photoDate = new Date(photo.modifiedAt || '');

        switch (filterOptions.dateRange) {
          case 'today':
            return photoDate >= startOfToday;
          case 'week':
            return photoDate >= startOfWeek;
          case 'month':
            return photoDate >= startOfMonth;
          case 'year':
            return photoDate >= startOfYear;
          case 'custom':
            if (filterOptions.customStartDate) {
              const start = new Date(filterOptions.customStartDate);
              if (photoDate < start) return false;
            }
            if (filterOptions.customEndDate) {
              const end = new Date(filterOptions.customEndDate);
              end.setHours(23, 59, 59, 999);
              if (photoDate > end) return false;
            }
            return true;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [photos, searchQuery, searchMode, semanticResults, filterOptions]);

  // Selection mode handlers
  const handleToggleSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedPhotoIds(new Set(filteredPhotos.map(p => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedPhotoIds(new Set());
  };

  const handleDownloadSelected = () => {
    const selectedPhotos = filteredPhotos.filter(p => selectedPhotoIds.has(p.id));
    selectedPhotos.forEach(photo => {
      const link = document.createElement('a');
      link.href = photo.fullUrl;
      link.download = photo.filename;
      link.click();
    });
  };

  const handleDeleteSelected = () => {
    if (confirm(`Are you sure you want to delete ${selectedPhotoIds.size} photo(s)?`)) {
      // TODO: Implement delete functionality
      console.log('Deleting photos:', Array.from(selectedPhotoIds));
      setSelectedPhotoIds(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedPhotoIds(new Set());
  };

  // Get breadcrumb items based on current view
  const getBreadcrumbs = () => {
    const items = [];

    if (currentView === 'person-photos' && selectedPerson) {
      items.push({ label: 'People', onClick: handleBackToPeople });
      items.push({ label: selectedPerson.name || `Person ${selectedPerson.id}` });
    } else if (currentView === 'memory-detail' && selectedMemory) {
      items.push({ label: 'Memories', onClick: handleBackToMemories });
      items.push({ label: selectedMemory.title });
    } else if (currentView === 'album-detail' && selectedAlbum) {
      items.push({ label: 'Smart Albums', onClick: handleBackToAlbums });
      items.push({ label: selectedAlbum.title });
    } else if (currentView === 'duplicates') {
      items.push({ label: 'People', onClick: handleBackFromDuplicates });
      items.push({ label: 'Duplicates' });
    } else {
      const viewNames: Record<string, string> = {
        photos: 'Photos',
        people: 'People',
        memories: 'Memories',
        'smart-albums': 'Smart Albums',
        screenshots: 'Screenshots & Snips',
      };
      items.push({ label: viewNames[currentView] || 'Photos' });
    }

    return items;
  };

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

  const handleAlbumClick = (album: any) => {
    setSelectedAlbum(album);
    setCurrentView('album-detail');
  };

  const handleBackToAlbums = () => {
    setSelectedAlbum(null);
    setCurrentView('smart-albums');
  };

  const handleAlbumPhotoClick = (albumPhotos: Photo[], index: number) => {
    // Use album-specific photos for lightbox
    setLightboxPhotos(albumPhotos);
    setLightboxIndex(index);
  };

  const handleScreenshotPhotoClick = (index: number) => {
    // Screenshots use the filtered photos array, so we need to set lightbox photos
    // The ScreenshotsView will pass the correct filtered array
    handlePhotoClick(index);
  };

  const handleGenerateAlbums = () => {
    // Optionally show a success message or notification
    console.log('Smart albums generated successfully');
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
    <div className="app-container">
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view as View);
          setIsMobileMenuOpen(false);
        }}
        photoCount={total}
        locationCount={locationCount}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <MobileMenu isOpen={isMobileMenuOpen} onToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
            <Breadcrumbs items={getBreadcrumbs()} />
            {currentView === 'photos' && (
              <SearchBar
                onSearch={handleSearch}
                placeholder="Search photos by filename..."
              />
            )}
          </div>

          <div className="header-right">
            {currentView === 'photos' && !isSelectionMode && (
              <>
                <button
                  className="selection-mode-button"
                  onClick={() => setIsSelectionMode(true)}
                >
                  <span>☑️</span>
                  <span>Select</span>
                </button>
                <span className="photo-count">
                  {filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'}
                  {searchQuery && ` (filtered from ${total})`}
                </span>
              </>
            )}
          </div>
        </header>

        {isSelectionMode && currentView === 'photos' && (
          <SelectionToolbar
            selectedCount={selectedPhotoIds.size}
            totalCount={filteredPhotos.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDownload={handleDownloadSelected}
            onDelete={handleDeleteSelected}
            onCancel={handleCancelSelection}
          />
        )}

        {currentView === 'photos' && (
          <FilterBar
            onFilterChange={setFilterOptions}
            totalPhotos={total}
            filteredCount={filteredPhotos.length}
          />
        )}

        <div className={`content-container ${isSelectionMode ? 'selection-mode' : ''}`}>
          {currentView === 'photos' && (
            <PhotoGrid
              photos={filteredPhotos}
              onPhotoClick={(index) => {
                if (isSelectionMode) {
                  handleToggleSelection(filteredPhotos[index].id);
                } else {
                  handlePhotoClick(index);
                }
              }}
              hasMore={hasMore && !searchQuery && filterOptions.dateRange === 'all' && filterOptions.fileTypes.length === 0}
              onLoadMore={loadMore}
              loading={loading}
              selectedPhotoIds={selectedPhotoIds}
              selectionMode={isSelectionMode}
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
          {currentView === 'smart-albums' && (
            <SmartAlbumsView
              onAlbumClick={handleAlbumClick}
              onGenerateAlbums={handleGenerateAlbums}
            />
          )}
          {currentView === 'album-detail' && selectedAlbum && (
            <AlbumDetailView
              album={selectedAlbum}
              onBack={handleBackToAlbums}
              onPhotoClick={handleAlbumPhotoClick}
            />
          )}
          {currentView === 'screenshots' && (
            <ScreenshotsView
              photos={photos}
              onPhotoClick={handleScreenshotPhotoClick}
            />
          )}
          {currentView === 'places' && (
            <PlacesView />
          )}
        </div>
      </div>

      {lightboxIndex !== null && lightboxPhotos.length > 0 && (
        <Lightbox
          photos={lightboxPhotos as Photo[]}
          currentIndex={lightboxIndex}
          onClose={handleCloseLightbox}
          onNavigate={handleNavigate}
        />
      )}

      <IndexingStatusBar />
    </div>
  );
}
