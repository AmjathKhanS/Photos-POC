"""
CLIP Model Wrapper for Visual Semantic Understanding
Uses OpenAI's CLIP ViT-B/32 model for image-text matching
"""

import torch
import open_clip
from PIL import Image
import numpy as np
from typing import Optional, List, Union
import logging

# Enable HEIC support
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    logging.info("HEIC image format support enabled")
except ImportError:
    logging.warning("pillow-heif not installed - HEIC images will not be supported")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CLIPModel:
    """Wrapper for CLIP model providing image and text encoding"""

    def __init__(self, model_name: str = "ViT-B-32", pretrained: str = "openai"):
        """
        Initialize CLIP model

        Args:
            model_name: CLIP model architecture (default: ViT-B-32)
            pretrained: Pretrained weights to use (default: openai)
        """
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Initializing CLIP model on device: {self.device}")

        try:
            self.model, _, self.preprocess = open_clip.create_model_and_transforms(
                model_name, pretrained=pretrained
            )
            self.tokenizer = open_clip.get_tokenizer(model_name)
            self.model.to(self.device)
            self.model.eval()
            logger.info(f"CLIP model loaded successfully: {model_name}")
        except Exception as e:
            logger.error(f"Failed to load CLIP model: {e}")
            raise

    def encode_image(self, image_path: str) -> np.ndarray:
        """
        Encode an image into a feature vector

        Args:
            image_path: Path to the image file

        Returns:
            512-dimensional numpy array
        """
        try:
            image = Image.open(image_path).convert("RGB")
            image_tensor = self.preprocess(image).unsqueeze(0).to(self.device)

            with torch.no_grad():
                image_features = self.model.encode_image(image_tensor)
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)

            return image_features.cpu().numpy().flatten()
        except Exception as e:
            logger.error(f"Failed to encode image {image_path}: {e}")
            raise

    def encode_text(self, text: Union[str, List[str]]) -> np.ndarray:
        """
        Encode text into a feature vector

        Args:
            text: Single text string or list of text strings

        Returns:
            512-dimensional numpy array (or multiple if list provided)
        """
        try:
            if isinstance(text, str):
                text = [text]

            text_tokens = self.tokenizer(text).to(self.device)

            with torch.no_grad():
                text_features = self.model.encode_text(text_tokens)
                text_features = text_features / text_features.norm(dim=-1, keepdim=True)

            result = text_features.cpu().numpy()
            return result[0] if len(text) == 1 else result
        except Exception as e:
            logger.error(f"Failed to encode text: {e}")
            raise

    def compute_similarity(self, image_embedding: np.ndarray, text_embedding: np.ndarray) -> float:
        """
        Compute cosine similarity between image and text embeddings

        Args:
            image_embedding: Image feature vector
            text_embedding: Text feature vector

        Returns:
            Similarity score between -1 and 1
        """
        return float(np.dot(image_embedding, text_embedding))

    def find_similar_images(self, query_text: str, image_embeddings: List[np.ndarray],
                           threshold: float = 0.7) -> List[tuple]:
        """
        Find images similar to a text query

        Args:
            query_text: Natural language query
            image_embeddings: List of image embeddings to search
            threshold: Minimum similarity threshold

        Returns:
            List of (index, similarity_score) tuples
        """
        query_embedding = self.encode_text(query_text)

        results = []
        for idx, img_emb in enumerate(image_embeddings):
            similarity = self.compute_similarity(img_emb, query_embedding)
            if similarity >= threshold:
                results.append((idx, similarity))

        # Sort by similarity score (descending)
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def generate_tags(self, image_path: str, candidate_tags: List[str],
                     threshold: float = 0.3) -> List[tuple]:
        """
        Generate visual tags for an image

        Args:
            image_path: Path to the image
            candidate_tags: List of possible tags
            threshold: Minimum confidence threshold

        Returns:
            List of (tag, confidence) tuples
        """
        image_embedding = self.encode_image(image_path)
        tag_embeddings = self.encode_text(candidate_tags)

        results = []
        for tag, tag_emb in zip(candidate_tags, tag_embeddings):
            confidence = self.compute_similarity(image_embedding, tag_emb)
            if confidence >= threshold:
                results.append((tag, float(confidence)))

        results.sort(key=lambda x: x[1], reverse=True)
        return results


# Singleton instance
_clip_model_instance: Optional[CLIPModel] = None


def get_clip_model() -> CLIPModel:
    """Get or create singleton CLIP model instance"""
    global _clip_model_instance
    if _clip_model_instance is None:
        _clip_model_instance = CLIPModel()
    return _clip_model_instance


if __name__ == "__main__":
    # Test the model
    model = get_clip_model()
    print("CLIP model loaded successfully")

    # Test text encoding
    text_emb = model.encode_text("a photo of a cat")
    print(f"Text embedding shape: {text_emb.shape}")
    print(f"Text embedding sample: {text_emb[:5]}")
