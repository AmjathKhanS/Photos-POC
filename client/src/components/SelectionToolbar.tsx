import React from 'react';

interface SelectionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDownload,
  onDelete,
  onCancel,
}) => {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="selection-toolbar">
      <div className="selection-toolbar-left">
        <button className="icon-button" onClick={onCancel} title="Cancel selection">
          ✕
        </button>
        <span className="selection-count">
          {selectedCount} {selectedCount === 1 ? 'photo' : 'photos'} selected
        </span>
        <button
          className="button button-ghost button-sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
        >
          {allSelected ? 'Deselect all' : `Select all (${totalCount})`}
        </button>
      </div>

      <div className="selection-toolbar-actions">
        <button
          className="button button-secondary button-sm"
          onClick={onDownload}
          disabled={selectedCount === 0}
          title="Download selected photos"
        >
          <span>⬇️</span>
          <span>Download</span>
        </button>
        <button
          className="button button-danger button-sm"
          onClick={onDelete}
          disabled={selectedCount === 0}
          title="Delete selected photos"
        >
          <span>🗑️</span>
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
};
