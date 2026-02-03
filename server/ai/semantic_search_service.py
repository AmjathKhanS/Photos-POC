#!/usr/bin/env python3
"""
Semantic Search Service
Main entry point for AI-powered photo search
Provides CLI interface for Node.js backend integration
"""

import sys
import json
import argparse
import time
import logging
from pathlib import Path
from typing import Dict, List, Optional

# Import model wrappers
from models.clip_model import get_clip_model
from models.ocr_model import get_ocr_model
from utils.embeddings import get_text_embedder, embedding_to_bytes

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SemanticSearchService:
    """Main service orchestrating all AI models"""

    def __init__(self):
        """Initialize all models (lazy loading)"""
        self._clip_model = None
        self._ocr_model = None
        self._text_embedder = None
        logger.info("Semantic Search Service initialized")

    def detect_screenshot(self, ocr_text: str, num_blocks: int, confidence: float, filename: str) -> bool:
        """
        Detect if a photo is likely a screenshot based on OCR analysis

        Args:
            ocr_text: Extracted OCR text
            num_blocks: Number of text blocks found
            confidence: Average OCR confidence
            filename: Photo filename

        Returns:
            True if likely a screenshot, False otherwise
        """
        score = 0

        # Signal 1: High text block count (screenshots have lots of UI text)
        if num_blocks > 15:
            score += 3
        elif num_blocks > 8:
            score += 1

        # Signal 2: Check for UI/web keywords in OCR text
        ui_indicators = [
            'http', 'https', 'www', '.com', '.org', '.net',
            'button', 'menu', 'file', 'edit', 'view', 'settings',
            'chrome', 'firefox', 'safari', 'search', 'google',
            '@gmail', '@yahoo', '@hotmail', 'email', 'password',
            'login', 'sign in', 'submit', 'cancel', 'ok', 'close',
            'window', 'tab', 'browser', 'download', 'upload',
            'notifications', 'settings', 'preferences', 'options'
        ]

        ocr_lower = ocr_text.lower()
        keyword_matches = sum(1 for kw in ui_indicators if kw in ocr_lower)
        score += min(keyword_matches, 3)  # Max 3 points from keywords

        # Signal 3: High confidence text (UI text is usually very clean)
        if confidence and confidence > 0.85:
            score += 2
        elif confidence and confidence > 0.70:
            score += 1

        # Signal 4: PNG format (common for screenshots)
        if filename.lower().endswith('.png'):
            score += 1

        # Threshold: 4+ points = likely screenshot
        is_screenshot = score >= 4

        logger.info(f"Screenshot detection for {filename}: score={score}, is_screenshot={is_screenshot}")
        return is_screenshot

    @property
    def clip_model(self):
        """Lazy load CLIP model"""
        if self._clip_model is None:
            logger.info("Loading CLIP model...")
            self._clip_model = get_clip_model()
        return self._clip_model

    @property
    def ocr_model(self):
        """Lazy load OCR model"""
        if self._ocr_model is None:
            logger.info("Loading OCR model...")
            self._ocr_model = get_ocr_model()
        return self._ocr_model

    @property
    def text_embedder(self):
        """Lazy load text embedder"""
        if self._text_embedder is None:
            logger.info("Loading text embedder...")
            self._text_embedder = get_text_embedder()
        return self._text_embedder

    def index_photo(self, photo_path: str) -> Dict:
        """
        Index a single photo: extract text, generate embeddings, and tags

        Args:
            photo_path: Path to the photo file

        Returns:
            Dictionary with indexing results
        """
        start_time = time.time()
        result = {
            "success": False,
            "photo_path": photo_path,
            "ocr_text": "",
            "clip_embedding": None,
            "text_embedding": None,
            "visual_tags": [],
            "processing_time_ms": 0,
            "error": None
        }

        try:
            # Check if file exists
            if not Path(photo_path).exists():
                raise FileNotFoundError(f"Photo not found: {photo_path}")

            # 1. Extract text using OCR
            logger.info(f"Extracting text from {photo_path}")
            ocr_stats = self.ocr_model.get_text_statistics(photo_path, min_confidence=0.3)
            result["ocr_text"] = ocr_stats["full_text"]
            result["ocr_num_blocks"] = ocr_stats["num_blocks"]
            result["ocr_confidence"] = ocr_stats["avg_confidence"]

            # 2. Generate CLIP embedding for visual content
            logger.info(f"Generating CLIP embedding for {photo_path}")
            clip_embedding = self.clip_model.encode_image(photo_path)
            result["clip_embedding"] = embedding_to_bytes(clip_embedding).hex()
            result["clip_embedding_size"] = len(clip_embedding)

            # 3. Generate text embedding if OCR text exists
            if result["ocr_text"].strip():
                logger.info(f"Generating text embedding for OCR content")
                text_embedding = self.text_embedder.encode(result["ocr_text"])
                result["text_embedding"] = embedding_to_bytes(text_embedding).hex()
                result["text_embedding_size"] = len(text_embedding)

            # 4. Detect if this is a screenshot
            logger.info(f"Analyzing screenshot characteristics for {photo_path}")
            filename = Path(photo_path).name
            result["is_screenshot"] = self.detect_screenshot(
                result["ocr_text"],
                result["ocr_num_blocks"],
                result.get("ocr_confidence", 0),
                filename
            )

            # 5. Generate visual tags using CLIP
            logger.info(f"Generating visual tags for {photo_path}")
            candidate_tags = [
                # Documents
                "document", "certificate", "receipt", "bill", "prescription", "invoice",
                "letter", "contract", "form", "application", "report", "statement",

                # Medical & Healthcare
                "medical prescription", "prescription", "medical document", "medical report",
                "lab report", "test results", "medical certificate", "doctor note",
                "pharmacy slip", "medicine label", "hospital document", "health record",
                "x-ray", "scan", "medical imaging", "diagnosis", "prescription pad",

                # Visual content types
                "photo", "portrait", "landscape", "indoor", "outdoor", "selfie",
                "group photo", "family photo", "professional photo",

                # Text types
                "text", "handwriting", "printed text", "diagram", "chart", "table",
                "handwritten note", "typed document", "form with text",

                # People & Demographics
                "person", "people", "child", "kid", "boy", "girl", "man", "woman",
                "baby", "toddler", "teenager", "adult", "elderly",
                "person standing", "person sitting", "person walking", "person smiling",
                "couple", "family", "friends", "crowd", "team",

                # Clothing & Fashion
                "shirt", "t-shirt", "tshirt", "dress", "jacket", "coat", "sweater",
                "pants", "jeans", "shorts", "skirt", "suit", "uniform",
                "hat", "cap", "glasses", "sunglasses",
                "casual wear", "formal wear", "sportswear",

                # Colors
                "red", "blue", "green", "yellow", "orange", "purple", "pink",
                "black", "white", "gray", "brown", "colorful", "bright colors",

                # Common Objects
                "car", "bike", "bicycle", "phone", "mobile phone", "laptop", "camera",
                "book", "bag", "backpack", "bottle", "cup", "plate",
                "furniture", "chair", "table",

                # Scenes & Locations
                "street", "road", "park", "garden", "restaurant", "office", "home",
                "bedroom", "kitchen", "sunset", "sunrise", "night scene",

                # General categories
                "food", "animal", "vehicle", "building", "product",
                "nature", "city", "beach", "mountain", "forest", "sky", "water",

                # Context tags
                "medical", "business", "education", "personal", "official", "legal",
                "financial", "government", "insurance", "banking", "healthcare"
            ]
            tags = self.clip_model.generate_tags(photo_path, candidate_tags, threshold=0.25)
            result["visual_tags"] = [{"tag": tag, "confidence": conf} for tag, conf in tags[:15]]

            result["success"] = True
            logger.info(f"Successfully indexed {photo_path}")

        except Exception as e:
            logger.error(f"Failed to index photo {photo_path}: {e}")
            result["error"] = str(e)

        result["processing_time_ms"] = int((time.time() - start_time) * 1000)
        return result

    def encode_query(self, query: str) -> Dict:
        """
        Encode a search query into embeddings

        Args:
            query: Natural language search query

        Returns:
            Dictionary with query embeddings
        """
        start_time = time.time()
        result = {
            "success": False,
            "query": query,
            "clip_embedding": None,
            "text_embedding": None,
            "processing_time_ms": 0,
            "error": None
        }

        try:
            # Generate CLIP embedding for visual-semantic search
            logger.info(f"Encoding query with CLIP: {query}")
            clip_embedding = self.clip_model.encode_text(query)
            result["clip_embedding"] = embedding_to_bytes(clip_embedding).hex()

            # Generate text embedding for text-based search
            logger.info(f"Encoding query with text embedder: {query}")
            text_embedding = self.text_embedder.encode(query)
            result["text_embedding"] = embedding_to_bytes(text_embedding).hex()

            result["success"] = True
            logger.info(f"Successfully encoded query: {query}")

        except Exception as e:
            logger.error(f"Failed to encode query: {e}")
            result["error"] = str(e)

        result["processing_time_ms"] = int((time.time() - start_time) * 1000)
        return result

    def test_models(self) -> Dict:
        """
        Test all models to ensure they're working

        Returns:
            Dictionary with test results
        """
        result = {
            "clip_model": False,
            "ocr_model": False,
            "text_embedder": False,
            "errors": []
        }

        try:
            # Test CLIP
            logger.info("Testing CLIP model...")
            _ = self.clip_model.encode_text("test query")
            result["clip_model"] = True
            logger.info("✓ CLIP model working")
        except Exception as e:
            result["errors"].append(f"CLIP: {str(e)}")
            logger.error(f"✗ CLIP model failed: {e}")

        try:
            # Test OCR (without image, just load model)
            logger.info("Testing OCR model...")
            _ = self.ocr_model
            result["ocr_model"] = True
            logger.info("✓ OCR model working")
        except Exception as e:
            result["errors"].append(f"OCR: {str(e)}")
            logger.error(f"✗ OCR model failed: {e}")

        try:
            # Test text embedder
            logger.info("Testing text embedder...")
            _ = self.text_embedder.encode("test text")
            result["text_embedder"] = True
            logger.info("✓ Text embedder working")
        except Exception as e:
            result["errors"].append(f"Text Embedder: {str(e)}")
            logger.error(f"✗ Text embedder failed: {e}")

        return result


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description="Semantic Search Service for Photos")
    parser.add_argument("--action", choices=["index", "search", "test"], required=True,
                       help="Action to perform")
    parser.add_argument("--photo-path", type=str, help="Path to photo (for index action)")
    parser.add_argument("--query", type=str, help="Search query (for search action)")

    args = parser.parse_args()

    service = SemanticSearchService()

    try:
        if args.action == "test":
            # Test all models
            result = service.test_models()
            print(json.dumps(result, indent=2))

        elif args.action == "index":
            # Index a photo
            if not args.photo_path:
                print(json.dumps({"error": "--photo-path is required for index action"}))
                sys.exit(1)

            result = service.index_photo(args.photo_path)
            print(json.dumps(result, indent=2))

            if not result["success"]:
                sys.exit(1)

        elif args.action == "search":
            # Encode search query
            if not args.query:
                print(json.dumps({"error": "--query is required for search action"}))
                sys.exit(1)

            result = service.encode_query(args.query)
            print(json.dumps(result, indent=2))

            if not result["success"]:
                sys.exit(1)

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
