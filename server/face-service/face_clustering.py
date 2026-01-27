#!/usr/bin/env python3
"""
Face Clustering Service
Groups similar faces together using DBSCAN clustering
"""

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
        encodings.append(np.frombuffer(encoding_blob, dtype=np.float64))

    conn.close()
    return face_ids, encodings


def cluster_faces(encodings: list, eps: float = 0.5, min_samples: int = 2) -> list:
    """
    Cluster face encodings to group similar faces.
    Returns cluster labels (-1 means outlier/unassigned)
    """
    if len(encodings) < 2:
        return [0] * len(encodings)

    encoding_matrix = np.array(encodings)

    # Use DBSCAN clustering
    clustering = DBSCAN(eps=eps, min_samples=min_samples, metric='euclidean')
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


def run_clustering(db_path: str, eps: float = 0.5, min_samples: int = 2):
    """Main clustering function"""
    face_ids, encodings = get_all_encodings(db_path)

    if len(encodings) == 0:
        print(json.dumps({'status': 'completed', 'message': 'No unassigned faces to cluster', 'personsCreated': 0}))
        return

    labels = cluster_faces(encodings, eps, min_samples)
    persons_created = create_persons_from_clusters(db_path, face_ids, labels)

    unique_clusters = len(set(l for l in labels if l != -1))
    outliers = labels.count(-1)

    print(json.dumps({
        'status': 'completed',
        'totalFaces': len(face_ids),
        'clustersFound': unique_clusters,
        'outliers': outliers,
        'personsCreated': persons_created
    }))


def main():
    parser = argparse.ArgumentParser(description='Face Clustering Service')
    parser.add_argument('--db-path', required=True, help='Path to SQLite database')
    parser.add_argument('--eps', type=float, default=0.5, help='DBSCAN eps parameter')
    parser.add_argument('--min-samples', type=int, default=2, help='DBSCAN min_samples parameter')

    args = parser.parse_args()
    run_clustering(args.db_path, args.eps, args.min_samples)


if __name__ == '__main__':
    main()
