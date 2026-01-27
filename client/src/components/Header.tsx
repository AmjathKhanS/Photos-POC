export type ViewType = 'photos' | 'people';

interface HeaderProps {
  photoCount: number;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function Header({ photoCount, currentView, onViewChange }: HeaderProps) {
  return (
    <header className="header">
      <h1>Photo Gallery</h1>
      <nav className="nav-tabs">
        <button
          className={`nav-tab ${currentView === 'photos' ? 'active' : ''}`}
          onClick={() => onViewChange('photos')}
        >
          Photos
        </button>
        <button
          className={`nav-tab ${currentView === 'people' ? 'active' : ''}`}
          onClick={() => onViewChange('people')}
        >
          People
        </button>
      </nav>
      <span className="photo-count">{photoCount} photos</span>
    </header>
  );
}
