"""
Embedding Utilities for Text Semantic Search
Uses Sentence Transformers for text embedding
"""

from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Union, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TextEmbedder:
    """Wrapper for Sentence Transformer providing text embeddings"""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize text embedding model

        Args:
            model_name: Sentence transformer model name
        """
        logger.info(f"Initializing text embedding model: {model_name}")

        try:
            self.model = SentenceTransformer(model_name)
            logger.info(f"Text embedding model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load text embedding model: {e}")
            raise

    def encode(self, texts: Union[str, List[str]], normalize: bool = True) -> np.ndarray:
        """
        Encode text(s) into embedding vectors

        Args:
            texts: Single text string or list of strings
            normalize: Whether to normalize embeddings to unit length

        Returns:
            384-dimensional numpy array (or multiple if list provided)
        """
        try:
            embeddings = self.model.encode(
                texts,
                normalize_embeddings=normalize,
                show_progress_bar=False
            )
            return embeddings
        except Exception as e:
            logger.error(f"Failed to encode text: {e}")
            raise

    def compute_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        Compute cosine similarity between two embeddings

        Args:
            emb1: First embedding vector
            emb2: Second embedding vector

        Returns:
            Similarity score between -1 and 1
        """
        return float(np.dot(emb1, emb2))

    def find_similar_texts(self, query: str, text_embeddings: List[np.ndarray],
                          threshold: float = 0.5) -> List[tuple]:
        """
        Find texts similar to a query

        Args:
            query: Query text
            text_embeddings: List of text embeddings to search
            threshold: Minimum similarity threshold

        Returns:
            List of (index, similarity_score) tuples
        """
        query_embedding = self.encode(query)

        results = []
        for idx, text_emb in enumerate(text_embeddings):
            similarity = self.compute_similarity(query_embedding, text_emb)
            if similarity >= threshold:
                results.append((idx, similarity))

        results.sort(key=lambda x: x[1], reverse=True)
        return results


def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Compute cosine similarity between two vectors

    Args:
        vec1: First vector
        vec2: Second vector

    Returns:
        Similarity score between -1 and 1
    """
    return float(np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2)))


def batch_cosine_similarity(query_vec: np.ndarray, vectors: np.ndarray) -> np.ndarray:
    """
    Compute cosine similarity between a query vector and multiple vectors

    Args:
        query_vec: Query vector (1D array)
        vectors: Matrix of vectors (2D array, each row is a vector)

    Returns:
        Array of similarity scores
    """
    # Normalize vectors
    query_norm = query_vec / np.linalg.norm(query_vec)
    vectors_norm = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)

    # Compute dot products
    similarities = np.dot(vectors_norm, query_norm)
    return similarities


def embedding_to_bytes(embedding: np.ndarray) -> bytes:
    """
    Convert numpy embedding to bytes for database storage

    Args:
        embedding: Numpy array

    Returns:
        Bytes representation
    """
    return embedding.astype(np.float32).tobytes()


def bytes_to_embedding(data: bytes, shape: tuple = None) -> np.ndarray:
    """
    Convert bytes back to numpy embedding

    Args:
        data: Bytes representation
        shape: Optional shape to reshape to

    Returns:
        Numpy array
    """
    embedding = np.frombuffer(data, dtype=np.float32)
    if shape:
        embedding = embedding.reshape(shape)
    return embedding


# Singleton instance
_text_embedder_instance: Optional[TextEmbedder] = None


def get_text_embedder() -> TextEmbedder:
    """Get or create singleton text embedder instance"""
    global _text_embedder_instance
    if _text_embedder_instance is None:
        _text_embedder_instance = TextEmbedder()
    return _text_embedder_instance


if __name__ == "__main__":
    # Test the embedder
    embedder = get_text_embedder()
    print("Text embedder loaded successfully")

    # Test encoding
    texts = ["doctor prescription", "medical certificate", "birthday cake"]
    embeddings = embedder.encode(texts)
    print(f"\nEmbeddings shape: {embeddings.shape}")

    # Test similarity
    query = "medical document"
    similarities = []
    query_emb = embedder.encode(query)
    for i, text in enumerate(texts):
        sim = embedder.compute_similarity(query_emb, embeddings[i])
        similarities.append((text, sim))
        print(f"Similarity '{query}' <-> '{text}': {sim:.3f}")
