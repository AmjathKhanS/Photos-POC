import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PhotosProvider } from './contexts/PhotosContext';
import { FacesProvider } from './contexts/FacesContext';
import { LocationProvider } from './contexts/LocationContext';
import { MemoriesProvider } from './contexts/MemoriesContext';
import { SmartAlbumsProvider } from './contexts/SmartAlbumsContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PhotosProvider>
      <FacesProvider>
        <LocationProvider>
          <MemoriesProvider>
            <SmartAlbumsProvider>
              <App />
            </SmartAlbumsProvider>
          </MemoriesProvider>
        </LocationProvider>
      </FacesProvider>
    </PhotosProvider>
  </React.StrictMode>
);
