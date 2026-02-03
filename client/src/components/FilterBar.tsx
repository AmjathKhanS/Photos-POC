import React, { useState } from 'react';

export interface FilterOptions {
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
  fileTypes: string[];
  customStartDate?: string;
  customEndDate?: string;
}

interface FilterBarProps {
  onFilterChange: (filters: FilterOptions) => void;
  totalPhotos: number;
  filteredCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  onFilterChange,
  totalPhotos,
  filteredCount,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dateRange, setDateRange] = useState<FilterOptions['dateRange']>('all');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const fileTypes = [
    { id: 'jpg', label: 'JPG', icon: '🖼️' },
    { id: 'png', label: 'PNG', icon: '🎨' },
    { id: 'heic', label: 'HEIC', icon: '📱' },
    { id: 'gif', label: 'GIF', icon: '🎬' },
    { id: 'webp', label: 'WebP', icon: '🌐' },
  ];

  const handleDateRangeChange = (range: FilterOptions['dateRange']) => {
    setDateRange(range);
    onFilterChange({
      dateRange: range,
      fileTypes: selectedTypes,
      customStartDate: range === 'custom' ? customStartDate : undefined,
      customEndDate: range === 'custom' ? customEndDate : undefined,
    });
  };

  const handleTypeToggle = (typeId: string) => {
    const newTypes = selectedTypes.includes(typeId)
      ? selectedTypes.filter((t) => t !== typeId)
      : [...selectedTypes, typeId];

    setSelectedTypes(newTypes);
    onFilterChange({
      dateRange,
      fileTypes: newTypes,
      customStartDate,
      customEndDate,
    });
  };

  const handleClearFilters = () => {
    setDateRange('all');
    setSelectedTypes([]);
    setCustomStartDate('');
    setCustomEndDate('');
    onFilterChange({
      dateRange: 'all',
      fileTypes: [],
    });
  };

  const hasActiveFilters = dateRange !== 'all' || selectedTypes.length > 0;

  return (
    <div className="filter-bar">
      <div className="filter-bar-header">
        <button
          className="filter-toggle-button"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="filter-icon">🎛️</span>
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="filter-badge">{selectedTypes.length + (dateRange !== 'all' ? 1 : 0)}</span>
          )}
          <span className={`filter-chevron ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </button>

        <div className="filter-results">
          Showing {filteredCount} of {totalPhotos} photos
          {hasActiveFilters && (
            <button className="filter-clear-button" onClick={handleClearFilters}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="filter-bar-content">
          <div className="filter-section">
            <h3 className="filter-section-title">📅 Date Range</h3>
            <div className="filter-options">
              {[
                { id: 'all', label: 'All time' },
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This week' },
                { id: 'month', label: 'This month' },
                { id: 'year', label: 'This year' },
                { id: 'custom', label: 'Custom range' },
              ].map((option) => (
                <button
                  key={option.id}
                  className={`filter-chip ${dateRange === option.id ? 'active' : ''}`}
                  onClick={() => handleDateRangeChange(option.id as FilterOptions['dateRange'])}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {dateRange === 'custom' && (
              <div className="filter-custom-date">
                <div className="filter-date-input">
                  <label>From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      onFilterChange({
                        dateRange: 'custom',
                        fileTypes: selectedTypes,
                        customStartDate: e.target.value,
                        customEndDate,
                      });
                    }}
                  />
                </div>
                <div className="filter-date-input">
                  <label>To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      onFilterChange({
                        dateRange: 'custom',
                        fileTypes: selectedTypes,
                        customStartDate,
                        customEndDate: e.target.value,
                      });
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="filter-section">
            <h3 className="filter-section-title">🖼️ File Type</h3>
            <div className="filter-options">
              {fileTypes.map((type) => (
                <button
                  key={type.id}
                  className={`filter-chip ${selectedTypes.includes(type.id) ? 'active' : ''}`}
                  onClick={() => handleTypeToggle(type.id)}
                >
                  <span>{type.icon}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
