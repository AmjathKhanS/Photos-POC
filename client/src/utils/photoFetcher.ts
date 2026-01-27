import type { Photo } from '../types/photo';

interface PhotosResponse {
  photos: Photo[];
  total: number;
  hasMore: boolean;
}

export async function fetchAllPhotos(
  onProgress?: (loaded: number, total: number) => void
): Promise<Photo[]> {
  const allPhotos: Photo[] = [];
  let page = 1;
  let hasMore = true;
  let total = 0;

  while (hasMore) {
    const response = await fetch(`/api/photos?page=${page}&limit=100`);
    if (!response.ok) {
      throw new Error('Failed to fetch photos');
    }
    const data: PhotosResponse = await response.json();

    allPhotos.push(...data.photos);
    hasMore = data.hasMore;
    total = data.total;

    if (onProgress) {
      onProgress(allPhotos.length, total);
    }

    page++;
  }

  console.log(`Fetched all ${allPhotos.length} photos for scanning`);
  return allPhotos;
}
