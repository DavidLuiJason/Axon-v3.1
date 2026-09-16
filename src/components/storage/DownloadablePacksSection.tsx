import React from 'react';
import { Download, Check, Trash2, Power, PowerOff, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  AVAILABLE_DOWNLOADABLE_PACKS,
  formatBytes,
  checkStorageBudget,
} from '../../lib/storageManifest';

export const DownloadablePacksSection: React.FC = () => {
  const {
    assetManifest,
    storageBudget,
    storageBreakdown,
    addDownloadablePack,
    removeDownloadablePack,
    toggleAssetEnabled,
  } = useApp();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-400">
        <span>
          Downloadable and removable offline reference packs (Play-Store style modular management).
        </span>
        <span className="font-mono text-neutral-300 shrink-0">
          Free Budget: {formatBytes(Math.max(0, storageBudget.budgetBytes - storageBreakdown.totalStoredBytes))}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {AVAILABLE_DOWNLOADABLE_PACKS.map((pack) => {
          const installedAsset = assetManifest.find((a) => a.id === pack.id);
          const isInstalled = !!installedAsset;
          const isEnabled = installedAsset?.isEnabled !== false;

          const budgetCheck = checkStorageBudget(
            storageBreakdown.totalStoredBytes,
            pack.sizeBytes,
            storageBudget.budgetBytes,
            storageBudget.warningThresholdPercent
          );

          return (
            <div
              key={pack.id}
              className={`p-4 rounded-xl border transition-colors flex flex-col justify-between space-y-3.5 ${
                isInstalled
                  ? isEnabled
                    ? 'bg-neutral-950/70 border-neutral-800'
                    : 'bg-neutral-950/40 border-neutral-900 opacity-80'
                  : 'bg-neutral-950/60 border-neutral-850 hover:border-neutral-800'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-white">{pack.name}</h3>
                  <span className="text-xs font-mono text-neutral-400 shrink-0">
                    {formatBytes(pack.sizeBytes)}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{pack.description}</p>
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    Downloadable Pack
                  </span>
                  {isInstalled && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        isEnabled
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      }`}
                    >
                      {isEnabled ? 'Active' : 'Disabled'}
                    </span>
                  )}
                  {!isInstalled && budgetCheck.wouldExceedBudget && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      <AlertCircle className="w-2.5 h-2.5" /> Exceeds Budget
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2.5 border-t border-neutral-800/60 flex items-center justify-between gap-2">
                {isInstalled ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      <span>Installed</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Toggle On/Off */}
                      <button
                        type="button"
                        onClick={() => toggleAssetEnabled(pack.id)}
                        title={isEnabled ? 'Disable pack' : 'Enable pack'}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                          isEnabled
                            ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-750'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/20'
                        }`}
                      >
                        {isEnabled ? (
                          <>
                            <PowerOff className="w-3 h-3 text-neutral-400" />
                            <span>Disable</span>
                          </>
                        ) : (
                          <>
                            <Power className="w-3 h-3 text-emerald-400" />
                            <span>Enable</span>
                          </>
                        )}
                      </button>

                      {/* Uninstall / Remove */}
                      <button
                        type="button"
                        onClick={() => removeDownloadablePack(pack.id)}
                        title="Uninstall pack (frees storage space)"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-rose-950 text-neutral-400 hover:text-rose-300 border border-neutral-800 transition-colors text-xs"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Uninstall</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between gap-2">
                    <span className="text-[11px] text-neutral-500">
                      {budgetCheck.wouldExceedBudget ? 'Not enough storage space' : 'Ready to install'}
                    </span>
                    <button
                      type="button"
                      disabled={budgetCheck.wouldExceedBudget}
                      onClick={() => addDownloadablePack(pack)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-colors ${
                        budgetCheck.wouldExceedBudget
                          ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-750'
                          : 'bg-white text-black hover:bg-neutral-200'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" /> Download Pack
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
