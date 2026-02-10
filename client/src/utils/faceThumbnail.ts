// Cache for face thumbnail URLs to avoid re-requesting
const thumbnailCache = new Map<number, string>();

/**
 * Get thumbnail URL directly from face ID (optimized - no extra API calls)
 */
export function getFaceThumbnailUrlDirect(faceId: number | null): string | null {
  if (!faceId) return null;
  return `/api/faces/${faceId}/thumbnail`;
}

/**
 * Get thumbnail URL from person ID (legacy - requires extra API call)
 * Use getFaceThumbnailUrlDirect when possible
 */
export async function getFaceThumbnailUrl(
  personId: number,
  _size: number = 150 // Not used, backend generates thumbnails at fixed size
): Promise<string | null> {
  // Check cache first
  if (thumbnailCache.has(personId)) {
    return thumbnailCache.get(personId)!;
  }

  try {
    // Get person's representative face ID from backend
    const personResponse = await fetch(`/api/faces/persons/${personId}`);
    if (!personResponse.ok) return null;

    const person = await personResponse.json();
    const faceId = person.representative_face_id || person.thumbnail_face_id;

    if (!faceId) {
      // If no representative face, get first face from person's faces
      const facesResponse = await fetch(`/api/faces?personId=${personId}`);
      if (!facesResponse.ok) return null;
      const faces = await facesResponse.json();
      if (faces.length === 0) return null;
      const firstFaceId = faces[0].id;
      if (!firstFaceId) return null;

      // Use backend thumbnail endpoint
      const thumbnailUrl = `/api/faces/${firstFaceId}/thumbnail`;
      thumbnailCache.set(personId, thumbnailUrl);
      return thumbnailUrl;
    }

    // Use backend thumbnail endpoint with representative face
    const thumbnailUrl = `/api/faces/${faceId}/thumbnail`;
    thumbnailCache.set(personId, thumbnailUrl);
    return thumbnailUrl;
  } catch (error) {
    console.error('Error getting face thumbnail:', error);
    return null;
  }
}

// Clear cache (call when data changes)
export function clearThumbnailCache(): void {
  thumbnailCache.clear();
}
