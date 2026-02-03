import React, { useState, useEffect } from 'react';

interface DocumentMetadata {
  id: number;
  photo_filename: string;
  document_type: string;
  document_subtype: string | null;
  confidence: number;
  extracted_text: string;
  extracted_date: string | null;
  extracted_amount: number | null;
  extracted_currency: string | null;
  extracted_names: string[];
  extracted_entities: any;
  document_number: string | null;
  expiry_date: string | null;
  importance_score: number;
  is_starred: boolean;
  processed_at: string;
  thumbnailUrl: string;
  fullUrl: string;
}

interface DocumentAlert {
  id: number;
  photo_filename: string;
  alert_type: string;
  alert_message: string;
  alert_date: string;
  is_dismissed: boolean;
}

interface DocumentStats {
  total_documents: number;
  by_type: Array<{ document_type: string; count: number }>;
  financial: {
    total_amount: number | null;
    avg_amount: number | null;
    with_amount: number;
  };
  expiring_soon: number;
  expired: number;
}

export const DocumentHub: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [alerts, setAlerts] = useState<DocumentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showStarred, setShowStarred] = useState(false);
  const [showExpiring, setShowExpiring] = useState(false);

  const documentTypeIcons: Record<string, string> = {
    medical: '🏥',
    financial: '💰',
    receipt: '🧾',
    legal: '⚖️',
    id_card: '🪪',
    passport: '🛂',
    insurance: '🛡️',
    tax: '📊',
    education: '🎓',
    utility: '⚡',
    other: '📄',
  };

  const documentTypeLabels: Record<string, string> = {
    medical: 'Medical',
    financial: 'Financial',
    receipt: 'Receipts',
    legal: 'Legal',
    id_card: 'ID Cards',
    passport: 'Passports',
    insurance: 'Insurance',
    tax: 'Tax Documents',
    education: 'Education',
    utility: 'Utilities',
    other: 'Other',
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedType !== 'all') params.append('document_type', selectedType);
      if (showStarred) params.append('is_starred', 'true');
      if (searchQuery) params.append('q', searchQuery);

      const endpoint = showExpiring
        ? 'http://localhost:3002/api/documents/expiring?days=30'
        : `http://localhost:3002/api/documents?${params}`;

      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.success) {
        setDocuments(data.documents);
      } else {
        setError(data.error || 'Failed to load documents');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/documents/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/documents/alerts');
      const data = await response.json();
      if (data.success) {
        setAlerts(data.alerts);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  };

  const handleProcessDocuments = async () => {
    if (!confirm('Process all photos with text as documents? This may take a few minutes.')) {
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const response = await fetch('http://localhost:3002/api/documents/process', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully processed ${data.processed}/${data.total} documents!`);
        loadDocuments();
        loadStats();
        loadAlerts();
      } else {
        setError(data.error || 'Failed to process documents');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process documents');
    } finally {
      setProcessing(false);
    }
  };

  const handleDismissAlert = async (alertId: number) => {
    try {
      await fetch(`http://localhost:3002/api/documents/alerts/${alertId}/dismiss`, {
        method: 'POST',
      });
      loadAlerts();
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  const handleToggleStar = async (filename: string, isStarred: boolean) => {
    try {
      await fetch(`http://localhost:3002/api/documents/${filename}/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: !isStarred }),
      });
      loadDocuments();
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (!amount) return null;
    return `${currency || '$'} ${amount.toFixed(2)}`;
  };

  useEffect(() => {
    loadDocuments();
    loadStats();
    loadAlerts();
  }, [selectedType, showStarred, showExpiring]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery) {
        loadDocuments();
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  return (
    <div className="document-hub">
      {/* Header */}
      <div className="document-hub-header">
        <div className="header-content">
          <h2>📄 Document Intelligence Hub</h2>
          <p className="subtitle">Smart document management powered by AI</p>
        </div>
        <div className="header-actions">
          <button
            onClick={handleProcessDocuments}
            disabled={processing}
            className="process-button"
          >
            {processing ? '⏳ Processing...' : '🔄 Process Documents'}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="document-stats-bar">
          <div className="stat-card">
            <span className="stat-icon">📄</span>
            <div className="stat-content">
              <span className="stat-value">{stats.total_documents}</span>
              <span className="stat-label">Total Documents</span>
            </div>
          </div>

          {stats.financial.total_amount && (
            <div className="stat-card">
              <span className="stat-icon">💰</span>
              <div className="stat-content">
                <span className="stat-value">${stats.financial.total_amount.toFixed(0)}</span>
                <span className="stat-label">Total Amount</span>
              </div>
            </div>
          )}

          {stats.expiring_soon > 0 && (
            <div className="stat-card alert">
              <span className="stat-icon">⚠️</span>
              <div className="stat-content">
                <span className="stat-value">{stats.expiring_soon}</span>
                <span className="stat-label">Expiring Soon</span>
              </div>
            </div>
          )}

          {stats.expired > 0 && (
            <div className="stat-card danger">
              <span className="stat-icon">🚨</span>
              <div className="stat-content">
                <span className="stat-value">{stats.expired}</span>
                <span className="stat-label">Expired</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <h3>🔔 Alerts</h3>
          <div className="alerts-list">
            {alerts.map((alert) => (
              <div key={alert.id} className={`alert-item ${alert.alert_type}`}>
                <span className="alert-message">{alert.alert_message}</span>
                <button
                  onClick={() => handleDismissAlert(alert.id)}
                  className="dismiss-button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="document-filters">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-chip ${selectedType === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedType('all')}
          >
            All
          </button>
          {stats?.by_type.map((type) => (
            <button
              key={type.document_type}
              className={`filter-chip ${selectedType === type.document_type ? 'active' : ''}`}
              onClick={() => setSelectedType(type.document_type)}
            >
              {documentTypeIcons[type.document_type]} {documentTypeLabels[type.document_type]} ({type.count})
            </button>
          ))}
        </div>

        <div className="toggle-filters">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showStarred}
              onChange={(e) => setShowStarred(e.target.checked)}
            />
            ⭐ Starred only
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showExpiring}
              onChange={(e) => setShowExpiring(e.target.checked)}
            />
            ⏰ Expiring soon
          </label>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Documents Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No Documents Found</h3>
          <p>
            {stats?.total_documents === 0
              ? 'Process your photos to extract document intelligence'
              : 'Try adjusting your filters or search query'}
          </p>
          {stats?.total_documents === 0 && (
            <button onClick={handleProcessDocuments} className="process-button-large">
              🔄 Process Documents Now
            </button>
          )}
        </div>
      ) : (
        <div className="documents-grid">
          {documents.map((doc) => (
            <div key={doc.id} className="document-card">
              <div className="document-thumbnail">
                <img src={doc.thumbnailUrl} alt={doc.photo_filename} loading="lazy" />
                <div className="document-overlay">
                  <span className="document-type-badge">
                    {documentTypeIcons[doc.document_type]} {documentTypeLabels[doc.document_type]}
                  </span>
                </div>
                <button
                  className={`star-button ${doc.is_starred ? 'starred' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStar(doc.photo_filename, doc.is_starred);
                  }}
                >
                  {doc.is_starred ? '⭐' : '☆'}
                </button>
              </div>

              <div className="document-info">
                <div className="document-meta">
                  {doc.extracted_date && (
                    <span className="meta-item">
                      📅 {formatDate(doc.extracted_date)}
                    </span>
                  )}
                  {doc.extracted_amount && (
                    <span className="meta-item amount">
                      {formatAmount(doc.extracted_amount, doc.extracted_currency)}
                    </span>
                  )}
                  {doc.expiry_date && (
                    <span className="meta-item expiry">
                      ⏰ Expires: {formatDate(doc.expiry_date)}
                    </span>
                  )}
                </div>

                {doc.document_number && (
                  <div className="document-number">
                    #{doc.document_number}
                  </div>
                )}

                {doc.extracted_names.length > 0 && (
                  <div className="document-names">
                    👤 {doc.extracted_names.slice(0, 2).join(', ')}
                  </div>
                )}

                {doc.document_subtype && (
                  <div className="document-subtype">
                    {doc.document_subtype.replace('_', ' ')}
                  </div>
                )}

                <div className="importance-bar">
                  <div
                    className="importance-fill"
                    style={{ width: `${doc.importance_score * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
