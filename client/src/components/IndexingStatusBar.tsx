import React, { useEffect, useState } from 'react';
import { fetchWithRetry } from '../utils/fetchWithRetry';

interface IndexingStatus {
  isRunning: boolean;
  total?: number;
  processed?: number;
  failed?: number;
  progress?: number;
  currentBatch?: number;
  totalBatches?: number;
}

export const IndexingStatusBar: React.FC = () => {
  const [status, setStatus] = useState<IndexingStatus>({ isRunning: false });
  const [isPaused, setIsPaused] = useState(false);

  // Poll for status only when indexing is active
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetchWithRetry('/api/indexing/status');
        const data = await response.json();
        setStatus(data);
        return data;
      } catch (error) {
        console.error('Error fetching indexing status:', error);
        return { isRunning: false };
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 15 seconds (increased from 10 to reduce load)
    const interval = setInterval(async () => {
      await fetchStatus();
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handlePause = async () => {
    try {
      await fetchWithRetry('/api/indexing/pause', { method: 'POST' });
      setIsPaused(true);
      setStatus({ isRunning: false });
    } catch (error) {
      console.error('Error pausing indexing:', error);
    }
  };

  const handleResume = async () => {
    try {
      await fetchWithRetry('/api/indexing/resume', { method: 'POST' });
      setIsPaused(false);
    } catch (error) {
      console.error('Error resuming indexing:', error);
    }
  };

  // Don't show anything if not indexing
  if (!status.isRunning && !isPaused) {
    return null;
  }

  return (
    <div className="indexing-status-bar">
      <div className="indexing-status-content">
        <div className="indexing-status-info">
          <span className="indexing-status-icon">
            {status.isRunning ? '⚡' : '⏸️'}
          </span>
          <span className="indexing-status-text">
            {status.isRunning ? (
              <>
                Indexing photos... {status.processed || 0} / {status.total || 0}
                {status.progress !== undefined && (
                  <span className="indexing-progress"> ({Math.round(status.progress)}%)</span>
                )}
              </>
            ) : (
              'Indexing paused'
            )}
          </span>
        </div>

        {status.isRunning && status.progress !== undefined && (
          <div className="indexing-progress-bar">
            <div
              className="indexing-progress-fill"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        )}

        <button
          className="indexing-control-button"
          onClick={status.isRunning ? handlePause : handleResume}
        >
          {status.isRunning ? 'Pause' : 'Resume'}
        </button>
      </div>
    </div>
  );
};
