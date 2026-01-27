#!/usr/bin/env python3
"""
Person Duplicate Detection Service
Finds potential duplicate persons using face embedding similarity
"""

import json
import sys
import sqlite3
import numpy as np
import argparse
from typing import List, Dict, Tuple


def load_person_centroids(db_path: str) -> Dict[int, Dict]:
    """
    Load all persons and calculate their centroid embeddings
    Returns: {person_id: {name, face_count, centroid}}
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get all persons
    cursor.execute("SELECT id, name FROM persons ORDER BY id")
    persons = cursor.fetchall()

    person_data = {}

    for person_id, person_name in persons:
        # Get all face embeddings for this person
        cursor.execute("""
            SELECT id, encoding FROM faces
            WHERE person_id = ? AND encoding IS NOT NULL
        """, (person_id,))

        face_rows = cursor.fetchall()

        if not face_rows:
            continue

        # Convert binary encodings to numpy arrays
        encodings = []
        representative_face_id = None
        for face_id, encoding_blob in face_rows:
            # Store first face ID as representative
            if representative_face_id is None:
                representative_face_id = face_id

            # Each encoding is 512 float32 values = 2048 bytes
            encoding = np.frombuffer(encoding_blob, dtype=np.float32)
            if encoding.shape[0] == 512:
                encodings.append(encoding)

        if not encodings:
            continue

        # Calculate centroid (average embedding)
        encodings_matrix = np.array(encodings)
        centroid = np.mean(encodings_matrix, axis=0)

        # Normalize centroid for cosine similarity
        centroid_norm = centroid / np.linalg.norm(centroid)

        person_data[person_id] = {
            'name': person_name,
            'face_count': len(encodings),
            'centroid': centroid_norm,
            'representative_face_id': representative_face_id
        }

    conn.close()
    return person_data


def calculate_similarity(centroid1: np.ndarray, centroid2: np.ndarray) -> float:
    """
    Calculate cosine similarity between two normalized centroids
    Returns value between 0 and 1 (1 = identical)
    """
    return float(np.dot(centroid1, centroid2))


def find_duplicate_persons(db_path: str, threshold: float = 0.85) -> List[Dict]:
    """
    Find potential duplicate persons based on centroid similarity
    """
    print(f"Loading persons and calculating centroids...", file=sys.stderr)
    person_data = load_person_centroids(db_path)

    person_ids = list(person_data.keys())
    total_persons = len(person_ids)

    print(f"Analyzing {total_persons} persons for duplicates...", file=sys.stderr)

    duplicates = []

    # Compare all pairs
    for i in range(len(person_ids)):
        for j in range(i + 1, len(person_ids)):
            person1_id = person_ids[i]
            person2_id = person_ids[j]

            person1 = person_data[person1_id]
            person2 = person_data[person2_id]

            # Calculate similarity
            similarity = calculate_similarity(person1['centroid'], person2['centroid'])

            if similarity >= threshold:
                duplicates.append({
                    'person1_id': person1_id,
                    'person1_name': person1['name'],
                    'person1_face_count': person1['face_count'],
                    'person1_representative_face_id': person1['representative_face_id'],
                    'person2_id': person2_id,
                    'person2_name': person2['name'],
                    'person2_face_count': person2['face_count'],
                    'person2_representative_face_id': person2['representative_face_id'],
                    'similarity': round(similarity, 4)
                })

    # Sort by similarity (highest first)
    duplicates.sort(key=lambda x: x['similarity'], reverse=True)

    print(f"Found {len(duplicates)} potential duplicate pairs", file=sys.stderr)

    return duplicates


def main():
    parser = argparse.ArgumentParser(description='Person Duplicate Detection')
    parser.add_argument('--db-path', required=True, help='Path to SQLite database')
    parser.add_argument('--threshold', type=float, default=0.85,
                        help='Similarity threshold (0.0-1.0). Default: 0.85')

    args = parser.parse_args()

    # Validate threshold
    if not 0.0 <= args.threshold <= 1.0:
        print(json.dumps({'error': 'Threshold must be between 0.0 and 1.0'}))
        sys.exit(1)

    try:
        duplicates = find_duplicate_persons(args.db_path, args.threshold)

        # Output JSON to stdout
        result = {
            'duplicates': duplicates,
            'threshold': args.threshold,
            'total_pairs': len(duplicates)
        }

        print(json.dumps(result))
        sys.stdout.flush()

    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
