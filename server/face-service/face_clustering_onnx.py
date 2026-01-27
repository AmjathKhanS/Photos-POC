#!/usr/bin/env python3
"""
Face Clustering Service for ONNX Embeddings
Groups similar faces together using DBSCAN clustering
Optimized for 512-D embeddings from InsightFace
"""

import sys
import sqlite3
import numpy as np
from sklearn.cluster import DBSCAN
import json
import argparse


def get_all_encodings(db_path: str) -> tuple:
    """Get all face encodings from database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, encoding FROM faces WHERE person_id IS NULL
    ''')

    face_ids = []
    encodings = []

    for row in cursor.fetchall():
        face_id, encoding_blob = row
        face_ids.append(face_id)

        # ONNX embeddings are 512-D float32
        encoding = np.frombuffer(encoding_blob, dtype=np.float32)
        encodings.append(encoding)

    conn.close()
    return face_ids, encodings


def cluster_faces(encodings: list, eps: float = 0.6, min_samples: int = 2, metric: str = 'cosine') -> list:
    """
    Cluster face encodings to group similar faces.

    Args:
        encodings: List of face embeddings
        eps: Maximum distance between samples (lower = stricter clustering)
            - For cosine: 0.4-0.6 recommended (0.5 default)
            - For euclidean: 0.6-0.8 recommended
        min_samples: Minimum faces to form a cluster
        metric: 'cosine' (recommended for ONNX) or 'euclidean'

    Returns:
        Cluster labels (-1 means outlier/unassigned)
    """
    if len(encodings) < 2:
        return [0] * len(encodings)

    encoding_matrix = np.array(encodings)

    # Normalize embeddings for cosine similarity
    if metric == 'cosine':
        norms = np.linalg.norm(encoding_matrix, axis=1, keepdims=True)
        encoding_matrix = encoding_matrix / norms

    # Use DBSCAN clustering
    clustering = DBSCAN(eps=eps, min_samples=min_samples, metric=metric)
    labels = clustering.fit_predict(encoding_matrix)

    return labels.tolist()


def create_persons_from_clusters(db_path: str, face_ids: list, labels: list):
    """Create person entries for each cluster and assign faces"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get existing max person number for naming
    cursor.execute("SELECT COUNT(*) FROM persons")
    existing_count = cursor.fetchone()[0]

    # Group faces by cluster
    clusters = {}
    for face_id, label in zip(face_ids, labels):
        if label == -1:
            continue  # Skip outliers
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(face_id)

    created_persons = 0
    for cluster_label, cluster_face_ids in clusters.items():
        if len(cluster_face_ids) < 2:
            continue  # Skip single-face clusters

        # Create a new person
        person_name = f"Person {existing_count + created_persons + 1}"
        cursor.execute('''
            INSERT INTO persons (name, representative_face_id)
            VALUES (?, ?)
        ''', (person_name, cluster_face_ids[0]))

        person_id = cursor.lastrowid

        # Assign all faces in cluster to this person
        for face_id in cluster_face_ids:
            cursor.execute('''
                UPDATE faces SET person_id = ? WHERE id = ?
            ''', (person_id, face_id))

        created_persons += 1

    conn.commit()
    conn.close()

    return created_persons


def run_clustering(db_path: str, eps: float = 0.5, min_samples: int = 2, metric: str = 'cosine'):
    """
    Main clustering function optimized for ONNX 512-D embeddings

    Args:
        db_path: Path to SQLite database
        eps: Clustering threshold (0.5 recommended for cosine with ONNX)
        min_samples: Minimum faces per person
        metric: 'cosine' (default, recommended) or 'euclidean'
    """
    face_ids, encodings = get_all_encodings(db_path)

    if len(encodings) == 0:
        print(json.dumps({
            'status': 'completed',
            'message': 'No unassigned faces to cluster',
            'personsCreated': 0
        }))
        return

    # Verify embedding dimensions
    if len(encodings) > 0:
        embedding_dim = len(encodings[0])
        if embedding_dim == 512:
            print(f"Using ONNX embeddings (512-D)", file=sys.stderr)
        elif embedding_dim == 128:
            print(f"Warning: Found 128-D embeddings (dlib), expected 512-D (ONNX)", file=sys.stderr)

    labels = cluster_faces(encodings, eps, min_samples, metric)
    persons_created = create_persons_from_clusters(db_path, face_ids, labels)

    unique_clusters = len(set(l for l in labels if l != -1))
    outliers = labels.count(-1)

    print(json.dumps({
        'status': 'completed',
        'totalFaces': len(face_ids),
        'embeddingDimension': len(encodings[0]) if encodings else 0,
        'clustersFound': unique_clusters,
        'outliers': outliers,
        'personsCreated': persons_created,
        'metric': metric,
        'eps': eps
    }))


def main():
    parser = argparse.ArgumentParser(description='Face Clustering Service (ONNX optimized)')
    parser.add_argument('--db-path', required=True, help='Path to SQLite database')
    parser.add_argument('--eps', type=float, default=0.5,
                       help='DBSCAN eps parameter (0.5 default for cosine, 0.6 for euclidean)')
    parser.add_argument('--min-samples', type=int, default=2,
                       help='DBSCAN min_samples parameter')
    parser.add_argument('--metric', type=str, default='cosine',
                       choices=['cosine', 'euclidean'],
                       help='Distance metric (cosine recommended for ONNX)')

    args = parser.parse_args()
    run_clustering(args.db_path, args.eps, args.min_samples, args.metric)


if __name__ == '__main__':
    main()
