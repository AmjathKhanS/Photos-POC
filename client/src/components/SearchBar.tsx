import React, { useState, useEffect } from 'react';

export type SearchMode = 'filename' | 'semantic';

interface SearchBarProps {
  onSearch: (query: string, mode: SearchMode) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, placeholder = 'Search photos...' }) => {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('filename');

  const handleSearch = () => {
    onSearch(query, searchMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleSearchMode = () => {
    setSearchMode(prev => prev === 'filename' ? 'semantic' : 'filename');
  };

  const getPlaceholder = () => {
    if (searchMode === 'semantic') {
      return 'AI Search: Try "doctor slip", "birthday cake", "documents"... (Press Enter)';
    }
    return placeholder + ' (Press Enter)';
  };

  return (
    <div className="search-container">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder={getPlaceholder()}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className={`search-mode-toggle ${searchMode === 'semantic' ? 'active' : ''}`}
          onClick={toggleSearchMode}
          title={searchMode === 'semantic' ? 'Switch to filename search' : 'Switch to AI semantic search'}
        >
          {searchMode === 'semantic' ? '🤖 AI' : '📝 Text'}
        </button>
      </div>
      {searchMode === 'semantic' && (
        <div className="search-mode-indicator">
          <span className="search-mode-badge">AI Semantic Search Active</span>
        </div>
      )}
    </div>
  );
};
