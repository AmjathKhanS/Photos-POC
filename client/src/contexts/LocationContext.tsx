import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface City {
  city: string;
  country: string;
  count: number;
  avg_lat: number;
  avg_lon: number;
}

interface Country {
  country: string;
  country_code: string;
  count: number;
}

interface LocationContextValue {
  cities: City[];
  countries: Country[];
  totalWithLocation: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isInitialized: boolean;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [cities, setCities] = useState<City[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [totalWithLocation, setTotalWithLocation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchLocationData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch location count
      const countRes = await fetch('/api/locations/count');
      if (!countRes.ok) throw new Error('Failed to fetch location count');
      const countData = await countRes.json();
      setTotalWithLocation(countData.count);

      // Fetch cities
      const citiesRes = await fetch('/api/locations/cities');
      if (!citiesRes.ok) throw new Error('Failed to fetch cities');
      const citiesData = await citiesRes.json();
      setCities(citiesData);

      // Fetch countries
      const countriesRes = await fetch('/api/locations/countries');
      if (!countriesRes.ok) throw new Error('Failed to fetch countries');
      const countriesData = await countriesRes.json();
      setCountries(countriesData);

      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount - only run when isInitialized changes
  useEffect(() => {
    if (!isInitialized) {
      fetchLocationData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  const refetch = useCallback(() => {
    setIsInitialized(false);
    fetchLocationData();
  }, [fetchLocationData]);

  return (
    <LocationContext.Provider
      value={{
        cities,
        countries,
        totalWithLocation,
        loading,
        error,
        refetch,
        isInitialized,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}
