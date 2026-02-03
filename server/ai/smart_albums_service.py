#!/usr/bin/env python3
"""
Smart Photo Clustering Service
Automatically groups photos into albums based on visual similarity and temporal proximity
"""

import sys
import json
import argparse
import sqlite3
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from sklearn.cluster import DBSCAN
from collections import defaultdict
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SmartAlbumsService:
    """Service for clustering photos into smart albums"""

    def __init__(self, db_path: str):
        """Initialize with database path"""
        self.db_path = db_path
        logger.info(f"Initialized SmartAlbumsService with DB: {db_path}")

    def load_photo_data(self) -> Tuple[List[Dict], np.ndarray]:
        """
        Load photo metadata and CLIP embeddings from database

        Returns:
            Tuple of (photo_list, embeddings_matrix)
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get all photos with embeddings
        cursor.execute("""
            SELECT
                pe.photo_filename,
                pe.clip_embedding,
                pm.date_taken
            FROM photo_embeddings pe
            LEFT JOIN photo_metadata pm ON pe.photo_filename = pm.photo_filename
            ORDER BY pm.date_taken
        """)

        photos = []
        embeddings = []

        for row in cursor.fetchall():
            # Convert binary BLOB to numpy array
            embedding_bytes = row['clip_embedding']
            if embedding_bytes:
                embedding = np.frombuffer(embedding_bytes, dtype=np.float32)
                embeddings.append(embedding)
                photos.append({
                    'filename': row['photo_filename'],
                    'modified_at': row['date_taken']  # Using date_taken from EXIF
                })

        conn.close()

        embeddings_matrix = np.array(embeddings) if embeddings else np.array([])
        logger.info(f"Loaded {len(photos)} photos with embeddings")

        return photos, embeddings_matrix

    def create_temporal_buckets(self, photos: List[Dict],
                               max_window_days: int = 7,
                               max_gap_days: int = 2) -> List[List[int]]:
        """
        Pre-group photos into temporal buckets using sliding windows.
        This enforces temporal boundaries as hard constraints.

        Args:
            photos: List of photo metadata (must be sorted by date)
            max_window_days: Maximum span of dates within a bucket (default: 7)
            max_gap_days: Maximum gap between consecutive photos (default: 2)

        Returns:
            List of buckets, each containing photo indices
        """
        if not photos:
            return []

        buckets = []
        current_bucket = []
        bucket_start_date = None
        prev_date = None

        for idx, photo in enumerate(photos):
            if not photo['modified_at']:
                continue

            try:
                current_date = datetime.fromisoformat(photo['modified_at'].replace('Z', '+00:00'))
            except Exception as e:
                logger.warning(f"Error parsing date for photo {idx}: {e}")
                continue

            # Start new bucket if:
            # 1. First photo
            # 2. Gap from previous photo > max_gap_days
            # 3. Current bucket span > max_window_days
            # 4. Different year
            should_start_new_bucket = False

            if bucket_start_date is None:
                # First photo
                should_start_new_bucket = True
            elif prev_date:
                gap_days = (current_date - prev_date).days
                span_days = (current_date - bucket_start_date).days

                if gap_days > max_gap_days:
                    # Large gap detected
                    should_start_new_bucket = True
                    logger.debug(f"Starting new bucket: gap of {gap_days} days")
                elif span_days > max_window_days:
                    # Bucket span exceeded
                    should_start_new_bucket = True
                    logger.debug(f"Starting new bucket: span of {span_days} days")
                elif current_date.year != bucket_start_date.year:
                    # Different year
                    should_start_new_bucket = True
                    logger.debug(f"Starting new bucket: year change")

            if should_start_new_bucket:
                # Save previous bucket if it has enough photos
                if len(current_bucket) >= 2:
                    buckets.append(current_bucket)
                    logger.debug(f"Created bucket with {len(current_bucket)} photos")

                # Start new bucket
                current_bucket = [idx]
                bucket_start_date = current_date
            else:
                # Add to current bucket
                current_bucket.append(idx)

            prev_date = current_date

        # Add final bucket
        if len(current_bucket) >= 2:
            buckets.append(current_bucket)
            logger.debug(f"Created final bucket with {len(current_bucket)} photos")

        logger.info(f"Created {len(buckets)} temporal buckets")
        return buckets

    def compute_visual_distance_matrix(self, embeddings: np.ndarray) -> np.ndarray:
        """
        Compute pure cosine distance from CLIP embeddings.

        Args:
            embeddings: CLIP embeddings matrix

        Returns:
            Visual distance matrix (1 - cosine_similarity)
        """
        if len(embeddings) == 0:
            return np.array([])

        # Normalize embeddings
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        normalized_embeddings = embeddings / (norms + 1e-8)

        # Compute cosine similarity
        visual_similarity = np.dot(normalized_embeddings, normalized_embeddings.T)

        # Convert to distance (1 - similarity)
        visual_distance = 1 - visual_similarity

        # Ensure non-negative (clip numerical precision errors)
        visual_distance = np.maximum(visual_distance, 0)

        return visual_distance

    def cluster_photos(self, photos: List[Dict], embeddings: np.ndarray,
                      eps_visual: float = 0.25, min_samples: int = 2,
                      max_window_days: int = 7, max_gap_days: int = 2) -> List[List[int]]:
        """
        Two-stage clustering: temporal pre-grouping + visual clustering.

        Stage 1: Create temporal buckets (hard constraint on dates)
        Stage 2: Apply visual clustering within each bucket

        Args:
            photos: List of photo metadata
            embeddings: CLIP embeddings matrix
            eps_visual: Maximum visual distance between samples (pure cosine distance)
            min_samples: Minimum samples in a cluster
            max_window_days: Maximum date span per temporal bucket
            max_gap_days: Maximum gap between consecutive photos in bucket

        Returns:
            List of clusters (each cluster is list of photo indices)
        """
        if len(photos) < min_samples:
            logger.warning(f"Not enough photos ({len(photos)}) for clustering")
            return []

        # Stage 1: Create temporal buckets
        logger.info(f"Stage 1: Creating temporal buckets (max_window={max_window_days}d, max_gap={max_gap_days}d)...")
        temporal_buckets = self.create_temporal_buckets(photos, max_window_days, max_gap_days)

        if not temporal_buckets:
            logger.warning("No temporal buckets created")
            return []

        # Stage 2: Visual clustering within each temporal bucket
        logger.info(f"Stage 2: Visual clustering within {len(temporal_buckets)} temporal buckets...")
        all_clusters = []

        for bucket_idx, bucket_indices in enumerate(temporal_buckets):
            if len(bucket_indices) < min_samples:
                # Bucket too small, skip clustering
                logger.debug(f"Bucket {bucket_idx+1}: Skipping (only {len(bucket_indices)} photos)")
                continue

            # Extract embeddings for this bucket
            bucket_embeddings = embeddings[bucket_indices]

            # Compute visual distance matrix for bucket
            visual_distance = self.compute_visual_distance_matrix(bucket_embeddings)

            # Apply DBSCAN on visual distance only
            clustering = DBSCAN(eps=eps_visual, min_samples=min_samples, metric='precomputed')
            labels = clustering.fit_predict(visual_distance)

            # Group photos by cluster label
            bucket_clusters = defaultdict(list)
            for local_idx, label in enumerate(labels):
                if label != -1:  # Ignore noise points
                    # Map back to global photo index
                    global_idx = bucket_indices[local_idx]
                    bucket_clusters[label].append(global_idx)

            # Add clusters from this bucket
            for cluster_indices in bucket_clusters.values():
                if len(cluster_indices) >= min_samples:
                    all_clusters.append(cluster_indices)
                    logger.debug(f"Bucket {bucket_idx+1}: Created cluster with {len(cluster_indices)} photos")

        logger.info(f"Found {len(all_clusters)} total clusters across all buckets")
        return all_clusters

    def generate_album_title(self, photos: List[Dict], photo_indices: List[int]) -> str:
        """
        Generate a meaningful title for an album

        Args:
            photos: All photo metadata
            photo_indices: Indices of photos in this album

        Returns:
            Album title
        """
        cluster_photos = [photos[i] for i in photo_indices]

        # Get date range
        dates = [p['modified_at'] for p in cluster_photos if p['modified_at']]
        if dates:
            dates_parsed = [datetime.fromisoformat(d.replace('Z', '+00:00')) for d in dates]
            dates_parsed.sort()

            start_date = dates_parsed[0]
            end_date = dates_parsed[-1]

            # Determine time span
            delta = end_date - start_date

            if delta.days == 0:
                # Same day event
                return f"{start_date.strftime('%B %d, %Y')}"
            elif delta.days <= 3:
                # Multi-day event (vacation, trip)
                return f"{start_date.strftime('%B %d')} - {end_date.strftime('%d, %Y')}"
            elif delta.days <= 7:
                # Week-long event
                return f"{start_date.strftime('%B %Y')} - Week {start_date.isocalendar()[1]}"
            elif start_date.month == end_date.month:
                # Same month
                return f"{start_date.strftime('%B %Y')}"
            else:
                # Multi-month
                return f"{start_date.strftime('%B')} - {end_date.strftime('%B %Y')}"
        else:
            return f"Album {photo_indices[0]}"

    def generate_album_description(self, photo_count: int, date_range: tuple) -> str:
        """Generate description for album"""
        start, end = date_range
        if start and end:
            delta = (end - start).days
            if delta == 0:
                return f"{photo_count} photos from this day"
            elif delta <= 3:
                return f"{photo_count} photos from this event"
            elif delta <= 7:
                return f"{photo_count} photos from this week"
            else:
                return f"{photo_count} photos from this period"
        return f"{photo_count} photos"

    def create_smart_albums(self, eps_visual: float = 0.25, min_samples: int = 2,
                           max_window_days: int = 7, max_gap_days: int = 2) -> List[Dict]:
        """
        Create smart albums from photos using two-stage clustering

        Args:
            eps_visual: Visual similarity threshold (pure cosine distance)
            min_samples: Minimum photos per album
            max_window_days: Maximum date span per album (days)
            max_gap_days: Maximum gap between photos in same album (days)

        Returns:
            List of album dictionaries
        """
        # Load data
        photos, embeddings = self.load_photo_data()

        if len(photos) == 0:
            logger.warning("No photos with embeddings found")
            return []

        # Cluster photos using two-stage approach
        clusters = self.cluster_photos(
            photos, embeddings,
            eps_visual=eps_visual,
            min_samples=min_samples,
            max_window_days=max_window_days,
            max_gap_days=max_gap_days
        )

        # Generate album metadata
        albums = []
        for cluster_idx, photo_indices in enumerate(clusters):
            cluster_photos = [photos[i] for i in photo_indices]

            # Get date range
            dates = [p['modified_at'] for p in cluster_photos if p['modified_at']]
            start_date = None
            end_date = None

            if dates:
                dates_parsed = [datetime.fromisoformat(d.replace('Z', '+00:00')) for d in dates]
                dates_parsed.sort()
                start_date = dates_parsed[0]
                end_date = dates_parsed[-1]

            # Generate title
            title = self.generate_album_title(photos, photo_indices)

            # Generate description
            description = self.generate_album_description(
                len(cluster_photos),
                (start_date, end_date)
            )

            # Calculate average visual similarity within cluster
            cluster_embeddings = embeddings[photo_indices]
            if len(cluster_embeddings) > 1:
                norms = np.linalg.norm(cluster_embeddings, axis=1, keepdims=True)
                normalized = cluster_embeddings / (norms + 1e-8)
                similarity_matrix = np.dot(normalized, normalized.T)
                avg_similarity = float(np.mean(similarity_matrix[np.triu_indices(len(cluster_embeddings), k=1)]))
            else:
                avg_similarity = 1.0

            # Choose cover photo (middle photo chronologically)
            if dates:
                middle_idx = len(cluster_photos) // 2
                cover_photo = cluster_photos[middle_idx]['filename']
            else:
                cover_photo = cluster_photos[0]['filename']

            album = {
                'title': title,
                'description': description,
                'cover_photo_filename': cover_photo,
                'start_date': start_date.isoformat() if start_date else None,
                'end_date': end_date.isoformat() if end_date else None,
                'photo_count': len(cluster_photos),
                'avg_similarity': avg_similarity,
                'photos': [
                    {
                        'filename': p['filename'],
                        'similarity_score': 0.0  # Can be computed if needed
                    }
                    for p in cluster_photos
                ]
            }

            albums.append(album)

        # Sort albums by start date (most recent first)
        albums.sort(key=lambda a: a['start_date'] or '', reverse=True)

        logger.info(f"Generated {len(albums)} smart albums")
        return albums


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description="Smart Photo Clustering Service - Two-Stage Clustering")
    parser.add_argument("--db-path", type=str, required=True, help="Path to SQLite database")
    parser.add_argument("--eps-visual", type=float, default=0.25, help="Visual similarity threshold (cosine distance)")
    parser.add_argument("--min-samples", type=int, default=2, help="Minimum photos per album")
    parser.add_argument("--max-window-days", type=int, default=7, help="Maximum date span per album (days)")
    parser.add_argument("--max-gap-days", type=int, default=2, help="Maximum gap between photos in album (days)")

    args = parser.parse_args()

    try:
        service = SmartAlbumsService(args.db_path)
        albums = service.create_smart_albums(
            eps_visual=args.eps_visual,
            min_samples=args.min_samples,
            max_window_days=args.max_window_days,
            max_gap_days=args.max_gap_days
        )

        # Output as JSON
        print(json.dumps({
            'success': True,
            'albums': albums,
            'count': len(albums)
        }, indent=2))

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
