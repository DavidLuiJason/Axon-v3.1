import React from 'react';
import { HardDrive, Scissors, Sliders } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatBytes } from '../../lib/storageManifest';

interface StorageBudgetBarProps {
  onOpenBudgetModal: () => void;
  onOpenTrimModal: () => void;
}

export const StorageBudgetBar: React.FC<StorageBudgetBarProps> = ({
  onOpenBudgetModal,
  onOpenTrimModal,
}) => {
  const { storageBudget, storageBreakdown } = useApp();

  const usedBytes = storageBreakdown.totalStoredBytes;
  const budgetBytes = storageBudget.budgetBytes;
  const percentUsed = Math.min(100, Math.round((usedBytes / budgetBytes) * 100));

  const isNearLimit = percentUsed >= storageBudget.warningThresholdPercent;

  return (
    <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-neutral-300" />
          <span className="text-xs font-semibold text-white">Storage Capacity Telemetry</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenBudgetModal}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-neutral-400" />
            <span>Adjust Budget</span>
          </button>
          <button
            type="button"
            onClick={onOpenTrimModal}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <Scissors className="w-3.5 h-3.5 text-neutral-400" />
            <span>Trim Optimizer</span>
          </button>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-neutral-400 mb-2">
          <span>
            {formatBytes(usedBytes)} used of {formatBytes(budgetBytes, 0)} budget
          </span>
          <span className={`font-medium ${isNearLimit ? 'text-rose-400' : 'text-neutral-300'}`}>
            {percentUsed}%
          </span>
        </div>
        <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isNearLimit ? 'bg-rose-500' : 'bg-white'
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      </div>
    </div>
  );
};
