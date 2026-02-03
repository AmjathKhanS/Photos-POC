# AI Semantic Search Implementation Plan

## Overview

This document outlines the implementation plan for adding AI-powered semantic search capabilities to the Photo Viewer application. This feature will allow users to search photos using natural language queries (e.g., "doctor slip", "marksheet", "birthday cake") and find relevant images based on visual content and text extracted from photos.

## AI Models

### 1. CLIP (Contrastive Language-Image Pre-training)
- **Model**: OpenAI CLIP ViT-B/32
- **Purpose**: Primary semantic understanding and image-text matching
- **Embedding Size**: 512 dimensions
- **Capabilities**:
  - Natural language to image matching
  - Zero-shot image classification
  - Visual semantic understanding
- **Performance**: ~50-100ms inference time per image
- **Library**: `transformers` or `open_clip`

### 2. PaddleOCR
- **Purpose**: Optical Character Recognition for text extraction
- **Capabilities**:
  - Multi-language text detection and recognition
  - Handwritten text support
  - Document text extraction (receipts, bills, certificates, etc.)
- **Performance**: ~200-500ms per image (depending on text density)
- **Library**: `paddleocr`

### 3. Sentence Transformer (all-MiniLM-L6-v2)
- **Purpose**: Text embedding for extracted OCR content
- **Embedding Size**: 384 dimensions
- **Capabilities**:
  - Semantic text similarity
  - Fast text encoding
- **Performance**: <10ms per text snippet
- **Library**: `sentence-transformers`

## Architecture

```
┌─────────────────┐
│  React Frontend │
│   Search UI     │
└────────┬────────┘
         │
         │ HTTP API
         ▼
┌─────────────────┐
│   Node.js API   │
│   Backend       │
└────────┬────────┘
         │
         ├─────────────┬──────────────┐
         │             │              │
         ▼             ▼              ▼
┌──────────────┐ ┌──────────┐ ┌────────────┐
│   SQLite     │ │  Vector  │ │   Python   │
│   Database   │ │  Search  │ │ AI Service │
│              │ │  Engine  │ │            │
│ - OCR Text   │ │          │ │ - CLIP     │
│ - Tags       │ │ Cosine   │ │ - OCR      │
│ - Embeddings │ │ Similarity│ │ - Embeddings│
└──────────────┘ └──────────┘ └────────────┘
```

## Database Schema

### New Tables

#### 1. `photo_ocr_text`
```sql
CREATE TABLE photo_ocr_text (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_id TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  confidence REAL,
  language TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

CREATE INDEX idx_photo_ocr_text_photo_id ON photo_ocr_text(photo_id);
CREATE VIRTUAL TABLE photo_ocr_text_fts USING fts5(
  photo_id,
  extracted_text,
  content=photo_ocr_text
);
```

#### 2. `photo_visual_tags`
```sql
CREATE TABLE photo_visual_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  confidence REAL NOT NULL,
  source TEXT DEFAULT 'clip', -- 'clip' or 'manual'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

CREATE INDEX idx_photo_visual_tags_photo_id ON photo_visual_tags(photo_id);
CREATE INDEX idx_photo_visual_tags_tag ON photo_visual_tags(tag);
```

#### 3. `photo_embeddings`
```sql
CREATE TABLE photo_embeddings (
  photo_id TEXT PRIMARY KEY,
  clip_embedding BLOB NOT NULL, -- 512D vector stored as binary
  text_embedding BLOB, -- 384D vector for OCR text
  embedding_version TEXT DEFAULT 'v1',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

CREATE INDEX idx_photo_embeddings_created_at ON photo_embeddings(created_at);
```

#### 4. `semantic_processing_status`
```sql
CREATE TABLE semantic_processing_status (
  photo_id TEXT PRIMARY KEY,
  ocr_processed BOOLEAN DEFAULT 0,
  clip_processed BOOLEAN DEFAULT 0,
  last_processed_at TIMESTAMP,
  error_message TEXT,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);
```

## API Endpoints

### 1. Semantic Search
```typescript
GET /api/photos/semantic-search?query={query}&limit={limit}

Request:
  - query: Natural language search query
  - limit: Maximum results (default: 50)

Response:
{
  "results": [
    {
      "photo": { /* Photo object */ },
      "score": 0.85,
      "matchReason": "visual_similarity", // or "ocr_match" or "tag_match"
      "highlights": ["doctor", "prescription"]
    }
  ],
  "processingTime": 145,
  "totalMatches": 23
}
```

### 2. Index Photo
```typescript
POST /api/photos/:id/index

Request: (empty body)

Response:
{
  "success": true,
  "photoId": "abc123",
  "ocrText": "Sample extracted text...",
  "visualTags": ["document", "text", "paper"],
  "processingTime": 678
}
```

### 3. Batch Index
```typescript
POST /api/photos/batch-index

Request:
{
  "photoIds": ["id1", "id2", "id3"],
  "force": false // Re-index already processed photos
}

Response:
{
  "success": true,
  "processed": 3,
  "failed": 0,
  "totalTime": 2145
}
```

### 4. Get Processing Status
```typescript
GET /api/photos/processing-status

Response:
{
  "total": 402,
  "processed": 156,
  "pending": 246,
  "failed": 0,
  "progress": 38.8
}
```

## Implementation Phases

### Phase 1: Python AI Service Setup (2-3 days)

**Tasks:**
1. Create Python service structure
   - `/server/ai/semantic_search_service.py`
   - `/server/ai/models/clip_model.py`
   - `/server/ai/models/ocr_model.py`
   - `/server/ai/utils/embeddings.py`

2. Install dependencies
   ```bash
   pip install torch transformers open-clip-torch paddleocr sentence-transformers pillow numpy
   ```

3. Implement model loading and caching
   - Download CLIP ViT-B/32 model (~350MB)
   - Download PaddleOCR models (~100MB)
   - Download all-MiniLM-L6-v2 (~80MB)
   - Implement lazy loading for memory efficiency

4. Create CLI interface for Node.js integration
   ```bash
   python semantic_search_service.py --action=index --photo-path=/path/to/photo.jpg
   python semantic_search_service.py --action=search --query="doctor slip" --limit=50
   ```

**Deliverables:**
- Working Python service that can process single images
- Unit tests for model loading and inference
- Performance benchmarks

### Phase 2: Database Schema & Migration (1 day)

**Tasks:**
1. Create migration script
   - `/server/src/migrations/add_semantic_search_tables.ts`

2. Implement database schema
   - Create all 4 new tables
   - Add indexes for performance
   - Create FTS5 virtual table for text search

3. Add database helper functions
   - `/server/src/db/semanticSearch.ts`
   - Insert/update embeddings
   - Query similar vectors
   - Full-text search functions

**Deliverables:**
- Migration script tested with existing database
- Database helper functions with type definitions
- Sample queries demonstrating vector search

### Phase 3: Backend API Implementation (2-3 days)

**Tasks:**
1. Create semantic search router
   - `/server/src/routes/semanticSearch.ts`

2. Implement Python service wrapper
   - `/server/src/services/semanticSearchService.ts`
   - Spawn Python processes
   - Handle stdout/stderr
   - Error handling and retries

3. Implement vector similarity search
   - Cosine similarity function in SQLite or Node.js
   - Hybrid search (vector + FTS)
   - Result ranking and scoring

4. Create indexing endpoints
   - Single photo indexing
   - Batch processing with queue
   - Background indexing job

5. Add caching layer
   - Redis or in-memory cache for frequent queries
   - Embedding cache to avoid recomputation

**Deliverables:**
- Complete API endpoints tested with Postman/curl
- Integration tests for Python service communication
- Performance tests (target: <200ms search time)

### Phase 4: Frontend Integration (2 days)

**Tasks:**
1. Update SearchBar component
   - Add semantic search toggle
   - Visual indicator for AI search mode
   - Suggestion dropdown

2. Create search results display
   - Highlight matching text from OCR
   - Show match confidence scores
   - Display match reason (visual/text/tag)

3. Add indexing UI
   - Progress indicator for batch indexing
   - Status dashboard showing processed photos
   - Re-index button for individual photos

4. Update types
   - `/client/src/types/semanticSearch.ts`
   - Search result types
   - Indexing status types

**Deliverables:**
- Fully functional search UI
- User feedback during indexing
- Responsive design matching current UI

### Phase 5: Background Processing & Optimization (1-2 days)

**Tasks:**
1. Implement background indexing
   - Process new photos automatically on upload
   - Batch process existing photos in background
   - Rate limiting to avoid CPU overload

2. Add job queue
   - Simple in-memory queue or use Bull/BullMQ
   - Process photos in batches of 10-20
   - Retry failed jobs

3. Performance optimization
   - Batch embedding computation
   - GPU acceleration if available
   - Optimize SQLite queries
   - Add proper indexes

4. Monitoring and logging
   - Track processing times
   - Log errors and failures
   - Add metrics endpoint

**Deliverables:**
- Background processing running smoothly
- All 402 photos indexed and searchable
- Performance metrics dashboard

## Technical Considerations

### Performance

**Indexing Performance:**
- OCR processing: ~200-500ms per photo
- CLIP embedding: ~50-100ms per photo
- Total per photo: ~350-800ms (depending on image size and text density)
- Batch processing of 402 photos: ~4-6 minutes total

**Search Performance:**
- Query encoding: ~50ms
- Vector similarity search: ~100-150ms (with proper indexing)
- FTS search: <10ms
- Hybrid search total: <200ms target

### Memory Requirements

- CLIP model loaded: ~1.2GB RAM
- PaddleOCR models: ~500MB RAM
- Sentence transformer: ~200MB RAM
- Total AI service: ~2GB RAM (consider lazy loading)

### Storage

- Embeddings per photo:
  - CLIP: 512 floats × 4 bytes = 2KB
  - Text: 384 floats × 4 bytes = 1.5KB
  - Total: ~3.5KB per photo
- For 402 photos: ~1.4MB
- For 10,000 photos: ~35MB (very manageable)

### Hybrid Search Strategy

Combine three search methods for best results:

1. **Vector Similarity (CLIP)**:
   - Primary method for visual content
   - Cosine similarity threshold: >0.7 for good matches

2. **Full-Text Search (OCR)**:
   - Exact text matching
   - Use SQLite FTS5 for fast text search
   - Boost scores for exact word matches

3. **Visual Tags**:
   - Secondary method using pre-classified tags
   - Fast filtering before vector search

**Ranking Formula:**
```
final_score = (
  0.6 × clip_similarity_score +
  0.3 × ocr_match_score +
  0.1 × tag_match_score
)
```

## Example Queries

### Query: "doctor slip"
**Processing:**
1. Encode query with CLIP → query_embedding
2. Search FTS: `SELECT * FROM photo_ocr_text_fts WHERE extracted_text MATCH 'doctor slip'`
3. Search vectors: Find photos with cosine_similarity(clip_embedding, query_embedding) > 0.7
4. Combine and rank results

**Expected Results:**
- Medical prescriptions
- Doctor's notes
- Medical certificates
- Hospital bills

### Query: "marksheet"
**Processing:**
1. OCR likely to find exact matches
2. CLIP helps find document-like images
3. Tags like "document", "certificate", "paper" boost relevance

**Expected Results:**
- School marksheets
- Report cards
- Academic certificates
- Grade sheets

## Risk Mitigation

### Potential Issues & Solutions

1. **Large model download times**
   - **Solution**: Download models during setup, cache locally
   - **Fallback**: Provide pre-downloaded model package

2. **Slow first-time indexing**
   - **Solution**: Batch processing with progress UI
   - **Solution**: Allow users to continue browsing during indexing
   - **Fallback**: Index on-demand when searching

3. **Memory constraints**
   - **Solution**: Lazy load models (load only when needed)
   - **Solution**: Unload models after idle timeout
   - **Fallback**: Reduce batch size, process fewer photos simultaneously

4. **Inaccurate OCR for handwritten text**
   - **Solution**: Use PaddleOCR's handwriting recognition mode
   - **Fallback**: Allow manual tag correction
   - **Enhancement**: Train custom OCR model for specific use cases

5. **Cross-platform compatibility (WSL/Windows)**
   - **Solution**: Use existing python-wrapper.sh pattern
   - **Solution**: Test on both platforms
   - **Fallback**: Provide platform-specific installation guides

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Object Detection**
   - Use YOLO or Faster R-CNN for specific object detection
   - Pre-defined categories: person, vehicle, animal, food, etc.

2. **Scene Classification**
   - Indoor/outdoor detection
   - Location type: beach, mountain, office, home, etc.

3. **Face Recognition Integration**
   - Combine with existing face detection
   - Search: "photos with John at beach"

4. **Smart Tagging UI**
   - Auto-suggest tags while typing
   - Popular tags cloud
   - Tag editing interface

5. **Advanced Filters**
   - Combine semantic search with date, location, people
   - Boolean operators: AND, OR, NOT
   - Search history and saved searches

6. **Multi-modal Search**
   - Search by example image
   - Search by drawing/sketch
   - Search by color palette

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| 1. Python AI Service | 2-3 days | Working AI models and CLI |
| 2. Database Schema | 1 day | Migration and DB functions |
| 3. Backend API | 2-3 days | Complete REST API |
| 4. Frontend UI | 2 days | Search UI and results display |
| 5. Background Processing | 1-2 days | Auto-indexing and optimization |
| **Total** | **8-13 days** | Fully functional semantic search |

## Success Metrics

1. **Accuracy**: >80% relevant results in top 10 for common queries
2. **Performance**: Search completes in <200ms for 95% of queries
3. **Coverage**: >95% of photos successfully indexed
4. **User Satisfaction**: Positive feedback on search relevance

## Getting Started

### Prerequisites
```bash
# Install Python dependencies
pip install torch transformers open-clip-torch paddleocr sentence-transformers pillow numpy

# Verify installation
python -c "import torch; import transformers; print('All dependencies installed')"
```

### Quick Start
```bash
# 1. Run database migration
npm run migrate

# 2. Start AI service (test mode)
python server/ai/semantic_search_service.py --test

# 3. Index sample photos
curl -X POST http://localhost:5000/api/photos/batch-index -H "Content-Type: application/json" -d '{"limit": 10}'

# 4. Test search
curl "http://localhost:5000/api/photos/semantic-search?query=doctor%20slip&limit=5"
```

## Conclusion

This implementation plan provides a comprehensive roadmap for adding AI-powered semantic search to the Photo Viewer application. The hybrid approach combining CLIP for visual understanding, PaddleOCR for text extraction, and vector similarity search will enable powerful natural language photo search capabilities.

The phased approach ensures incremental progress with testable deliverables at each stage, while the risk mitigation strategies address common challenges in AI integration projects.

**Estimated Total Effort**: 8-13 days of development + 2-3 days of testing and refinement = **2-3 weeks** for full production-ready implementation.
