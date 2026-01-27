import { useState, useEffect, useCallback } from 'react';
import type { Memory } from '../types/memory';

const API_BASE = '/api/memories';

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  return {
    memories,
    loading,
    error,
    refetch: fetchMemories,
    dismissMemory,
    deleteMemory,
    generateDaily
  };
}
