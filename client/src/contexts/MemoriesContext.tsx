import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Memory } from '../types/memory';

const API_BASE = '/api/memories';

interface MemoriesContextValue {
  memories: Memory[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  fetchIfNeeded: () => void;
  dismissMemory: (memoryId: number) => Promise<void>;
  deleteMemory: (memoryId: number) => Promise<void>;
  generateDaily: () => Promise<void>;
  isInitialized: boolean;
}

const MemoriesContext = createContext<MemoriesContextValue | undefined>(undefined);

export function MemoriesProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(API_BASE);
      if (!response.ok) {
        throw new Error('Failed to fetch memories');
      }

      const data = await response.json();
      setMemories(data);
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching memories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissMemory = useCallback(async (memoryId: number) => {
    try {
      const response = await fetch(`${API_BASE}/${memoryId}/dismiss`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss memory');
      }

      // Remove from local state
      setMemories(prev => prev.filter(m => m.id !== memoryId));
    } catch (err) {
      console.error('Error dismissing memory:', err);
      throw err;
    }
  }, []);

  const deleteMemory = useCallback(async (memoryId: number) => {
    try {
      const response = await fetch(`${API_BASE}/${memoryId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete memory');
      }

      // Remove from local state
      setMemories(prev => prev.filter(m => m.id !== memoryId));
    } catch (err) {
      console.error('Error deleting memory:', err);
      throw err;
    }
  }, []);

  const generateDaily = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/generate/daily`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to generate daily memories');
      }

      // Refresh memories after generation
      await fetchMemories();
    } catch (err) {
      console.error('Error generating daily memories:', err);
      throw err;
    }
  }, [fetchMemories]);

  // DON'T fetch on mount - wait for explicit call
  // This prevents unnecessary API calls when user is on other tabs

  const refetch = useCallback(() => {
    setIsInitialized(false);
    fetchMemories();
  }, [fetchMemories]);

  const fetchIfNeeded = useCallback(() => {
    if (!isInitialized && !loading) {
      fetchMemories();
    }
  }, [isInitialized, loading, fetchMemories]);

  return (
    <MemoriesContext.Provider
      value={{
        memories,
        loading,
        error,
        refetch,
        fetchIfNeeded,
        dismissMemory,
        deleteMemory,
        generateDaily,
        isInitialized,
      }}
    >
      {children}
    </MemoriesContext.Provider>
  );
}

export function useMemoriesContext() {
  const context = useContext(MemoriesContext);
  if (context === undefined) {
    throw new Error('useMemoriesContext must be used within a MemoriesProvider');
  }
  return context;
}
