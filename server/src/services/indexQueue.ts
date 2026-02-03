/**
 * Photo Indexing Queue Service
 * Handles background indexing of newly uploaded photos
 */

import * as semanticSearchService from './semanticSearchService.js';

interface QueueItem {
  filename: string;
  priority: 'high' | 'normal' | 'low';
  addedAt: Date;
  retries: number;
}

class IndexQueue {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private maxConcurrent: number = 3; // Process 3 photos at once
  private maxRetries: number = 2;
  private currentlyProcessing: Set<string> = new Set();

  /**
   * Add photo to indexing queue
   * @param filename Photo filename to index
   * @param priority Priority level (high for user uploads, normal for bulk)
   */
  addToQueue(filename: string, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    // Check if already in queue
    if (this.queue.some(item => item.filename === filename)) {
      console.log(`Photo ${filename} already in queue, skipping`);
      return;
    }

    // Check if currently processing
    if (this.currentlyProcessing.has(filename)) {
      console.log(`Photo ${filename} currently being processed, skipping`);
      return;
    }

    const queueItem: QueueItem = {
      filename,
      priority,
      addedAt: new Date(),
      retries: 0,
    };

    // Add based on priority
    if (priority === 'high') {
      this.queue.unshift(queueItem); // Add to front
    } else {
      this.queue.push(queueItem); // Add to end
    }

    console.log(`📥 Added to index queue: ${filename} (priority: ${priority}, queue size: ${this.queue.length})`);

    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }
  }

  /**
   * Add multiple photos to queue
   */
  addMultipleToQueue(filenames: string[], priority: 'high' | 'normal' | 'low' = 'normal'): void {
    filenames.forEach(filename => this.addToQueue(filename, priority));
  }

  /**
   * Start processing the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    console.log('🚀 Index queue processing started');

    while (this.queue.length > 0 || this.currentlyProcessing.size > 0) {
      // Process up to maxConcurrent items concurrently
      while (this.currentlyProcessing.size < this.maxConcurrent && this.queue.length > 0) {
        const item = this.queue.shift();
        if (item) {
          this.processItem(item);
        }
      }

      // Wait a bit before checking again
      await this.sleep(500);
    }

    this.processing = false;
    console.log('✅ Index queue processing complete');
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    this.currentlyProcessing.add(item.filename);

    try {
      console.log(`⚙️  Indexing: ${item.filename} (priority: ${item.priority})`);

      const result = await semanticSearchService.indexPhoto(item.filename);

      if (result.success) {
        console.log(`✅ Indexed: ${item.filename} (${result.processing_time_ms}ms)`);
      } else {
        // Retry if failed
        if (item.retries < this.maxRetries) {
          item.retries++;
          console.log(`⚠️  Failed: ${item.filename}, retrying... (${item.retries}/${this.maxRetries})`);
          this.queue.push(item); // Add back to queue
        } else {
          console.error(`❌ Failed: ${item.filename} after ${this.maxRetries} retries - ${result.error}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error indexing ${item.filename}:`, error);

      // Retry logic
      if (item.retries < this.maxRetries) {
        item.retries++;
        this.queue.push(item);
      }
    } finally {
      this.currentlyProcessing.delete(item.filename);
    }
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number;
    processing: number;
    isActive: boolean;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.currentlyProcessing.size,
      isActive: this.processing,
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = [];
    console.log('🗑️  Queue cleared');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const indexQueue = new IndexQueue();

/**
 * Convenience function to add photo to queue
 */
export function queuePhotoForIndexing(filename: string, priority: 'high' | 'normal' | 'low' = 'normal'): void {
  indexQueue.addToQueue(filename, priority);
}

/**
 * Queue multiple photos
 */
export function queueMultiplePhotos(filenames: string[], priority: 'high' | 'normal' | 'low' = 'normal'): void {
  indexQueue.addMultipleToQueue(filenames, priority);
}

/**
 * Get queue status
 */
export function getQueueStatus() {
  return indexQueue.getStatus();
}
