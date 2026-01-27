import { useState, useCallback } from 'react';

interface DuplicatePair {
  person1_id: number;
  person1_name: string;
  person1_face_count: number;
  person1_representative_face_id: number;
  person2_id: number;
  person2_name: string;
  person2_face_count: number;
  person2_representative_face_id: number;
  similarity: number;
}

interface DuplicateResult {
  duplicates: DuplicatePair[];
  threshold: number;
  total_pairs: number;
}

interface UseDuplicatesResult {
  duplicates: DuplicatePair[];
  loading: boolean;
  error: string | null;
  fetchDuplicates: (threshold?: number) => Promise<void>;
  mergePerson: (sourcePersonId: number, targetPersonId: number) => Promise<void>;
  dismissDuplicate: (index: number) => void;
}

export function useDuplicates(): UseDuplicatesResult {
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDuplicates = useCallback(async (threshold: number = 0.85) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/faces/persons/duplicates?threshold=${threshold}`);

      if (!response.ok) {
        throw new Error('Failed to fetch duplicates');
      }

      const data: DuplicateResult = await response.json();
      setDuplicates(data.duplicates);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching duplicates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const mergePerson = useCallback(async (sourcePersonId: number, targetPersonId: number) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/faces/persons/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePersonId, targetPersonId })
      });

      if (!response.ok) {
        throw new Error('Failed to merge persons');
      }

      // Remove the merged pair from duplicates list
      setDuplicates(prev =>
        prev.filter(d =>
          !(d.person1_id === sourcePersonId || d.person2_id === sourcePersonId)
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error merging persons:', err);
      throw err; // Re-throw to let component handle it
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissDuplicate = useCallback((index: number) => {
    setDuplicates(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    duplicates,
    loading,
    error,
    fetchDuplicates,
    mergePerson,
    dismissDuplicate
  };
}
