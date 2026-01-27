import { useState } from 'react';
import { useMemories } from '../hooks/useMemories';
import { MemoryCard } from './MemoryCard';
import { LoadingSpinner } from './LoadingSpinner';
import type { Memory } from '../types/memory';

interface MemoriesViewProps {
  onMemoryClick: (memory: Memory) => void;
}

export function MemoriesView({ onMemoryClick }: MemoriesViewProps) {
  const { memories, loading, error, dismissMemory, generateDaily } = useMemories();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateDaily = async () => {
    if (confirm('Generate new "On This Day" memories? This may take a moment.')) {
      setIsGenerating(true);
      try {
        await generateDaily();
      } catch (err) {
        console.error('Failed to generate memories:', err);
        alert('Failed to generate memories. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handleDismiss = async (memoryId: number) => {
    try {
      await dismissMemory(memoryId);
    } catch (err) {
      console.error('Failed to dismiss memory:', err);
      alert('Failed to dismiss memory. Please try again.');
    }
  };

  if (loading && memories.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error loading memories</h2>
        <p>{error}</p>
      </div>
    );
  }

  const activeMemories = memories.filter(m => !m.is_dismissed);

  return (
    <div className="memories-view">
      <div className="memories-header">
        <div className="memories-title">
          <h2>Memories</h2>
          <p className="memories-stats">
            {activeMemories.length} {activeMemories.length === 1 ? 'memory' : 'memories'}
          </p>
        </div>
        <div className="memories-actions">
          <button
            className="btn-primary"
            onClick={handleGenerateDaily}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Daily Memories'}
          </button>
        </div>
      </div>

      {activeMemories.length === 0 ? (
        <div className="memories-empty">
          <p>No memories yet</p>
          <p className="empty-hint">
            Click "Generate Daily Memories" to create your first memory collection
          </p>
        </div>
      ) : (
        <div className="memories-grid">
          {activeMemories.map(memory => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onClick={onMemoryClick}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
