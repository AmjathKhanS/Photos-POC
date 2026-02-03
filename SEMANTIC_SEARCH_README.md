# AI Semantic Search Feature

## Overview

The Photo Viewer now includes an AI-powered semantic search feature that allows you to search for photos using natural language queries. Instead of just searching by filename, you can now find photos by describing their content!

## Features

- **Visual Semantic Search**: Find photos by describing what's in them using CLIP (Contrastive Language-Image Pre-training)
- **OCR Text Extraction**: Search for text within photos (receipts, documents, certificates, etc.)
- **Smart Tagging**: Automatically generated visual tags for quick categorization
- **Hybrid Search**: Combines visual similarity and text matching for best results

## How to Use

### 1. Search Mode Toggle

In the Photos view, you'll see a search bar with a toggle button:
- **📝 Text**: Regular filename search
- **🤖 AI**: AI semantic search (click to activate)

### 2. Example Queries

When AI mode is active, try queries like:

**Documents & Text:**
- "doctor slip"
- "prescription"
- "medical certificate"
- "marksheet"
- "bill" or "receipt"
- "handwritten notes"

**Visual Content:**
- "birthday cake"
- "person smiling"
- "landscape photo"
- "food"
- "indoor photo"
- "outdoor scene"

**General:**
- "document with text"
- "photo with people"
- "nature"
- "city"

### 3. Indexing Photos

Before you can search, photos need to be indexed. There are two ways to do this:

#### Option A: Auto-Index via API (Recommended)

```bash
# Index first 10 photos
curl -X POST http://localhost:3002/api/semantic-search/batch-index \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Check indexing progress
curl http://localhost:3002/api/semantic-search/stats
```

#### Option B: Manual Index

```bash
# Index a specific photo
curl -X POST http://localhost:3002/api/semantic-search/index/photo.jpg
```

## Setup & Installation

### 1. Python Dependencies

The semantic search requires Python packages. Install them using:

```bash
# Activate your Python environment
source venv_onnx/bin/activate  # Linux/Mac
# OR
venv_onnx\Scripts\activate  # Windows

# Install dependencies
pip install -r server/ai/requirements.txt
```

Required packages:
- `torch` - PyTorch for deep learning
- `open-clip-torch` - CLIP model for image-text matching
- `transformers` - Hugging Face transformers
- `sentence-transformers` - Text embeddings
- `paddleocr` - OCR for text extraction
- `paddlepaddle` - PaddleOCR backend

### 2. Database Migration

The semantic search tables are automatically created when you start the server. To manually run the migration:

```bash
cd server
npx tsx --env-file=../.env src/migrations/add-semantic-search.ts
```

### 3. Test the Setup

```bash
# Test if AI models load correctly
curl -X POST http://localhost:3002/api/semantic-search/test
```

Expected response:
```json
{
  "success": true,
  "message": "All AI models are working correctly"
}
```

## API Endpoints

### Search

```
GET /api/semantic-search/search?query={query}&limit={limit}
```

**Parameters:**
- `query` (required): Natural language search query
- `limit` (optional): Maximum results (default: 50)
- `threshold` (optional): Similarity threshold 0-1 (default: 0.65)

**Example:**
```bash
curl "http://localhost:3002/api/semantic-search/search?query=doctor%20slip&limit=10"
```

### Index Single Photo

```
POST /api/semantic-search/index/:filename
```

**Example:**
```bash
curl -X POST http://localhost:3002/api/semantic-search/index/IMG_1234.jpg
```

### Batch Index

```
POST /api/semantic-search/batch-index
```

**Body:**
```json
{
  "photoFilenames": ["photo1.jpg", "photo2.jpg"],
  "limit": 10
}
```

### Get Statistics

```
GET /api/semantic-search/stats
```

Returns indexing progress and statistics.

## Performance

### Indexing Performance

- **OCR Processing**: ~200-500ms per photo
- **CLIP Embedding**: ~50-100ms per photo
- **Total**: ~350-800ms per photo

For 402 photos: ~4-6 minutes total

### Search Performance

- **Query Encoding**: ~50ms
- **Vector Search**: ~100-150ms
- **Total**: <200ms for most queries

### Memory Requirements

- **CLIP Model**: ~1.2GB RAM
- **PaddleOCR**: ~500MB RAM
- **Text Embedder**: ~200MB RAM
- **Total**: ~2GB RAM

## Architecture

```
Frontend (React)
    ↓
Node.js API
    ↓
    ├── SQLite Database (embeddings, OCR text, tags)
    └── Python AI Service
            ├── CLIP (image-text matching)
            ├── PaddleOCR (text extraction)
            └── Sentence Transformers (text embeddings)
```

## Database Schema

### photo_ocr_text
Stores extracted text from photos with confidence scores.

### photo_visual_tags
Stores automatically generated visual tags.

### photo_embeddings
Stores 512D CLIP embeddings and 384D text embeddings.

### semantic_processing_status
Tracks which photos have been indexed.

## Troubleshooting

### Models Not Loading

**Error**: `Failed to load CLIP model`

**Solution**:
1. Ensure Python dependencies are installed
2. Check internet connection (models download on first use)
3. Models are cached in `~/.cache/` directory

### Slow Search

**Issue**: Search takes >1 second

**Solutions**:
1. Ensure database indexes are created (migration should handle this)
2. Reduce `limit` parameter
3. Check if too many photos are indexed

### No Results Found

**Issue**: Search returns no results

**Possible Causes**:
1. Photos not indexed yet - run batch indexing
2. Query too specific - try broader queries
3. Threshold too high - try lowering to 0.5

**Debug:**
```bash
# Check indexing status
curl http://localhost:3002/api/semantic-search/stats

# Should show processed > 0
```

### Python Service Fails

**Error**: `Failed to start Python service`

**Solutions**:
1. Verify `PYTHON_EXECUTABLE` in `.env` points to correct Python
2. Check python-wrapper.sh has correct path
3. Test Python directly:
   ```bash
   python server/ai/semantic_search_service.py --action test
   ```

## Advanced Configuration

### Environment Variables

Add to `.env`:

```bash
# Python executable path (required)
PYTHON_EXECUTABLE=/path/to/python

# Search parameters
SEMANTIC_SEARCH_THRESHOLD=0.65
SEMANTIC_SEARCH_DEFAULT_LIMIT=50
```

### Custom Visual Tags

Edit `server/ai/semantic_search_service.py` to add custom candidate tags:

```python
candidate_tags = [
    "your", "custom", "tags", "here",
    "document", "photo", "portrait", ...
]
```

### Performance Tuning

For faster indexing, reduce model quality:

```python
# In clip_model.py
model_name = "ViT-B-32-quickgelu"  # Faster, slightly less accurate

# In ocr_model.py
use_angle_cls=False  # Skip angle detection
```

## Future Enhancements

Planned features (see `semantic-search-plan.md`):

- [ ] Object detection (YOLO integration)
- [ ] Scene classification
- [ ] Face recognition integration
- [ ] Multi-modal search (search by example image)
- [ ] Advanced filters (combine with date, location, people)
- [ ] Real-time indexing for new photos
- [ ] GPU acceleration support

## Credits

This feature uses:
- **OpenAI CLIP**: Image-text understanding
- **PaddleOCR**: Multilingual OCR
- **Sentence Transformers**: Text embeddings
- **PyTorch**: Deep learning framework

## License

Same as main Photo Viewer project.

## Support

For issues or questions:
1. Check this README
2. Review `semantic-search-plan.md` for detailed architecture
3. Check server logs for error messages
4. Open an issue on GitHub

---

**Happy Searching! 🔍🤖**
