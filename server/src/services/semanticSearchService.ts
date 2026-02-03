/**
 * Semantic Search Service
 * Node.js service that coordinates Python AI models and database operations
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as semanticDb from './semanticSearchDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to safely join paths in WSL environment
function safePath(...parts: string[]): string {
  // Use simple string concatenation to avoid path.join converting WSL paths
  return parts.join('/').replace(/\/+/g, '/');
}

const PYTHON_CMD = process.env.PYTHON_EXECUTABLE || 'python3';
const AI_SERVICE_PATH = path.join(__dirname, '../../ai/semantic_search_service.py');
const PHOTOS_DIR = process.env.PHOTOS_DIR || '';

if (!PHOTOS_DIR) {
  console.warn('WARNING: PHOTOS_DIR environment variable not set');
}

interface IndexResult {
  success: boolean;
  photo_path: string;
  ocr_text?: string;
  ocr_num_blocks?: number;
  ocr_confidence?: number;
  clip_embedding?: string;
  clip_embedding_size?: number;
  text_embedding?: string;
  text_embedding_size?: number;
  visual_tags?: Array<{ tag: string; confidence: number }>;
  is_screenshot?: boolean;
  processing_time_ms?: number;
  error?: string;
}

interface SearchQueryResult {
  success: boolean;
  query: string;
  clip_embedding?: string;
  text_embedding?: string;
  processing_time_ms?: number;
  error?: string;
}

interface SearchResult {
  photo_filename: string;
  score: number;
  match_type: 'visual' | 'text' | 'hybrid';
  ocr_text?: string;
  matched_tags?: string[];
}

/**
 * Call Python AI service and return parsed JSON result
 */
async function callPythonService(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const process = spawn(PYTHON_CMD, [AI_SERVICE_PATH, ...args]);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error('Python service error:', stderr);
        reject(new Error(`Python service exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        console.error('Failed to parse Python service output:', stdout);
        reject(new Error(`Invalid JSON from Python service: ${error}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Failed to start Python service: ${error.message}`));
    });
  });
}

/**
 * Convert hex string to Buffer
 */
function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/**
 * Compute cosine similarity between two buffers containing float32 arrays
 */
function cosineSimilarity(buf1: Buffer, buf2: Buffer): number {
  const arr1 = new Float32Array(buf1.buffer, buf1.byteOffset, buf1.byteLength / 4);
  const arr2 = new Float32Array(buf2.buffer, buf2.byteOffset, buf2.byteLength / 4);

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < arr1.length; i++) {
    dotProduct += arr1[i] * arr2[i];
    norm1 += arr1[i] * arr1[i];
    norm2 += arr2[i] * arr2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Index a single photo: extract text, generate embeddings, and visual tags
 */
export async function indexPhoto(photoFilename: string): Promise<IndexResult> {
  const startTime = Date.now();

  try {
    const photoPath = safePath(PHOTOS_DIR, photoFilename);

    // Call Python service to process the photo
    const result: IndexResult = await callPythonService([
      '--action', 'index',
      '--photo-path', photoPath,
    ]);

    if (!result.success) {
      // Store error in processing status
      semanticDb.upsertProcessingStatus(
        photoFilename,
        false,
        false,
        Date.now() - startTime,
        result.error || 'Unknown error',
        false
      );
      return result;
    }

    // Store OCR text if available
    if (result.ocr_text && result.ocr_text.trim()) {
      semanticDb.insertOcrText(
        photoFilename,
        result.ocr_text,
        result.ocr_confidence || null,
        result.ocr_num_blocks || null
      );
    }

    // Store visual tags
    if (result.visual_tags && result.visual_tags.length > 0) {
      semanticDb.insertVisualTags(photoFilename, result.visual_tags);
    }

    // Store embeddings
    if (result.clip_embedding) {
      const clipEmbedding = hexToBuffer(result.clip_embedding);
      const textEmbedding = result.text_embedding ? hexToBuffer(result.text_embedding) : null;
      semanticDb.insertEmbedding(photoFilename, clipEmbedding, textEmbedding);
    }

    // Update processing status
    semanticDb.upsertProcessingStatus(
      photoFilename,
      true,
      true,
      Date.now() - startTime,
      null,
      result.is_screenshot || false
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to index photo ${photoFilename}:`, errorMessage);

    semanticDb.upsertProcessingStatus(
      photoFilename,
      false,
      false,
      Date.now() - startTime,
      errorMessage,
      false
    );

    return {
      success: false,
      photo_path: photoFilename,
      error: errorMessage,
    };
  }
}

/**
 * Index multiple photos in batch
 */
export async function indexPhotos(
  photoFilenames: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<{ processed: number; failed: number; results: IndexResult[] }> {
  const results: IndexResult[] = [];
  let processed = 0;
  let failed = 0;

  for (const filename of photoFilenames) {
    const result = await indexPhoto(filename);
    results.push(result);

    if (result.success) {
      processed++;
    } else {
      failed++;
    }

    if (onProgress) {
      onProgress(processed + failed, photoFilenames.length);
    }
  }

  return { processed, failed, results };
}

/**
 * Expand query with synonyms and related terms
 */
function expandQuery(query: string): string[] {
  const expansions = new Map<string, string[]>([
    // Medical terms
    ['medical', ['medical', 'doctor', 'health', 'healthcare', 'clinical', 'medicine']],
    ['prescription', ['prescription', 'rx', 'medicine', 'medication', 'drug', 'pharmacy']],
    ['doctor', ['doctor', 'physician', 'dr', 'medical', 'healthcare']],
    ['hospital', ['hospital', 'clinic', 'medical center', 'healthcare facility']],
    ['medicine', ['medicine', 'medication', 'drug', 'pharmaceutical', 'remedy']],
    ['lab', ['lab', 'laboratory', 'test', 'pathology', 'diagnostic']],
    ['report', ['report', 'results', 'findings', 'document', 'record']],

    // Document types
    ['receipt', ['receipt', 'bill', 'invoice', 'payment', 'transaction']],
    ['certificate', ['certificate', 'diploma', 'credential', 'qualification']],
    ['document', ['document', 'paper', 'file', 'record', 'form']],
    ['id', ['id', 'identification', 'identity', 'card', 'passport']],
    ['license', ['license', 'permit', 'certification', 'authorization']],

    // People terms
    ['boy', ['boy', 'child', 'kid', 'young boy', 'male child']],
    ['girl', ['girl', 'child', 'kid', 'young girl', 'female child']],
    ['man', ['man', 'male', 'guy', 'person', 'adult male']],
    ['woman', ['woman', 'female', 'lady', 'person', 'adult female']],
    ['child', ['child', 'kid', 'boy', 'girl', 'young', 'toddler']],
    ['people', ['people', 'persons', 'group', 'crowd', 'family', 'friends']],
    ['baby', ['baby', 'infant', 'toddler', 'newborn']],

    // Clothing terms
    ['shirt', ['shirt', 't-shirt', 'tshirt', 'top', 'blouse']],
    ['tshirt', ['tshirt', 't-shirt', 'shirt', 'top', 'casual wear']],
    ['dress', ['dress', 'gown', 'frock', 'outfit']],
    ['jacket', ['jacket', 'coat', 'blazer', 'sweater']],
    ['pants', ['pants', 'trousers', 'jeans', 'slacks']],
    ['jeans', ['jeans', 'denim', 'pants', 'blue jeans']],

    // Color terms
    ['red', ['red', 'crimson', 'scarlet', 'maroon']],
    ['blue', ['blue', 'navy', 'azure', 'cobalt']],
    ['green', ['green', 'emerald', 'lime', 'olive']],
    ['black', ['black', 'dark']],
    ['white', ['white', 'bright']],
    ['yellow', ['yellow', 'gold', 'golden']],
    ['pink', ['pink', 'rose']],
  ]);

  const queryLower = query.toLowerCase();
  const terms = [query]; // Always include original query

  // Check for matching terms
  for (const [key, synonyms] of expansions) {
    if (queryLower.includes(key)) {
      synonyms.forEach(syn => {
        if (!terms.includes(syn)) {
          terms.push(syn);
        }
      });
    }
  }

  return terms;
}

/**
 * Search photos using natural language query
 */
export async function searchPhotos(
  query: string,
  limit: number = 50,
  threshold?: number  // Made optional for adaptive thresholds
): Promise<SearchResult[]> {
  try {
    // 1. Determine adaptive threshold based on query type
    const queryLower = query.toLowerCase();

    // High-precision queries (medical, legal, specific documents)
    const highPrecisionTerms = ['medical', 'prescription', 'certificate', 'legal', 'official', 'lab report', 'doctor'];
    const isHighPrecision = highPrecisionTerms.some(term => queryLower.includes(term));

    // Multi-attribute queries (e.g., "red shirt boy")
    const isMultiAttribute = query.split(/\s+/).length >= 3;

    // Set adaptive threshold
    const adaptiveThreshold = threshold ?? (
      isHighPrecision ? 0.60 :      // Stricter for medical/official docs
      isMultiAttribute ? 0.48 :     // More lenient for multi-attribute
      0.55                          // Default middle ground
    );

    console.log(`Using threshold: ${adaptiveThreshold} (query type: ${isHighPrecision ? 'high-precision' : isMultiAttribute ? 'multi-attribute' : 'general'})`);

    // 2. Expand query with synonyms
    const expandedQueries = expandQuery(query);
    console.log(`Query expansion: "${query}" -> [${expandedQueries.join(', ')}]`);

    // 2. Encode the search query
    const queryResult: SearchQueryResult = await callPythonService([
      '--action', 'search',
      '--query', query,
    ]);

    if (!queryResult.success || !queryResult.clip_embedding) {
      throw new Error(queryResult.error || 'Failed to encode query');
    }

    const queryClipEmbedding = hexToBuffer(queryResult.clip_embedding);
    const queryTextEmbedding = queryResult.text_embedding ? hexToBuffer(queryResult.text_embedding) : null;

    // 3. Get all photo embeddings from database
    const allEmbeddings = semanticDb.getAllEmbeddings();

    // 4. Compute visual similarity scores
    const visualScores = new Map<string, number>();
    for (const embedding of allEmbeddings) {
      const score = cosineSimilarity(queryClipEmbedding, embedding.clip_embedding);
      if (score >= adaptiveThreshold) {
        visualScores.set(embedding.photo_filename, score);
      }
    }

    // 5. Search OCR text using full-text search with expanded queries
    const textMatches = new Set<string>();
    try {
      for (const expandedQuery of expandedQueries) {
        const ftsResults = semanticDb.searchOcrTextFts(expandedQuery, limit * 2);
        ftsResults.forEach(filename => textMatches.add(filename));
      }
    } catch (error) {
      console.warn('FTS search failed:', error);
    }

    // 6. Search visual tags for matches with improved precision
    const tagMatches = new Map<string, { confidence: number; exactMatch: boolean }>();
    for (const expandedQuery of expandedQueries) {
      const queryLower = expandedQuery.toLowerCase();
      const queryWords = queryLower.split(/\s+/);
      const allTags = semanticDb.getAllVisualTags();

      for (const tagData of allTags) {
        const tagLower = tagData.tag.toLowerCase();

        // Priority 1: Exact match (highest priority)
        if (tagLower === queryLower) {
          const current = tagMatches.get(tagData.photo_filename);
          if (!current || tagData.confidence > current.confidence) {
            tagMatches.set(tagData.photo_filename, {
              confidence: tagData.confidence,
              exactMatch: true
            });
          }
        }
        // Priority 2: Tag contains full query (e.g., "medical prescription" tag matches "prescription" query)
        else if (queryWords.length === 1 && tagLower.includes(queryLower)) {
          const current = tagMatches.get(tagData.photo_filename);
          if (!current || (!current.exactMatch && tagData.confidence > current.confidence)) {
            tagMatches.set(tagData.photo_filename, {
              confidence: tagData.confidence * 0.95, // Slight penalty for partial match
              exactMatch: false
            });
          }
        }
        // Priority 3: Multi-word query - all words must appear in tag
        else if (queryWords.length > 1) {
          const allWordsMatch = queryWords.every(word => tagLower.includes(word));
          if (allWordsMatch) {
            const current = tagMatches.get(tagData.photo_filename);
            if (!current || (!current.exactMatch && tagData.confidence > current.confidence)) {
              tagMatches.set(tagData.photo_filename, {
                confidence: tagData.confidence * 0.90, // Penalty for partial match
                exactMatch: false
              });
            }
          }
        }
        // Priority 4: Single word matches (only if confidence is high enough)
        else if (queryWords.length === 1 && queryWords[0].length >= 4) {
          for (const word of queryWords) {
            if (tagLower.includes(word) && tagData.confidence > 0.35) {
              const current = tagMatches.get(tagData.photo_filename);
              if (!current || (!current.exactMatch && tagData.confidence > current.confidence)) {
                tagMatches.set(tagData.photo_filename, {
                  confidence: tagData.confidence * 0.80, // Heavy penalty
                  exactMatch: false
                });
              }
            }
          }
        }
      }
    }
    console.log(`Tag matches found: ${tagMatches.size} photos`);

    // 7. Combine results with intelligent scoring
    const combinedResults = new Map<string, SearchResult>();
    console.log(`Visual matches: ${visualScores.size}, Text matches: ${textMatches.size}, Tag matches: ${tagMatches.size}`);

    // Add visual matches
    for (const [filename, score] of visualScores) {
      combinedResults.set(filename, {
        photo_filename: filename,
        score,
        match_type: 'visual',
      });
    }

    // Add text matches (OCR)
    for (const filename of textMatches) {
      const existing = combinedResults.get(filename);
      if (existing) {
        // Hybrid match: found in both visual and text
        existing.match_type = 'hybrid';
        existing.score = Math.max(existing.score, 0.92); // Boost hybrid matches
      } else {
        // Pure text match
        combinedResults.set(filename, {
          photo_filename: filename,
          score: 0.88, // High score for text matches
          match_type: 'text',
        });
      }
    }

    // Add tag matches with improved scoring
    for (const [filename, matchInfo] of tagMatches) {
      const existing = combinedResults.get(filename);

      // Require minimum tag confidence for tag-only matches
      const minConfidence = matchInfo.exactMatch ? 0.25 : 0.35;

      if (matchInfo.confidence < minConfidence) {
        continue; // Skip low-confidence tag matches
      }

      if (existing) {
        // Boost existing matches based on exact vs partial match
        const boost = matchInfo.exactMatch
          ? matchInfo.confidence * 0.20  // Exact match: bigger boost
          : matchInfo.confidence * 0.10; // Partial match: smaller boost
        existing.score = Math.min(0.98, existing.score + boost);

        if (!existing.matched_tags) {
          existing.matched_tags = [];
        }
      } else {
        // Tag-only match: more conservative scoring
        const baseScore = matchInfo.exactMatch ? 0.70 : 0.60;
        const confidenceBoost = matchInfo.confidence * 0.15;

        combinedResults.set(filename, {
          photo_filename: filename,
          score: baseScore + confidenceBoost,
          match_type: 'visual',
        });
      }
    }

    // 8. Add OCR text and tags to results
    const results = Array.from(combinedResults.values());
    for (const result of results) {
      const ocrData = semanticDb.getOcrText(result.photo_filename);
      if (ocrData) {
        result.ocr_text = ocrData.extracted_text;
      }

      const tags = semanticDb.getVisualTags(result.photo_filename);
      if (tags.length > 0) {
        result.matched_tags = tags.slice(0, 5).map(t => t.tag);
      }
    }

    // 9. Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    console.log(`Found ${results.length} matches for query "${query}"`);
    return results.slice(0, limit);

  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
}

/**
 * Get processing statistics
 */
export function getProcessingStats() {
  return semanticDb.getProcessingStats();
}

/**
 * Get semantic search statistics
 */
export function getSemanticStats() {
  return semanticDb.getSemanticSearchStats();
}

/**
 * Clear all semantic data for a photo
 */
export function clearPhotoSemanticData(photoFilename: string) {
  semanticDb.clearSemanticData(photoFilename);
}

/**
 * Test if Python AI service is available
 */
export async function testPythonService(): Promise<{ success: boolean; errors: string[] }> {
  try {
    const result = await callPythonService(['--action', 'test']);
    return {
      success: result.clip_model && result.ocr_model && result.text_embedder,
      errors: result.errors || [],
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
