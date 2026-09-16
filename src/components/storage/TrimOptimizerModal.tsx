import React, { useState } from 'react';
import { X, Scissors, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatBytes } from '../../lib/storageManifest';
import { TrimCategoryPriority } from '../../types';
import { ModalOverlayContainer } from '../ModalOverlayContainer';

interface TrimOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrimOptimizerModal: React.FC<TrimOptimizerModalProps> = ({ isOpen, onClose }) => {
  const { trimStorageWithPlan, storageBudget } = useApp();
  const [result, setResult] = useState<{ itemsPruned: number; bytesFreed: number } | null>(null);

  if (!isOpen) return null;

  const handleExecuteTrim = () => {
    const res = trimStorageWithPlan();
    setResult(res);
  };

  return (
    <ModalOverlayContainer
      isOpen={isOpen}
      onClose={onClose}
      id="trim-optimizer-modal"
      maxWidth="md"
      ariaLabel="Trim Optimizer"
      className="p-5 space-y-4"
    >
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-neutral-300" />
          <h2 className="text-sm font-bold">Trim Optimizer</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

        {result ? (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="text-xs font-semibold text-emerald-300">
              Trim Complete: Freed {formatBytes(result.bytesFreed)} across {result.itemsPruned} items.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-4 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs text-neutral-300">
            <p>
              The Trim Optimizer scans your registered assets and prunes non-essential items in priority order:
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-neutral-400">
              {storageBudget.trimPriority.map((p) => (
                <li key={p} className="capitalize">
                  {p.replace(/_/g, ' ')}
                </li>
              ))}
            </ol>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTrim}
                className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Run Trim Now</span>
              </button>
            </div>
          </div>
        )}
    </ModalOverlayContainer>
  );
};
