import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface SmartAlbum {
  id: number;
  title: string;
  description: string | null;
  cover_photo_filename: string | null;
  start_date: string | null;
  end_date: string | null;
  photo_count: number;
  avg_similarity: number | null;
  created_at: string;
}

interface SmartAlbumsContextValue {
  albums: SmartAlbum[];
  loading: boolean;
  error: string | null;
  generating: boolean;
  refetch: () => void;
  fetchIfNeeded: () => void;
  generateAlbums: (params?: GenerateAlbumsParams) => Promise<void>;
  isInitialized: boolean;
}

interface GenerateAlbumsParams {
  epsVisual?: number;
  minSamples?: number;
  maxWindowDays?: number;
  maxGapDays?: number;
  replaceExisting?: boolean;
}

const SmartAlbumsContext = createContext<SmartAlbumsContextValue | undefined>(undefined);

export function SmartAlbumsProvider({ children }: { children: ReactNode }) {
  const [albums, setAlbums] = useState<SmartAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchAlbums = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/smart-albums');
      const data = await response.json();

      if (data.success) {
        setAlbums(data.albums);
        setIsInitialized(true);
      } else {
        setError(data.error || 'Failed to load albums');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load albums');
    } finally {
      setLoading(false);
    }
  }, []);

  const generateAlbums = useCallback(async (params: GenerateAlbumsParams = {}) => {
    try {
      setGenerating(true);
      setError(null);

      const response = await fetch('/api/smart-albums/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          epsVisual: params.epsVisual ?? 0.25,
          minSamples: params.minSamples ?? 2,
          maxWindowDays: params.maxWindowDays ?? 7,
          maxGapDays: params.maxGapDays ?? 2,
          replaceExisting: params.replaceExisting ?? true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchAlbums();
      } else {
        setError(data.error || 'Failed to generate albums');
        throw new Error(data.error || 'Failed to generate albums');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate albums';
      setError(errorMsg);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [fetchAlbums]);

  // DON'T fetch on mount - wait for explicit call
  // This prevents unnecessary API calls when user is on other tabs

  const refetch = useCallback(() => {
    setIsInitialized(false);
    fetchAlbums();
  }, [fetchAlbums]);

  const fetchIfNeeded = useCallback(() => {
    if (!isInitialized && !loading) {
      fetchAlbums();
    }
  }, [isInitialized, loading, fetchAlbums]);

  return (
    <SmartAlbumsContext.Provider
      value={{
        albums,
        loading,
        error,
        generating,
        refetch,
        fetchIfNeeded,
        generateAlbums,
        isInitialized,
      }}
    >
      {children}
    </SmartAlbumsContext.Provider>
  );
}

export function useSmartAlbumsContext() {
  const context = useContext(SmartAlbumsContext);
  if (context === undefined) {
    throw new Error('useSmartAlbumsContext must be used within a SmartAlbumsProvider');
  }
  return context;
}
