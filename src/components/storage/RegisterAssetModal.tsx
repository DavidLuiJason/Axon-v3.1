import React, { useState } from 'react';
import { X, FilePlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AssetCategory, SaveMode } from '../../types';
import { ModalOverlayContainer } from '../ModalOverlayContainer';

interface RegisterAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RegisterAssetModal: React.FC<RegisterAssetModalProps> = ({ isOpen, onClose }) => {
  const { registerAssetInManifest } = useApp();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('user_file');
  const [sizeMb, setSizeMb] = useState(10);
  const [saveMode, setSaveMode] = useState<SaveMode>('archive');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const bytes = sizeMb * 1024 * 1024;
    registerAssetInManifest({
      name: name.trim(),
      category,
      storageLocation: `/local/${category}/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.dat`,
      mimeType: 'application/octet-stream',
      originalSizeBytes: bytes,
      storedSizeBytes: saveMode === 'archive' ? bytes : Math.round(bytes * 0.35),
      saveMode,
      isOriginalPreserved: saveMode === 'archive',
      qualityState: saveMode === 'archive' ? 'lossless' : 'downsampled',
      knowledgeStatus: 'not_applicable',
    });

    onClose();
  };

  return (
    <ModalOverlayContainer
      isOpen={isOpen}
      onClose={onClose}
      id="register-asset-modal"
      maxWidth="md"
      ariaLabel="Register Asset in Manifest"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4 text-white flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <FilePlus className="w-4 h-4 text-neutral-300" />
            <h2 className="text-sm font-bold">Register Asset in Manifest</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-neutral-400 mb-1">Asset Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Custom Documentation or Video Cache"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="block text-neutral-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-white"
            >
              <option value="user_file">User File</option>
              <option value="knowledge_pack">Knowledge Pack</option>
              <option value="model">AI Model</option>
              <option value="cache">Cache</option>
              <option value="system">System</option>
            </select>
          </div>

          <div>
            <label className="block text-neutral-400 mb-1">Original Size (MB)</label>
            <input
              type="number"
              min={1}
              max={5000}
              value={sizeMb}
              onChange={(e) => setSizeMb(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="block text-neutral-400 mb-1">Storage Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSaveMode('archive')}
                className={`p-2 rounded-xl border text-center transition-colors ${
                  saveMode === 'archive'
                    ? 'bg-white text-black font-semibold'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                }`}
              >
                Archive (Lossless)
              </button>
              <button
                type="button"
                onClick={() => setSaveMode('space_saver')}
                className={`p-2 rounded-xl border text-center transition-colors ${
                  saveMode === 'space_saver'
                    ? 'bg-white text-black font-semibold'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                }`}
              >
                Space-Saver (Lossy)
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors"
          >
            Register
          </button>
        </div>
      </form>
    </ModalOverlayContainer>
  );
};
