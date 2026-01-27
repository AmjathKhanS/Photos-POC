# Photo Viewer

A Google Photos-like photo viewer built with React and Express.

## Features

- Grid view of photos with thumbnails
- Full-screen lightbox with keyboard navigation
- HEIC to JPEG conversion (iPhone photos)
- Infinite scroll pagination
- Thumbnail caching for fast loading

---

## Project Structure

```
photo-viewer/
├── client/                 # React Frontend (Vite)
│   ├── src/
│   │   ├── components/     # UI Components
│   │   ├── hooks/          # Custom React Hooks
│   │   ├── types/          # TypeScript Types
│   │   ├── styles/         # CSS Styles
│   │   ├── App.tsx         # Main App Component
│   │   └── main.tsx        # Entry Point
│   └── package.json
│
├── server/                 # Express Backend
│   ├── src/
│   │   ├── routes/         # API Endpoints
│   │   ├── services/       # Business Logic
│   │   └── index.ts        # Server Entry
│   └── package.json
│
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Configuration

Edit the photos directory path in `server/src/services/photoService.ts`:

```typescript
const PHOTOS_DIR = 'D:\\Photos Ai\\mobile';  // Windows
// or
const PHOTOS_DIR = '/mnt/d/Photos Ai/mobile'; // WSL/Linux
```

### Running the App

**Terminal 1 - Start Server:**
```bash
cd server
npx tsx watch src/index.ts
```

**Terminal 2 - Start Client:**
```bash
cd client
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Architecture

### Backend (Express Server - Port 3002)

#### Entry Point (`server/src/index.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import photosRouter from './routes/photos.js';

const app = express();
const PORT = 3002;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use('/api/photos', photosRouter);

app.listen(PORT);
```

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/photos?page=1&limit=50` | List photos (paginated) |
| GET | `/api/photos/thumbnail/:filename` | Get thumbnail (200x200) |
| GET | `/api/photos/full/:filename` | Get full-size image |

#### Photo Service (`server/src/services/photoService.ts`)

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `getPhotoList()` | Reads folder, returns photo metadata |
| `getThumbnail()` | Generates/caches 200x200 thumbnails |
| `getFullImage()` | Returns full image (converts HEIC→JPEG) |

**Thumbnail Generation Flow:**

```
Original Image
     ↓
Sharp Library
     ↓
Resize 200x200
     ↓
JPEG 60% quality (progressive)
     ↓
Save to Cache
     ↓
Send Response
```

#### Thumbnail Cache (`server/src/services/thumbnailService.ts`)

- **Location:** OS temp folder (`%TEMP%\photo-viewer-cache\`)
- **Key:** MD5 hash of filename
- **Format:** `thumbnail-{hash}.jpg`

---

### Frontend (React + Vite - Port 5173)

#### Component Hierarchy

```
App.tsx
├── Header (title, photo count)
├── PhotoGrid
│   └── PhotoCard (thumbnail + loading state)
└── Lightbox (full image viewer)
```

#### App Component (`client/src/App.tsx`)

Main application component that:
- Fetches photos using `usePhotos` hook
- Manages lightbox open/close state
- Handles photo navigation

```typescript
export default function App() {
  const { photos, loading, error, hasMore, loadMore, total } = usePhotos();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ... render PhotoGrid and Lightbox
}
```

#### usePhotos Hook (`client/src/hooks/usePhotos.ts`)

Custom hook for fetching and paginating photos.

```typescript
const {
  photos,    // Photo[] - loaded photos
  loading,   // boolean - loading state
  error,     // string | null - error message
  hasMore,   // boolean - more photos available
  total,     // number - total photo count
  loadMore,  // () => void - load next page
  refetch    // () => void - refresh all
} = usePhotos();
```

#### PhotoGrid Component (`client/src/components/PhotoGrid.tsx`)

Displays photos in a responsive grid with infinite scroll.

```typescript
<PhotoGrid
  photos={photos}
  onPhotoClick={handleClick}
  hasMore={hasMore}
  onLoadMore={loadMore}
  loading={loading}
/>
```

**Infinite Scroll:** Uses `IntersectionObserver` to detect when user scrolls near bottom.

#### PhotoCard Component (`client/src/components/PhotoCard.tsx`)

Individual photo thumbnail with loading states.

**States:**
- Loading: Shows spinner
- Loaded: Shows image
- Error: Shows error message

**Lazy Loading:** Uses native `loading="lazy"` attribute.

#### Lightbox Component (`client/src/components/Lightbox.tsx`)

Full-screen image viewer with navigation.

**Keyboard Controls:**

| Key | Action |
|-----|--------|
| `←` Arrow Left | Previous photo |
| `→` Arrow Right | Next photo |
| `Esc` | Close lightbox |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│                                                              │
│  App.tsx                                                     │
│     │                                                        │
│     ├── usePhotos() ──fetch──→ /api/photos?page=1           │
│     │       ↓                                                │
│     │   photos[]                                             │
│     │       ↓                                                │
│     ├── PhotoGrid                                            │
│     │       │                                                │
│     │       └── PhotoCard ──<img>──→ /api/photos/thumbnail  │
│     │                                                        │
│     └── Lightbox ──<img>──→ /api/photos/full                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        SERVER                                │
│                                                              │
│  /api/photos                                                 │
│     └── photoService.getPhotoList()                         │
│              └── Read photos directory                       │
│                                                              │
│  /api/photos/thumbnail/:file                                │
│     └── photoService.getThumbnail()                         │
│              ├── Check cache → Return if exists             │
│              └── Generate → Save cache → Return             │
│                                                              │
│  /api/photos/full/:file                                     │
│     └── photoService.getFullImage()                         │
│              └── Read file (convert HEIC if needed)         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## UI Layout

### Photo Grid View

```
┌─────────────────────────────────────┐
│  Photo Viewer          150 photos   │
├─────────────────────────────────────┤
│                                     │
│    ┌───┐ ┌───┐ ┌───┐ ┌───┐        │
│    │   │ │   │ │   │ │   │        │
│    └───┘ └───┘ └───┘ └───┘        │
│    ┌───┐ ┌───┐ ┌───┐ ┌───┐        │
│    │   │ │   │ │   │ │   │        │
│    └───┘ └───┘ └───┘ └───┘        │
│                                     │
│       [Scroll for more...]          │
└─────────────────────────────────────┘
```

### Lightbox View

```
┌─────────────────────────────────────┐
│                              [X]    │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│ ←│         Full Image          │→  │
│  │                             │   │
│  └─────────────────────────────┘   │
│       IMG_1234.jpg    (5/150)       │
└─────────────────────────────────────┘
```

---

## Technologies Used

### Backend

| Library | Version | Purpose |
|---------|---------|---------|
| Express | 4.18.2 | Web server framework |
| Sharp | 0.33.2 | Image processing (resize, convert) |
| heic-convert | 2.1.0 | Convert iPhone HEIC to JPEG |
| cors | 2.8.5 | Cross-origin resource sharing |
| mime-types | 2.1.35 | Detect file MIME types |

### Frontend

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.3.3 | Type safety |
| Vite | 5.x | Dev server & bundler |

---

## Performance Optimizations

1. **Pagination** - Load 50 photos at a time instead of all
2. **Lazy Loading** - Browser loads images only when visible
3. **Thumbnail Caching** - Generate once, serve from disk cache
4. **Progressive JPEG** - Images render progressively (faster perceived load)
5. **Smaller Thumbnails** - 200px size, 60% JPEG quality
6. **Infinite Scroll** - Load more photos as user scrolls

---

## Supported Image Formats

| Extension | Support |
|-----------|---------|
| .jpg, .jpeg | Native |
| .png | Native |
| .gif | Native |
| .webp | Native |
| .heic | Converted to JPEG |

---

## Troubleshooting

### Photos not loading

1. Check the `PHOTOS_DIR` path in `photoService.ts`
2. Ensure the path uses correct format:
   - Windows: `D:\\Photos Ai\\mobile`
   - WSL: `/mnt/d/Photos Ai/mobile`

### Port already in use

```bash
# Windows - Kill process on port
netstat -ano | findstr :3002
taskkill /F /PID <PID>

# Or change port in server/src/index.ts
```

### Slow thumbnail loading

- First load is slow (generating thumbnails)
- Subsequent loads are fast (cached)
- Clear cache: Delete `%TEMP%\photo-viewer-cache\`

---

## License

MIT
#   P h o t o s - P O C  
 