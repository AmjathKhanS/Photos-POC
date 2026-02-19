#!/usr/bin/env python3
"""
Memory Generator for Smart Memories
Generates memory collections based on date, people, and quality

Memory Types:
- On This Day: Photos from same date in previous years
- Weekly Highlights: Best photos from last week
- Monthly Highlights: Best photos from past month
- Seasonal Memories: Summer 2024, Winter 2023, etc.
- People Memories: Photos with specific person
"""

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from collections import Counter


class MemoryScorer:
    """Calculates importance scores for photos in memories"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    def close(self):
        """Close database connection"""
        self.conn.close()

    def get_quality_score(self, photo_filename: str) -> float:
        """Get quality score from photo_quality table (0-100)"""
        cursor = self.conn.cursor()
        result = cursor.execute(
            'SELECT quality_score FROM photo_quality WHERE photo_filename = ?',
            (photo_filename,)
        ).fetchone()

        if result:
            return float(result['quality_score'])
        return 50.0  # Default medium quality if not assessed

    def get_face_count(self, photo_filename: str) -> int:
        """Get number of faces in photo"""
        cursor = self.conn.cursor()
        result = cursor.execute(
            'SELECT COUNT(*) as count FROM faces WHERE photo_filename = ?',
            (photo_filename,)
        ).fetchone()

        return result['count'] if result else 0

    def get_person_ids(self, photo_filename: str) -> List[int]:
        """Get list of person IDs in photo"""
        cursor = self.conn.cursor()
        results = cursor.execute(
            'SELECT DISTINCT person_id FROM faces WHERE photo_filename = ? AND person_id IS NOT NULL',
            (photo_filename,)
        ).fetchall()

        return [row['person_id'] for row in results]

    def calculate_face_score(self, face_count: int) -> float:
        """
        Calculate face count score (0-100)

        Logic:
        - 0 faces: 0 points (landscape/object photos)
        - 1 face: 50 points (portrait)
        - 2 faces: 70 points (couple)
        - 3+ faces: 100 points (group photo - most memorable)
        """
        if face_count == 0:
            return 0.0
        elif face_count == 1:
            return 50.0
        elif face_count == 2:
            return 70.0
        else:
            return 100.0

    def calculate_person_importance_score(self, person_ids: List[int], all_person_frequencies: Dict[int, int]) -> float:
        """
        Calculate person importance score (0-100)

        Logic:
        - Photos with frequently-appearing people score higher
        - Unknown faces (no person_id) score lower (30 points)
        - Named persons score based on their frequency percentile
        """
        if not person_ids:
            return 30.0  # Unknown faces - lower importance

        # Get max frequency for normalization
        max_frequency = max(all_person_frequencies.values()) if all_person_frequencies else 1

        # Calculate average importance of all people in photo
        importance_scores = []
        for person_id in person_ids:
            frequency = all_person_frequencies.get(person_id, 1)
            # Normalize to 0-100 scale
            importance = (frequency / max_frequency) * 100.0
            importance_scores.append(importance)

        # Return average importance
        return sum(importance_scores) / len(importance_scores) if importance_scores else 30.0

    def calculate_temporal_diversity_score(self, photo_filename: str, photos_on_same_day: int, max_photos_per_day: int) -> float:
        """
        Calculate temporal diversity score (0-100)

        Logic:
        - Photos from dates with fewer photos score higher
        - Prevents over-representation of events with many photos (e.g., 100 photos from one wedding)
        - Formula: 100 - (photos_on_same_day / max_photos_per_day * 100)
        """
        if max_photos_per_day == 0:
            return 100.0

        diversity = 100.0 - (photos_on_same_day / max_photos_per_day * 100.0)
        return max(0.0, diversity)

    def calculate_memory_score(
        self,
        photo_filename: str,
        photos_per_day: Dict[str, int],
        max_photos_per_day: int,
        all_person_frequencies: Dict[int, int]
    ) -> float:
        """
        Calculate composite memory score (0-100)

        Formula:
        memory_score = (
            quality_score × 0.4 +
            face_count_score × 0.3 +
            person_importance × 0.2 +
            temporal_diversity × 0.1
        )

        Weights:
        - Quality: 40% (most important for memories)
        - Face count: 30% (people photos are memorable)
        - Person importance: 20% (frequent people matter more)
        - Temporal diversity: 10% (avoid event over-representation)
        """
        # Get quality score
        quality_score = self.get_quality_score(photo_filename)

        # Get face count and calculate score
        face_count = self.get_face_count(photo_filename)
        face_score = self.calculate_face_score(face_count)

        # Get person IDs and calculate importance
        person_ids = self.get_person_ids(photo_filename)
        person_importance = self.calculate_person_importance_score(person_ids, all_person_frequencies)

        # Get date and calculate temporal diversity
        cursor = self.conn.cursor()
        date_result = cursor.execute(
            'SELECT date(date_taken) as date_only FROM photo_metadata WHERE photo_filename = ?',
            (photo_filename,)
        ).fetchone()

        if date_result and date_result['date_only']:
            date_str = date_result['date_only']
            photos_on_day = photos_per_day.get(date_str, 1)
        else:
            photos_on_day = 1

        temporal_diversity = self.calculate_temporal_diversity_score(photo_filename, photos_on_day, max_photos_per_day)

        # Calculate composite score
        memory_score = (
            quality_score * 0.4 +
            face_score * 0.3 +
            person_importance * 0.2 +
            temporal_diversity * 0.1
        )

        return round(memory_score, 2)


class MemoryGenerator:
    """Generates memory collections"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.scorer = MemoryScorer(db_path)
        self.init_database()

    def close(self):
        """Close database connections"""
        self.scorer.close()
        self.conn.close()

    def init_database(self):
        """Create memories tables if they don't exist"""
        cursor = self.conn.cursor()

        # Create memories table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                memory_type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                date_start DATETIME,
                date_end DATETIME,
                person_id INTEGER,
                memory_date DATE NOT NULL,
                photo_count INTEGER DEFAULT 0,
                cover_photo_filename TEXT,
                generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_dismissed INTEGER DEFAULT 0,
                FOREIGN KEY (person_id) REFERENCES persons(id)
            )
        ''')

        # Create memory_photos junction table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS memory_photos (
                memory_id INTEGER NOT NULL,
                photo_filename TEXT NOT NULL,
                importance_score REAL NOT NULL,
                display_order INTEGER NOT NULL,
                PRIMARY KEY (memory_id, photo_filename),
                FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
            )
        ''')

        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_date ON memories(memory_date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_person ON memories(person_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_dismissed ON memories(is_dismissed)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memory_photos_memory ON memory_photos(memory_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memory_photos_score ON memory_photos(importance_score DESC)')

        self.conn.commit()

    def get_person_frequencies(self) -> Dict[int, int]:
        """Get frequency count for each person across all photos"""
        cursor = self.conn.cursor()
        results = cursor.execute('''
            SELECT person_id, COUNT(*) as frequency
            FROM faces
            WHERE person_id IS NOT NULL
            GROUP BY person_id
        ''').fetchall()

        return {row['person_id']: row['frequency'] for row in results}

    def get_photos_per_day(self, photo_filenames: List[str]) -> Tuple[Dict[str, int], int]:
        """Count photos per day for temporal diversity calculation"""
        cursor = self.conn.cursor()

        # Get date for each photo
        placeholders = ','.join('?' * len(photo_filenames))
        results = cursor.execute(f'''
            SELECT date(date_taken) as date_only, COUNT(*) as count
            FROM photo_metadata
            WHERE photo_filename IN ({placeholders})
            GROUP BY date_only
        ''', photo_filenames).fetchall()

        photos_per_day = {row['date_only']: row['count'] for row in results}
        max_photos_per_day = max(photos_per_day.values()) if photos_per_day else 1

        return photos_per_day, max_photos_per_day

    def select_best_photos(self, candidate_photos: List[str], max_count: int = 20) -> List[Tuple[str, float]]:
        """
        Select best photos from candidates based on memory score

        Returns: List of (filename, score) tuples, sorted by score descending
        """
        if not candidate_photos:
            return []

        # Get person frequencies for scoring
        person_frequencies = self.get_person_frequencies()

        # Get photos per day for temporal diversity
        photos_per_day, max_photos_per_day = self.get_photos_per_day(candidate_photos)

        # Calculate scores for all candidates
        photo_scores = []
        for photo in candidate_photos:
            score = self.scorer.calculate_memory_score(
                photo,
                photos_per_day,
                max_photos_per_day,
                person_frequencies
            )
            photo_scores.append((photo, score))

        # Sort by score descending and take top N
        photo_scores.sort(key=lambda x: x[1], reverse=True)
        return photo_scores[:max_count]

    def select_cover_photo(self, photo_scores: List[Tuple[str, float]]) -> Optional[str]:
        """Select best photo as cover (highest score)"""
        if not photo_scores:
            return None
        return photo_scores[0][0]  # First photo (highest score)

    def save_memory(self, memory_data: Dict, photo_scores: List[Tuple[str, float]]) -> int:
        """
        Save memory to database

        Returns: memory_id
        """
        cursor = self.conn.cursor()

        # Insert memory
        cursor.execute('''
            INSERT INTO memories
            (memory_type, title, description, date_start, date_end, person_id, memory_date, photo_count, cover_photo_filename)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            memory_data['memory_type'],
            memory_data['title'],
            memory_data.get('description'),
            memory_data.get('date_start'),
            memory_data.get('date_end'),
            memory_data.get('person_id'),
            memory_data['memory_date'],
            len(photo_scores),
            memory_data.get('cover_photo')
        ))

        memory_id = cursor.lastrowid

        # Insert memory_photos
        for i, (filename, score) in enumerate(photo_scores):
            cursor.execute('''
                INSERT INTO memory_photos
                (memory_id, photo_filename, importance_score, display_order)
                VALUES (?, ?, ?, ?)
            ''', (memory_id, filename, score, i + 1))

        self.conn.commit()
        return memory_id

    def generate_on_this_day_memory(self, target_date: datetime) -> Optional[Dict]:
        """
        Generate "On This Day" memory for a specific date

        Finds photos from same month/day in previous years (excluding current year)
        Minimum 3 photos required, maximum 20 best photos selected
        """
        cursor = self.conn.cursor()

        # Find photos from same month/day, different year
        results = cursor.execute('''
            SELECT photo_filename
            FROM photo_metadata
            WHERE date_taken_month = ?
              AND date_taken_day = ?
              AND date_taken_year < ?
        ''', (target_date.month, target_date.day, target_date.year)).fetchall()

        candidate_photos = [row['photo_filename'] for row in results]

        if len(candidate_photos) < 3:
            return None  # Not enough photos for memory

        # Select best photos
        photo_scores = self.select_best_photos(candidate_photos, max_count=20)
        cover_photo = self.select_cover_photo(photo_scores)

        # Determine year range
        cursor.execute('''
            SELECT MIN(date_taken_year) as min_year, MAX(date_taken_year) as max_year
            FROM photo_metadata
            WHERE photo_filename IN ({})
        '''.format(','.join('?' * len(candidate_photos))), candidate_photos).fetchone()

        min_year = cursor.fetchone()['min_year'] if cursor.rowcount > 0 else target_date.year - 1
        years_ago = target_date.year - min_year

        # Create memory data
        memory_data = {
            'memory_type': 'on_this_day',
            'title': f'On This Day - {target_date.strftime("%B %d")}',
            'description': f'{len(photo_scores)} photos from {years_ago} {"year" if years_ago == 1 else "years"} ago',
            'memory_date': target_date.strftime('%Y-%m-%d'),
            'cover_photo': cover_photo
        }

        # Save memory
        memory_id = self.save_memory(memory_data, photo_scores)

        return {
            'memory_id': memory_id,
            'type': 'on_this_day',
            'photo_count': len(photo_scores),
            'title': memory_data['title']
        }

    def generate_daily_memories(self) -> List[Dict]:
        """Generate "On This Day" memories for today"""
        today = datetime.now()
        result = self.generate_on_this_day_memory(today)
        return [result] if result else []

    def generate_weekly_highlights(self) -> Optional[Dict]:
        """
        Generate "Weekly Highlights" memory

        Finds best photos from the past 7 days
        Minimum 5 photos required, maximum 20 best photos selected
        """
        cursor = self.conn.cursor()

        # Get photos from last 7 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)

        results = cursor.execute('''
            SELECT photo_filename
            FROM photo_metadata
            WHERE date_taken >= ? AND date_taken <= ?
            ORDER BY date_taken DESC
        ''', (start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))).fetchall()

        candidate_photos = [row['photo_filename'] for row in results]

        if len(candidate_photos) < 5:
            return None  # Not enough photos

        # Select best photos
        photo_scores = self.select_best_photos(candidate_photos, max_count=20)
        cover_photo = self.select_cover_photo(photo_scores)

        # Create memory data
        memory_data = {
            'memory_type': 'weekly',
            'title': f'This Week\'s Highlights',
            'description': f'{len(photo_scores)} highlights from the past week',
            'date_start': start_date.strftime('%Y-%m-%d'),
            'date_end': end_date.strftime('%Y-%m-%d'),
            'memory_date': end_date.strftime('%Y-%m-%d'),
            'cover_photo': cover_photo
        }

        # Save memory
        memory_id = self.save_memory(memory_data, photo_scores)

        return {
            'memory_id': memory_id,
            'type': 'weekly',
            'photo_count': len(photo_scores),
            'title': memory_data['title']
        }

    def generate_monthly_highlights(self) -> Optional[Dict]:
        """
        Generate "Monthly Highlights" memory

        Finds best photos from the past 30 days
        Minimum 10 photos required, maximum 30 best photos selected
        """
        cursor = self.conn.cursor()

        # Get photos from last 30 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)

        results = cursor.execute('''
            SELECT photo_filename
            FROM photo_metadata
            WHERE date_taken >= ? AND date_taken <= ?
            ORDER BY date_taken DESC
        ''', (start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))).fetchall()

        candidate_photos = [row['photo_filename'] for row in results]

        if len(candidate_photos) < 10:
            return None  # Not enough photos

        # Select best photos
        photo_scores = self.select_best_photos(candidate_photos, max_count=30)
        cover_photo = self.select_cover_photo(photo_scores)

        # Create memory data
        memory_data = {
            'memory_type': 'monthly',
            'title': f'{end_date.strftime("%B %Y")} Highlights',
            'description': f'{len(photo_scores)} highlights from this month',
            'date_start': start_date.strftime('%Y-%m-%d'),
            'date_end': end_date.strftime('%Y-%m-%d'),
            'memory_date': end_date.strftime('%Y-%m-%d'),
            'cover_photo': cover_photo
        }

        # Save memory
        memory_id = self.save_memory(memory_data, photo_scores)

        return {
            'memory_id': memory_id,
            'type': 'monthly',
            'photo_count': len(photo_scores),
            'title': memory_data['title']
        }

    def generate_seasonal_memories(self) -> List[Dict]:
        """
        Generate seasonal memories (Summer, Winter, etc.)

        Finds best photos from the current season
        """
        cursor = self.conn.cursor()
        today = datetime.now()

        # Determine current season
        month = today.month
        if month in [3, 4, 5]:
            season = 'Spring'
            months = [3, 4, 5]
        elif month in [6, 7, 8]:
            season = 'Summer'
            months = [6, 7, 8]
        elif month in [9, 10, 11]:
            season = 'Fall'
            months = [9, 10, 11]
        else:
            season = 'Winter'
            months = [12, 1, 2]

        # Get photos from current season
        results = cursor.execute('''
            SELECT photo_filename
            FROM photo_metadata
            WHERE date_taken_year = ? AND date_taken_month IN ({})
            ORDER BY date_taken DESC
        '''.format(','.join('?' * len(months))), [today.year] + months).fetchall()

        candidate_photos = [row['photo_filename'] for row in results]

        if len(candidate_photos) < 10:
            return []  # Not enough photos

        # Select best photos
        photo_scores = self.select_best_photos(candidate_photos, max_count=25)
        cover_photo = self.select_cover_photo(photo_scores)

        # Create memory data
        memory_data = {
            'memory_type': 'seasonal',
            'title': f'{season} {today.year}',
            'description': f'{len(photo_scores)} photos from {season.lower()}',
            'memory_date': today.strftime('%Y-%m-%d'),
            'cover_photo': cover_photo
        }

        # Save memory
        memory_id = self.save_memory(memory_data, photo_scores)

        return [{
            'memory_id': memory_id,
            'type': 'seasonal',
            'photo_count': len(photo_scores),
            'title': memory_data['title']
        }]

    def run(self, action: str) -> Dict:
        """Run memory generation action"""
        try:
            if action == 'daily':
                memories = self.generate_daily_memories()
                return {
                    'status': 'completed',
                    'action': action,
                    'memories_created': len(memories),
                    'memories': memories
                }
            elif action == 'weekly':
                result = self.generate_weekly_highlights()
                memories = [result] if result else []
                return {
                    'status': 'completed',
                    'action': action,
                    'memories_created': len(memories),
                    'memories': memories
                }
            elif action == 'monthly':
                result = self.generate_monthly_highlights()
                memories = [result] if result else []
                return {
                    'status': 'completed',
                    'action': action,
                    'memories_created': len(memories),
                    'memories': memories
                }
            elif action == 'seasonal':
                memories = self.generate_seasonal_memories()
                return {
                    'status': 'completed',
                    'action': action,
                    'memories_created': len(memories),
                    'memories': memories
                }
            else:
                return {
                    'status': 'error',
                    'message': f'Unknown action: {action}'
                }

        except Exception as e:
            return {
                'status': 'error',
                'message': str(e)
            }


def main():
    parser = argparse.ArgumentParser(description='Generate Smart Memories')
    parser.add_argument('--db-path', required=True, help='Path to SQLite database')
    parser.add_argument('--action', required=True, choices=['daily', 'weekly', 'monthly', 'seasonal', 'people'],
                        help='Memory generation action')
    parser.add_argument('--person-id', type=int, help='Person ID (for people-based memories)')

    args = parser.parse_args()

    generator = MemoryGenerator(args.db_path)

    try:
        result = generator.run(args.action)
        print(json.dumps(result), flush=True)
    finally:
        generator.close()


if __name__ == '__main__':
    main()
