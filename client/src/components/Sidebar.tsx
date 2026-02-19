import React from 'react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  photoCount: number;
  locationCount?: number;
  isMobileMenuOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, photoCount, locationCount, isMobileMenuOpen = false }) => {
  const navItems = [
    { id: 'photos', label: 'Photos', icon: '📷', count: photoCount },
    { id: 'videos', label: 'Videos', icon: '🎥', count: null },
    { id: 'places', label: 'Places', icon: '📍', count: locationCount ?? null },
    { id: 'screenshots', label: 'Screenshots & Snips', icon: '📸', count: null },
    { id: 'smart-albums', label: 'Smart Albums', icon: '🎨', count: null },
    { id: 'memories', label: 'Memories', icon: '🎭', count: null },
    { id: 'people', label: 'People', icon: '👥', count: null },
  ];

  return (
    <div className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">📸</span>
          <span>Photo Viewer</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.count !== null && (
              <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.7 }}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div>Photo Viewer v1.0</div>
        <div style={{ marginTop: '4px', opacity: 0.7 }}>
          Smart photo organization
        </div>
      </div>
    </div>
  );
};
