#!/usr/bin/env python3
"""
Document Intelligence Service
Automatically classifies documents and extracts structured data from photos
"""

import sys
import json
import argparse
import sqlite3
import re
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DocumentIntelligenceService:
    """Service for document classification and entity extraction"""

    def __init__(self, db_path: str):
        """Initialize with database path"""
        self.db_path = db_path
        logger.info(f"Initialized DocumentIntelligenceService with DB: {db_path}")

        # Document type keywords
        self.document_keywords = {
            'medical': ['medical', 'hospital', 'clinic', 'doctor', 'prescription', 'pharmacy',
                       'patient', 'diagnosis', 'treatment', 'medicine', 'health', 'surgery'],
            'financial': ['bank', 'account', 'balance', 'statement', 'transaction', 'credit',
                         'debit', 'loan', 'investment', 'stock', 'portfolio'],
            'receipt': ['receipt', 'purchase', 'paid', 'total', 'subtotal', 'tax', 'qty',
                       'quantity', 'item', 'price', 'cashier', 'thank you for', 'store'],
            'legal': ['contract', 'agreement', 'legal', 'court', 'law', 'attorney', 'lawyer',
                     'plaintiff', 'defendant', 'hereby', 'jurisdiction', 'clause'],
            'id_card': ['identity', 'id card', 'driver', 'license', 'identification', 'cardholder',
                       'date of birth', 'dob', 'expires', 'issued'],
            'passport': ['passport', 'travel document', 'nationality', 'place of birth',
                        'authority', 'embassy', 'consulate'],
            'insurance': ['insurance', 'policy', 'premium', 'coverage', 'claim', 'insured',
                         'beneficiary', 'policyholder', 'deductible'],
            'tax': ['tax', 'return', 'irs', 'w-2', 'w-4', '1099', 'deduction', 'refund',
                   'filing', 'fiscal year', 'taxable'],
            'education': ['certificate', 'diploma', 'degree', 'university', 'college', 'school',
                         'transcript', 'grade', 'course', 'student', 'awarded'],
            'utility': ['utility', 'electric', 'water', 'gas', 'internet', 'phone', 'bill',
                       'service', 'usage', 'meter'],
        }

    def load_photo_with_ocr(self, photo_filename: str) -> Optional[Dict]:
        """Load photo metadata and OCR text"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                pm.photo_filename,
                pm.date_taken,
                ocr.extracted_text,
                vt.tags as visual_tags
            FROM photo_metadata pm
            LEFT JOIN photo_ocr_text ocr ON pm.photo_filename = ocr.photo_filename
            LEFT JOIN photo_visual_tags vt ON pm.photo_filename = vt.photo_filename
            WHERE pm.photo_filename = ?
        """, (photo_filename,))

        row = cursor.fetchone()
        conn.close()

        if row and row['extracted_text']:
            return {
                'filename': row['photo_filename'],
                'date_taken': row['date_taken'],
                'ocr_text': row['extracted_text'],
                'ocr_tags': json.loads(row['visual_tags']) if row['visual_tags'] else []
            }
        return None

    def classify_document(self, ocr_text: str, ocr_tags: List[str]) -> Tuple[str, str, float]:
        """
        Classify document type based on OCR text and tags

        Returns:
            Tuple of (document_type, document_subtype, confidence)
        """
        text_lower = ocr_text.lower()

        # Score each document type
        scores = {}
        for doc_type, keywords in self.document_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            if score > 0:
                scores[doc_type] = score

        # Also check OCR tags
        for tag in ocr_tags:
            tag_lower = tag.lower()
            for doc_type, keywords in self.document_keywords.items():
                if any(keyword in tag_lower for keyword in keywords):
                    scores[doc_type] = scores.get(doc_type, 0) + 0.5

        if not scores:
            return ('other', None, 0.3)

        # Get highest scoring type
        best_type = max(scores, key=scores.get)
        max_score = scores[best_type]

        # Calculate confidence
        total_keywords = len(self.document_keywords[best_type])
        confidence = min(max_score / total_keywords, 1.0)

        # Determine subtype for specific categories
        subtype = self._determine_subtype(best_type, text_lower)

        return (best_type, subtype, confidence)

    def _determine_subtype(self, doc_type: str, text_lower: str) -> Optional[str]:
        """Determine document subtype based on specific keywords"""
        subtypes = {
            'medical': {
                'prescription': ['prescription', 'rx', 'dosage', 'medication'],
                'lab_report': ['lab', 'test result', 'analysis', 'specimen'],
                'invoice': ['invoice', 'bill', 'amount due', 'payment'],
            },
            'financial': {
                'bank_statement': ['statement', 'beginning balance', 'ending balance'],
                'credit_card': ['credit card', 'available credit', 'minimum payment'],
                'invoice': ['invoice', 'amount due', 'bill to'],
            },
            'receipt': {
                'store': ['store', 'retail', 'shop'],
                'restaurant': ['restaurant', 'food', 'dining'],
                'online': ['order', 'tracking', 'shipping'],
            }
        }

        if doc_type in subtypes:
            for subtype, keywords in subtypes[doc_type].items():
                if any(keyword in text_lower for keyword in keywords):
                    return subtype

        return None

    def extract_dates(self, text: str) -> List[str]:
        """Extract dates from text in various formats"""
        dates = []

        # Common date patterns
        patterns = [
            r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',  # MM/DD/YYYY, DD-MM-YYYY
            r'\d{4}[/-]\d{1,2}[/-]\d{1,2}',    # YYYY-MM-DD
            r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}',  # Month DD, YYYY
            r'\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}',  # DD Month YYYY
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            dates.extend(matches)

        # Try to parse and normalize dates to ISO format
        normalized_dates = []
        for date_str in dates:
            try:
                # Try multiple date parsing formats
                for fmt in ['%m/%d/%Y', '%d-%m-%Y', '%Y-%m-%d', '%b %d, %Y', '%d %b %Y']:
                    try:
                        dt = datetime.strptime(date_str, fmt)
                        normalized_dates.append(dt.isoformat())
                        break
                    except ValueError:
                        continue
            except Exception:
                pass

        return normalized_dates

    def extract_amounts(self, text: str) -> List[Tuple[float, str]]:
        """Extract monetary amounts with currency"""
        amounts = []

        # Patterns for currency amounts
        patterns = [
            (r'\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)', 'USD'),  # $1,234.56
            (r'(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|dollars?)', 'USD'),
            (r'€\s*(\d+(?:,\d{3})*(?:\.\d{2})?)', 'EUR'),  # €1,234.56
            (r'£\s*(\d+(?:,\d{3})*(?:\.\d{2})?)', 'GBP'),  # £1,234.56
            (r'₹\s*(\d+(?:,\d{3})*(?:\.\d{2})?)', 'INR'),  # ₹1,234.56
        ]

        for pattern, currency in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    # Remove commas and convert to float
                    amount = float(match.replace(',', ''))
                    amounts.append((amount, currency))
                except ValueError:
                    pass

        return amounts

    def extract_names(self, text: str) -> List[str]:
        """Extract potential person names (simple pattern matching)"""
        names = []

        # Look for capitalized words that might be names
        # Pattern: Title Case words (2-4 consecutive capitalized words)
        pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b'
        matches = re.findall(pattern, text)

        # Filter out common non-name words
        stop_words = {'Date', 'Total', 'Amount', 'Name', 'Address', 'City', 'State',
                     'Phone', 'Email', 'Number', 'Street', 'Account', 'Card'}

        for match in matches:
            if not any(word in match for word in stop_words):
                names.append(match)

        return list(set(names))[:5]  # Return up to 5 unique names

    def extract_document_number(self, text: str, doc_type: str) -> Optional[str]:
        """Extract document-specific numbers"""
        patterns = {
            'invoice': r'(?:invoice|inv)[#\s:]+([A-Z0-9-]+)',
            'account': r'(?:account|acct)[#\s:]+([A-Z0-9-]+)',
            'policy': r'(?:policy|pol)[#\s:]+([A-Z0-9-]+)',
            'receipt': r'(?:receipt|rcpt)[#\s:]+([A-Z0-9-]+)',
            'id': r'(?:id|number)[#\s:]+([A-Z0-9-]+)',
        }

        text_lower = text.lower()
        for key, pattern in patterns.items():
            if key in doc_type.lower():
                match = re.search(pattern, text_lower, re.IGNORECASE)
                if match:
                    return match.group(1).upper()

        return None

    def extract_expiry_date(self, text: str) -> Optional[str]:
        """Extract expiry/expiration date"""
        # Look for expiry-related text
        expiry_patterns = [
            r'(?:expir|valid|expires?|exp)[a-z]*[:\s]+([0-9/-]+)',
            r'(?:valid until|good through)[:\s]+([0-9/-]+)',
        ]

        for pattern in expiry_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                date_str = match.group(1)
                # Try to parse and normalize
                dates = self.extract_dates(date_str)
                if dates:
                    return dates[0]

        return None

    def calculate_importance(self, doc_type: str, amount: Optional[float],
                           has_expiry: bool, text_length: int) -> float:
        """Calculate document importance score (0-1)"""
        score = 0.5  # Base score

        # Type importance
        type_weights = {
            'legal': 0.3,
            'tax': 0.3,
            'id_card': 0.25,
            'passport': 0.25,
            'insurance': 0.2,
            'medical': 0.15,
            'financial': 0.15,
        }
        score += type_weights.get(doc_type, 0.0)

        # Amount importance
        if amount:
            if amount > 1000:
                score += 0.15
            elif amount > 500:
                score += 0.1
            elif amount > 100:
                score += 0.05

        # Expiry date importance
        if has_expiry:
            score += 0.1

        # Text length (more text = more important)
        if text_length > 500:
            score += 0.05

        return min(score, 1.0)

    def process_document(self, photo_filename: str) -> Optional[Dict]:
        """Process a single document photo"""
        logger.info(f"Processing document: {photo_filename}")

        # Load photo with OCR
        photo_data = self.load_photo_with_ocr(photo_filename)
        if not photo_data:
            logger.warning(f"No OCR data found for {photo_filename}")
            return None

        ocr_text = photo_data['ocr_text']
        ocr_tags = photo_data['ocr_tags']

        # Classify document
        doc_type, doc_subtype, confidence = self.classify_document(ocr_text, ocr_tags)
        logger.info(f"Classified as {doc_type} (subtype: {doc_subtype}, confidence: {confidence:.2f})")

        # Extract entities
        dates = self.extract_dates(ocr_text)
        amounts = self.extract_amounts(ocr_text)
        names = self.extract_names(ocr_text)
        doc_number = self.extract_document_number(ocr_text, doc_type)
        expiry_date = self.extract_expiry_date(ocr_text)

        # Get primary date and amount
        primary_date = dates[0] if dates else photo_data.get('date_taken')
        primary_amount = amounts[0][0] if amounts else None
        primary_currency = amounts[0][1] if amounts else None

        # Calculate importance
        importance = self.calculate_importance(
            doc_type,
            primary_amount,
            expiry_date is not None,
            len(ocr_text)
        )

        # Build result
        result = {
            'photo_filename': photo_filename,
            'document_type': doc_type,
            'document_subtype': doc_subtype,
            'confidence': confidence,
            'extracted_text': ocr_text,
            'extracted_date': primary_date,
            'extracted_amount': primary_amount,
            'extracted_currency': primary_currency,
            'extracted_names': json.dumps(names),
            'extracted_entities': json.dumps({
                'dates': dates,
                'amounts': amounts,
                'names': names,
                'document_number': doc_number,
            }),
            'document_number': doc_number,
            'expiry_date': expiry_date,
            'importance_score': importance,
            'searchable_text': f"{doc_type} {doc_subtype or ''} {' '.join(names)} {ocr_text}".lower(),
        }

        return result

    def save_document_metadata(self, metadata: Dict) -> bool:
        """Save document metadata to database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                INSERT OR REPLACE INTO document_metadata (
                    photo_filename, document_type, document_subtype, confidence,
                    extracted_text, extracted_date, extracted_amount, extracted_currency,
                    extracted_names, extracted_entities, document_number, expiry_date,
                    importance_score, searchable_text, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                metadata['photo_filename'],
                metadata['document_type'],
                metadata['document_subtype'],
                metadata['confidence'],
                metadata['extracted_text'],
                metadata['extracted_date'],
                metadata['extracted_amount'],
                metadata['extracted_currency'],
                metadata['extracted_names'],
                metadata['extracted_entities'],
                metadata['document_number'],
                metadata['expiry_date'],
                metadata['importance_score'],
                metadata['searchable_text'],
            ))

            # Update FTS index
            cursor.execute("""
                INSERT OR REPLACE INTO document_search_fts (
                    photo_filename, document_type, extracted_text, extracted_entities
                ) VALUES (?, ?, ?, ?)
            """, (
                metadata['photo_filename'],
                metadata['document_type'],
                metadata['extracted_text'],
                metadata['extracted_entities'],
            ))

            # Check for alerts (expiring soon, high amounts)
            self._create_alerts(cursor, metadata)

            conn.commit()
            conn.close()

            logger.info(f"Saved metadata for {metadata['photo_filename']}")
            return True

        except Exception as e:
            logger.error(f"Failed to save metadata: {e}")
            return False

    def _create_alerts(self, cursor, metadata: Dict):
        """Create alerts for important documents"""
        photo_filename = metadata['photo_filename']

        # Clear old alerts
        cursor.execute("DELETE FROM document_alerts WHERE photo_filename = ?", (photo_filename,))

        # Expiry alert
        if metadata['expiry_date']:
            try:
                expiry = datetime.fromisoformat(metadata['expiry_date'])
                now = datetime.now()
                days_until_expiry = (expiry - now).days

                if days_until_expiry < 0:
                    cursor.execute("""
                        INSERT INTO document_alerts (photo_filename, alert_type, alert_message)
                        VALUES (?, 'expired', ?)
                    """, (photo_filename, f"Document expired {abs(days_until_expiry)} days ago"))
                elif days_until_expiry <= 30:
                    cursor.execute("""
                        INSERT INTO document_alerts (photo_filename, alert_type, alert_message)
                        VALUES (?, 'expiring_soon', ?)
                    """, (photo_filename, f"Document expires in {days_until_expiry} days"))
            except Exception:
                pass

        # High amount alert
        if metadata['extracted_amount'] and metadata['extracted_amount'] > 1000:
            cursor.execute("""
                INSERT INTO document_alerts (photo_filename, alert_type, alert_message)
                VALUES (?, 'high_amount', ?)
            """, (photo_filename, f"High amount: {metadata['extracted_currency']} {metadata['extracted_amount']:.2f}"))

    def process_all_documents(self) -> Dict:
        """Process all photos with OCR text as documents"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get all photos with OCR text
        cursor.execute("""
            SELECT ocr.photo_filename
            FROM photo_ocr_text ocr
            WHERE ocr.extracted_text IS NOT NULL AND ocr.extracted_text != ''
        """)

        photo_filenames = [row[0] for row in cursor.fetchall()]
        conn.close()

        logger.info(f"Found {len(photo_filenames)} photos with OCR text")

        processed = 0
        failed = 0

        for filename in photo_filenames:
            try:
                metadata = self.process_document(filename)
                if metadata:
                    if self.save_document_metadata(metadata):
                        processed += 1
                    else:
                        failed += 1
                else:
                    failed += 1
            except Exception as e:
                logger.error(f"Error processing {filename}: {e}")
                failed += 1

        return {
            'success': True,
            'total': len(photo_filenames),
            'processed': processed,
            'failed': failed,
        }


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description="Document Intelligence Service")
    parser.add_argument("--db-path", type=str, required=True, help="Path to SQLite database")
    parser.add_argument("--action", type=str, default="process-all",
                       choices=["process-all", "process-one"],
                       help="Action to perform")
    parser.add_argument("--filename", type=str, help="Photo filename (for process-one)")

    args = parser.parse_args()

    try:
        service = DocumentIntelligenceService(args.db_path)

        if args.action == "process-all":
            result = service.process_all_documents()
            print(json.dumps(result, indent=2))
        elif args.action == "process-one":
            if not args.filename:
                raise ValueError("--filename required for process-one action")
            metadata = service.process_document(args.filename)
            if metadata:
                service.save_document_metadata(metadata)
                print(json.dumps({'success': True, 'metadata': metadata}, indent=2))
            else:
                print(json.dumps({'success': False, 'error': 'Failed to process document'}))

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
