import React, { useEffect, useState } from 'react';

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

export const PlacesView: React.FC = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWithLocation, setTotalWithLocation] = useState(0);

  useEffect(() => {
    fetchLocationData();
  }, []);

  const fetchLocationData = async () => {
    try {
      setLoading(true);

      // Fetch location count
      const countRes = await fetch('/api/locations/count');
      const countData = await countRes.json();
      setTotalWithLocation(countData.count);

      // Fetch cities
      const citiesRes = await fetch('/api/locations/cities');
      const citiesData = await citiesRes.json();
      setCities(citiesData);

      // Fetch countries
      const countriesRes = await fetch('/api/locations/countries');
      const countriesData = await countriesRes.json();
      setCountries(countriesData);

    } catch (error) {
      console.error('Error fetching location data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📍</div>
        <h2>Loading location data...</h2>
      </div>
    );
  }

  if (totalWithLocation === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📍</div>
        <h2>No Photos with Location Data</h2>
        <p>Photos with GPS coordinates will appear here.</p>
        <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '12px' }}>
          GPS data is extracted automatically during photo indexing.
        </p>
        <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>
          {totalWithLocation > 0
            ? `${totalWithLocation} photos have location data but no city/country info yet.`
            : 'Start indexing your photos to extract location data!'}
        </p>
      </div>
    );
  }

  return (
    <div className="places-view">
      <div className="view-header">
        <div>
          <h2>📍 Places</h2>
          <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>
            {totalWithLocation} photos with GPS coordinates
          </p>
        </div>
      </div>

      {/* Countries Section */}
      {countries.length > 0 && (
        <div className="places-section">
          <h3 style={{ fontSize: '16px', marginBottom: '12px', opacity: 0.9 }}>
            🌍 Countries ({countries.length})
          </h3>
          <div className="places-grid">
            {countries.map((country) => (
              <div key={country.country_code} className="place-card">
                <div className="place-flag">
                  {country.country_code && (
                    <span style={{ fontSize: '32px' }}>
                      {getFlagEmoji(country.country_code)}
                    </span>
                  )}
                </div>
                <div className="place-info">
                  <div className="place-name">{country.country}</div>
                  <div className="place-count">
                    {country.count} {country.count === 1 ? 'photo' : 'photos'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cities Section */}
      {cities.length > 0 && (
        <div className="places-section" style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px', opacity: 0.9 }}>
            🏙️ Cities ({cities.length})
          </h3>
          <div className="places-grid">
            {cities.map((city) => (
              <div key={`${city.city}-${city.country}`} className="place-card">
                <div className="place-icon">📍</div>
                <div className="place-info">
                  <div className="place-name">{city.city}</div>
                  <div className="place-country">{city.country}</div>
                  <div className="place-count">
                    {city.count} {city.count === 1 ? 'photo' : 'photos'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 2 Preview */}
      <div className="places-section" style={{ marginTop: '32px', opacity: 0.6 }}>
        <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>
          🗺️ Coming Soon
        </h3>
        <p style={{ fontSize: '13px', lineHeight: '1.6' }}>
          • Interactive map view with markers<br />
          • Click locations to view photos<br />
          • Trip detection and location timeline<br />
          • Location-based smart albums
        </p>
      </div>
    </div>
  );
};

/**
 * Convert country code to flag emoji
 * @param countryCode - ISO 3166-1 alpha-2 country code
 */
function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🏳️';

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}
