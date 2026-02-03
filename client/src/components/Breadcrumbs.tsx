import React from 'react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <div key={index} className="breadcrumb-item">
          {index > 0 && <span className="breadcrumb-separator">›</span>}
          {item.onClick ? (
            <button
              className="breadcrumb-link"
              onClick={item.onClick}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              {item.label}
            </button>
          ) : (
            <span style={{ color: 'var(--color-text-primary)' }}>{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
};
