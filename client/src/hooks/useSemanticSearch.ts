import { useState, useCallback } from 'react';
import type { Photo } from '../types/photo';

interface SearchResult {
  photo: Photo;
  score: number;
  matchType: 'visual' | 'text' | 'hybrid';
  ocrText?: string;
  matchedTags?: string[];
}

interface SearchResponse {
  success: boolean;
  query: string;
  results: SearchResult[];
  count: number;
  processingTimeMs: number;
  error?: string;
}

export function useSemanticSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, limit: number = 50): Promise<SearchResult[]> => {
    if (!query.trim()) {
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:3002/api/semantic-search/search?query=${encodeURIComponent(query)}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data: SearchResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      return data.results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Semantic search error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { search, loading, error };
}
