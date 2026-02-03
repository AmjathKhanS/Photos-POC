import React, { useEffect, useState } from 'react';

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
        const response = await fetch('/api/indexing/status');
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

    // Only poll if indexing is running
    let interval: NodeJS.Timeout | null = null;

    const checkAndPoll = async () => {
      const currentStatus = await fetchStatus();

      if (currentStatus.isRunning && !interval) {
        // Start polling when indexing starts
        interval = setInterval(fetchStatus, 3000); // Reduced frequency: 3 seconds
      } else if (!currentStatus.isRunning && interval) {
        // Stop polling when indexing stops
        clearInterval(interval);
        interval = null;
      }
    };

    // Check every 10 seconds if we should start polling
    checkAndPoll();
    const checkInterval = setInterval(checkAndPoll, 10000);

    return () => {
      if (interval) clearInterval(interval);
      clearInterval(checkInterval);
    };
  }, []);

  const handlePause = async () => {
    try {
      await fetch('/api/indexing/pause', { method: 'POST' });
      setIsPaused(true);
      setStatus({ isRunning: false });
    } catch (error) {
      console.error('Error pausing indexing:', error);
    }
  };

  const handleResume = async () => {
    try {
      await fetch('/api/indexing/resume', { method: 'POST' });
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
