"""
PaddleOCR Wrapper for Text Extraction from Images
Supports multi-language text detection and recognition
"""

from paddleocr import PaddleOCR
from typing import Optional, List, Dict, Tuple
import logging
import numpy as np
from PIL import Image

# Enable HEIC support
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    logging.info("HEIC image format support enabled for OCR")
except ImportError:
    logging.warning("pillow-heif not installed - HEIC images will not be supported for OCR")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OCRModel:
    """Wrapper for PaddleOCR providing text extraction"""

    def __init__(self, lang: str = "en", use_gpu: bool = False):
        """
        Initialize PaddleOCR model

        Args:
            lang: Language code (en, ch, fr, de, etc.)
            use_gpu: Whether to use GPU acceleration (not supported in current version)
        """
        logger.info(f"Initializing PaddleOCR model (lang={lang})")

        try:
            self.ocr = PaddleOCR(
                use_textline_orientation=True,  # Enable orientation detection
                lang=lang,
                enable_mkldnn=False  # Disable OneDNN/MKLDNN to avoid compatibility issues
            )
            logger.info("PaddleOCR model loaded successfully (OneDNN disabled)")
        except Exception as e:
            logger.error(f"Failed to load PaddleOCR model: {e}")
            raise

    def extract_text(self, image_path: str, min_confidence: float = 0.5) -> List[Dict]:
        """
        Extract text from an image

        Args:
            image_path: Path to the image file
            min_confidence: Minimum confidence threshold (0-1)

        Returns:
            List of dictionaries containing:
                - text: Extracted text
                - confidence: Confidence score
                - bbox: Bounding box coordinates [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
        """
        try:
            # Use the new predict() API
            result = self.ocr.predict(image_path)

            if not result:
                logger.info(f"No text detected in image: {image_path}")
                return []

            # Handle PaddleX OCRResult object (new format)
            extracted_texts = []

            # PaddleX returns a list of OCRResult objects (one per page)
            for page_result in result:
                # OCRResult is dict-like with 'rec_texts', 'rec_scores', 'rec_polys'
                rec_texts = page_result.get('rec_texts', [])
                rec_scores = page_result.get('rec_scores', [])
                rec_polys = page_result.get('rec_polys', [])

                # Combine texts, scores, and bboxes
                for i, text in enumerate(rec_texts):
                    confidence = float(rec_scores[i]) if i < len(rec_scores) else 1.0
                    bbox = rec_polys[i].tolist() if i < len(rec_polys) else []

                    if confidence >= min_confidence:
                        extracted_texts.append({
                            "text": text,
                            "confidence": confidence,
                            "bbox": bbox
                        })

            logger.info(f"Extracted {len(extracted_texts)} text blocks from {image_path}")
            return extracted_texts

        except Exception as e:
            logger.error(f"Failed to extract text from {image_path}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []

    def extract_full_text(self, image_path: str, min_confidence: float = 0.5) -> str:
        """
        Extract all text from an image as a single string

        Args:
            image_path: Path to the image file
            min_confidence: Minimum confidence threshold

        Returns:
            Combined text string with newlines between blocks
        """
        text_blocks = self.extract_text(image_path, min_confidence)
        return "\n".join([block["text"] for block in text_blocks])

    def contains_text(self, image_path: str, min_confidence: float = 0.5) -> bool:
        """
        Check if an image contains any text

        Args:
            image_path: Path to the image file
            min_confidence: Minimum confidence threshold

        Returns:
            True if text is detected, False otherwise
        """
        text_blocks = self.extract_text(image_path, min_confidence)
        return len(text_blocks) > 0

    def get_text_statistics(self, image_path: str, min_confidence: float = 0.5) -> Dict:
        """
        Get statistics about text in an image

        Args:
            image_path: Path to the image file
            min_confidence: Minimum confidence threshold

        Returns:
            Dictionary with text statistics:
                - num_blocks: Number of text blocks
                - total_chars: Total character count
                - avg_confidence: Average confidence score
                - full_text: Complete extracted text
        """
        text_blocks = self.extract_text(image_path, min_confidence)

        if not text_blocks:
            return {
                "num_blocks": 0,
                "total_chars": 0,
                "avg_confidence": 0.0,
                "full_text": ""
            }

        full_text = "\n".join([block["text"] for block in text_blocks])
        avg_confidence = sum(block["confidence"] for block in text_blocks) / len(text_blocks)

        return {
            "num_blocks": len(text_blocks),
            "total_chars": len(full_text),
            "avg_confidence": float(avg_confidence),
            "full_text": full_text
        }


# Singleton instance
_ocr_model_instance: Optional[OCRModel] = None


def get_ocr_model(lang: str = "en") -> OCRModel:
    """Get or create singleton OCR model instance"""
    global _ocr_model_instance
    if _ocr_model_instance is None:
        _ocr_model_instance = OCRModel(lang=lang)
    return _ocr_model_instance


if __name__ == "__main__":
    # Test the model
    import sys

    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        model = get_ocr_model()
        print("OCR model loaded successfully")

        stats = model.get_text_statistics(image_path)
        print(f"\nImage: {image_path}")
        print(f"Text blocks: {stats['num_blocks']}")
        print(f"Total characters: {stats['total_chars']}")
        print(f"Average confidence: {stats['avg_confidence']:.2f}")
        print(f"\nExtracted text:\n{stats['full_text']}")
    else:
        print("Usage: python ocr_model.py <image_path>")
