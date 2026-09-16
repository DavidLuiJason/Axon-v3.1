import React from 'react';
import { useApp } from '../../context/AppContext';
import { AssetCategory } from '../../types';
import { formatBytes } from '../../lib/storageManifest';

interface StorageCategoryBreakdownProps {
  selectedCategory: AssetCategory | 'all';
  onSelectCategory: (category: AssetCategory | 'all') => void;
}

const CATEGORY_METADATA: Record<AssetCategory, { label: string; description: string }> = {
  model: { label: 'AI Models', description: 'Weights, embeddings, and runtime caches' },
  knowledge_pack: { label: 'Knowledge Packs', description: 'Offline scriptures, dictionaries, and references' },
  user_file: { label: 'User Files', description: 'Custom uploaded assets, images, and documents' },
  chat_history: { label: 'Chat Logs', description: 'Exported sessions and message journals' },
  cache: { label: 'Temporary Cache', description: 'Intermediary renders and build previews' },
  system: { label: 'System & WASM', description: 'Local Python/JS engine components' },
};

export const StorageCategoryBreakdown: React.FC<StorageCategoryBreakdownProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  const { storageBreakdown } = useApp();

  const categories = Object.keys(CATEGORY_METADATA) as AssetCategory[];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {categories.map((cat) => {
        const stored = storageBreakdown.categoryTotals[cat] || 0;
        const count = storageBreakdown.itemCounts[cat] || 0;
        const meta = CATEGORY_METADATA[cat];
        const isSelected = selectedCategory === cat;

        return (
          <button
            key={cat}
            type="button"
            onClick={() => onSelectCategory(isSelected ? 'all' : cat)}
            className={`p-4 rounded-xl border text-left transition-all space-y-2 ${
              isSelected
                ? 'bg-neutral-900 border-neutral-600 text-white'
                : 'bg-neutral-950/60 border-neutral-850 text-neutral-300 hover:border-neutral-700 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">{meta.label}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                {count} {count === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">{meta.description}</p>
            <div className="text-sm font-semibold text-white tracking-tight pt-1 font-mono">
              {formatBytes(stored)}
            </div>
          </button>
        );
      })}
    </div>
  );
};
