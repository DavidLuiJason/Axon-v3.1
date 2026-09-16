import React, { useState } from 'react';
import {
  Trash2,
  RefreshCw,
  Wand2,
  Shield,
  AlertCircle,
  Power,
  PowerOff,
  Lock,
  Download,
  Eye,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AssetCategory, AssetManifestItem } from '../../types';
import { formatBytes } from '../../lib/storageManifest';
import { AssetFileViewerModal } from './AssetFileViewerModal';

interface AssetManifestTableProps {
  categoryFilter: AssetCategory | 'all';
  onSelectCategory: (category: AssetCategory | 'all') => void;
  onOpenRegisterModal: () => void;
}

export const AssetManifestTable: React.FC<AssetManifestTableProps> = ({
  categoryFilter,
  onSelectCategory,
  onOpenRegisterModal,
}) => {
  const {
    assetManifest,
    setAssetSaveMode,
    revertOrEnhanceAssetItem,
    deleteAssetFromManifest,
    toggleAssetEnabled,
    messages,
  } = useApp();

  const [previewItem, setPreviewItem] = useState<AssetManifestItem | null>(null);

  const getAssetDataUrl = (item: AssetManifestItem | null): string | undefined => {
    if (!item) return undefined;
    if (item.metadata?.dataUrl) return item.metadata.dataUrl;
    if (item.metadata?.previewUrl) return item.metadata.previewUrl;
    if (messages && messages.length > 0) {
      for (const msg of messages) {
        const atts = msg.attachments || (msg.attachment ? [msg.attachment] : []);
        const found = atts.find(
          (a) =>
            a &&
            (a.name === item.name ||
              item.storageLocation.endsWith(a.name) ||
              (a.name && item.name.includes(a.name)))
        );
        if (found?.dataUrl) return found.dataUrl;
      }
    }
    return undefined;
  };

  const filteredItems = React.useMemo(() => {
    const seenIds = new Set<string>();
    return assetManifest.filter((item) => {
      if (!item) return false;
      const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
      if (!matchCategory) return false;
      const itemId = item.id || `asset-${item.name}`;
      if (seenIds.has(itemId)) return false;
      seenIds.add(itemId);
      return true;
    });
  }, [assetManifest, categoryFilter]);

  return (
    <div className="space-y-4">
      {/* Category Pill Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {(['all', 'system', 'model', 'knowledge_pack', 'user_file', 'chat_history', 'cache'] as const).map(
          (cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap text-xs ${
                categoryFilter === cat
                  ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60 border border-transparent'
              }`}
            >
              {cat === 'all' ? 'All Assets' : cat.replace('_', ' ')}
            </button>
          )
        )}
      </div>

      {filteredItems.length === 0 ? (
        <div className="p-8 rounded-2xl bg-neutral-900/30 border border-neutral-800/80 text-center text-neutral-400 space-y-2.5">
          <p className="text-xs">No assets registered in this category.</p>
          <button
            type="button"
            onClick={onOpenRegisterModal}
            className="px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors"
          >
            Register New Asset
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item, idx) => (
            <div
              key={item.id ? `${item.id}-${idx}` : `asset-${idx}`}
              onClick={() => setPreviewItem(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPreviewItem(item);
                }
              }}
              className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-xs cursor-pointer ${
                item.isEnabled === false
                  ? 'bg-neutral-950/40 border-neutral-900 opacity-75 hover:border-neutral-800'
                  : 'bg-neutral-950/60 border-neutral-850 hover:border-neutral-750 hover:bg-neutral-900/30'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white hover:underline">{item.name}</span>
                  {item.isCore ? (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                      <Shield className="w-2.5 h-2.5" /> Core (Non-deletable)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
                      <Download className="w-2.5 h-2.5" /> Removable
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      item.saveMode === 'archive'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    }`}
                  >
                    {item.saveMode === 'archive' ? 'Archive (Lossless)' : 'Space-Saver (Lossy)'}
                  </span>
                  {item.isEnabled === false && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                      Toggled Off
                    </span>
                  )}
                  {item.knowledgeStatus === 'stale' && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      <AlertCircle className="w-2.5 h-2.5" /> Stale
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-400 flex items-center gap-2 flex-wrap">
                  <span>{item.storageLocation}</span>
                  <span className="text-neutral-600">&bull;</span>
                  <span className="font-mono text-neutral-200">{formatBytes(item.storedSizeBytes)}</span>
                  {item.originalSizeBytes > item.storedSizeBytes && (
                    <span className="text-neutral-500 line-through font-mono">
                      {formatBytes(item.originalSizeBytes)}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-[11px] text-neutral-500 leading-relaxed max-w-xl">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {/* Dedicated Tap to View / Inspect Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewItem(item);
                  }}
                  title="Open / Preview Asset"
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 hover:text-white border border-neutral-800 transition-colors flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-neutral-400" />
                  <span>View</span>
                </button>

                {/* Toggle On/Off Switch (Works for Core and Removable alike) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAssetEnabled(item.id);
                  }}
                  title={item.isEnabled === false ? 'Enable component' : 'Toggle component off'}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                    item.isEnabled === false
                      ? 'bg-neutral-900 text-neutral-400 border-neutral-750 hover:text-white hover:border-neutral-600'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  {item.isEnabled === false ? (
                    <>
                      <PowerOff className="w-3 h-3 text-neutral-400" />
                      <span>Disabled</span>
                    </>
                  ) : (
                    <>
                      <Power className="w-3 h-3 text-emerald-400" />
                      <span>Active</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssetSaveMode(
                      item.id,
                      item.saveMode === 'archive' ? 'space_saver' : 'archive'
                    );
                  }}
                  title="Toggle Save Mode"
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 hover:text-white border border-neutral-800 transition-colors"
                >
                  {item.saveMode === 'archive' ? 'Make Space-Saver' : 'Make Archive'}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    revertOrEnhanceAssetItem(item.id);
                  }}
                  title="Enhance approximation or restore lossless"
                  className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                </button>

                {item.isCore ? (
                  <span
                    title="Core component cannot be deleted (protected system asset)"
                    className="p-1.5 rounded-lg bg-neutral-900/60 text-neutral-600 border border-neutral-850 cursor-not-allowed"
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAssetFromManifest(item.id);
                    }}
                    title="Delete / Uninstall Asset"
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-rose-950 text-neutral-400 hover:text-rose-300 border border-neutral-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tap-to-View Modal matching file type */}
      <AssetFileViewerModal
        isOpen={Boolean(previewItem)}
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        dataUrl={getAssetDataUrl(previewItem)}
      />
    </div>
  );
};
