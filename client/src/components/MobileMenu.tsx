import React from 'react';

interface MobileMenuProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onToggle }) => {
  return (
    <>
      <button
        className="mobile-menu-button"
        onClick={onToggle}
        aria-label="Toggle menu"
      >
        <div className={`hamburger ${isOpen ? 'active' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>

      {isOpen && (
        <div className="mobile-menu-backdrop" onClick={onToggle} />
      )}
    </>
  );
};
