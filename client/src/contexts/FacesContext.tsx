import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { Person, ScanStatus, FaceStats } from '../types/face';

interface FacesContextValue {
  persons: Person[];
  scanStatus: ScanStatus;
  stats: FaceStats | null;
  loading: boolean;
  startScan: () => Promise<void>;
  runClustering: () => Promise<void>;
  createPerson: (name: string) => Promise<Person>;
  renamePerson: (personId: number, name: string) => Promise<void>;
  deletePerson: (personId: number) => Promise<void>;
  assignFaceToPerson: (faceId: number, personId: number) => Promise<void>;
  refetch: () => void;
  fetchIfNeeded: () => void;
  isInitialized: boolean;
}

const FacesContext = createContext<FacesContextValue | undefined>(undefined);

export function FacesProvider({ children }: { children: ReactNode }) {
  const [persons, setPersons] = useState<Person[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus>({ status: 'idle', total: 0, processed: 0 });
  const [stats, setStats] = useState<FaceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const pollIntervalRef = useRef<number | null>(null);

  const fetchPersons = useCallback(async () => {
    try {
      const response = await fetch('/api/faces/persons');
      if (response.ok) {
        const data = await response.json();
        setPersons(data);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Error fetching persons:', error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/faces/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  const fetchScanStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/faces/scan/status');
      if (response.ok) {
        const status = await response.json();
        setScanStatus(status);
        return status;
      }
    } catch (error) {
      console.error('Error fetching scan status:', error);
    }
    return null;
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;

    pollIntervalRef.current = window.setInterval(async () => {
      const status = await fetchScanStatus();
      if (status && (status.status === 'completed' || status.status === 'error' || status.status === 'idle')) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        fetchPersons();
        fetchStats();
      }
    }, 10000); // Poll every 10 seconds instead of 1 second to avoid slowing down face detection
  }, [fetchScanStatus, fetchPersons, fetchStats]);

  const startScan = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/faces/scan', { method: 'POST' });
      if (response.ok) {
        setScanStatus({ status: 'scanning', total: 0, processed: 0 });
        startPolling();
      }
    } catch (error) {
      console.error('Error starting scan:', error);
    } finally {
      setLoading(false);
    }
  };

  const runClustering = async () => {
    try {
      setLoading(true);
      // Don't send parameters - use optimal values from server .env
      const response = await fetch('/api/faces/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (response.ok) {
        await fetchPersons();
        await fetchStats();
      }
    } catch (error) {
      console.error('Error running clustering:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPerson = async (name: string): Promise<Person> => {
    const response = await fetch('/api/faces/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const person = await response.json();
    await fetchPersons();
    return person;
  };

  const renamePerson = async (personId: number, name: string) => {
    await fetch(`/api/faces/persons/${personId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    await fetchPersons();
  };

  const deletePerson = async (personId: number) => {
    await fetch(`/api/faces/persons/${personId}`, { method: 'DELETE' });
    await fetchPersons();
    await fetchStats();
  };

  const assignFaceToPerson = async (faceId: number, personId: number) => {
    await fetch(`/api/faces/${faceId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId })
    });
    await fetchPersons();
  };

  // DON'T fetch on mount - wait for explicit call
  // This prevents unnecessary API calls when user is on other tabs
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const refetch = useCallback(() => {
    setIsInitialized(false);
    fetchPersons();
    fetchStats();
    fetchScanStatus();
  }, [fetchPersons, fetchStats, fetchScanStatus]);

  const fetchIfNeeded = useCallback(() => {
    if (!isInitialized && !loading) {
      fetchPersons();
      fetchStats();
      fetchScanStatus();
    }
  }, [isInitialized, loading, fetchPersons, fetchStats, fetchScanStatus]);

  return (
    <FacesContext.Provider
      value={{
        persons,
        scanStatus,
        stats,
        loading,
        startScan,
        runClustering,
        createPerson,
        renamePerson,
        deletePerson,
        assignFaceToPerson,
        refetch,
        fetchIfNeeded,
        isInitialized,
      }}
    >
      {children}
    </FacesContext.Provider>
  );
}

export function useFacesContext() {
  const context = useContext(FacesContext);
  if (context === undefined) {
    throw new Error('useFacesContext must be used within a FacesProvider');
  }
  return context;
}
