import React, { useState, useEffect, useMemo } from 'react';
import { X, HardDrive, ShieldCheck, Check, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatBytes, getDeviceAwarePresets } from '../../lib/storageManifest';
import { ModalOverlayContainer } from '../ModalOverlayContainer';

interface StorageOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  canDismiss?: boolean;
}

export const StorageOnboardingModal: React.FC<StorageOnboardingModalProps> = ({
  isOpen,
  onClose,
  canDismiss = true,
}) => {
  const { storageBudget, setStorageBudgetBytes, setHasCompletedStorageOnboarding, deviceStorageEstimate } = useApp();
  const [customGb, setCustomGb] = useState('');

  const presets = useMemo(() => getDeviceAwarePresets(deviceStorageEstimate), [deviceStorageEstimate]);

  useEffect(() => {
    if (isOpen) {
      const isPreset = presets.some((p) => p.bytes === storageBudget.budgetBytes);
      if (!isPreset && storageBudget.budgetBytes > 0) {
        setCustomGb((storageBudget.budgetBytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, ''));
      } else if (storageBudget.customLimitBytes && !isPreset) {
        setCustomGb((storageBudget.customLimitBytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, ''));
      } else {
        setCustomGb('');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectBudget = (bytes: number) => {
    setStorageBudgetBytes(bytes);
    setHasCompletedStorageOnboarding(true);
    onClose();
  };

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(customGb);
    if (!isNaN(val) && val > 0) {
      handleSelectBudget(Math.round(val * 1024 * 1024 * 1024));
    }
  };

  const handleDismiss = () => {
    const val = parseFloat(customGb);
    if (!isNaN(val) && val > 0) {
      handleSelectBudget(Math.round(val * 1024 * 1024 * 1024));
    } else {
      onClose();
    }
  };

  return (
    <ModalOverlayContainer
      isOpen={isOpen}
      onClose={canDismiss ? handleDismiss : () => {}}
      id="storage-onboarding-modal"
      maxWidth="md"
      ariaLabel="Storage Manifest Onboarding"
      className="p-6 space-y-4"
    >
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold text-xs shadow-sm">
            {formatBytes(storageBudget.budgetBytes, 0)}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Storage Manifest &amp; Device Budget</h2>
            <p className="text-[11px] text-neutral-400">Initialize device memory budget (editable later)</p>
          </div>
        </div>
        {canDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="text-xs text-neutral-300 leading-relaxed space-y-2">
        <p>
          AXON features a built-in <strong>Storage Manifest</strong> engine that actively audits every file, model, and cache against a user-defined quota.
        </p>
        <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800 text-[11px] text-neutral-400 flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <span>
            <strong>Core vs Removable:</strong> Essential system tools are protected and non-deletable (toggle-offable). Extra packs and models are modular, downloadable, and removable Play-Store style.
          </span>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-neutral-300">Choose Device Budget</label>
          <span className="text-[10px] text-neutral-400">{deviceStorageEstimate.calculationExplanation}</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {presets.map((preset) => {
            const isSelected = storageBudget.budgetBytes === preset.bytes;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSelectBudget(preset.bytes)}
                className={`w-full p-3 rounded-xl text-left transition-colors flex items-center justify-between border ${
                  isSelected
                    ? 'bg-white text-black border-white hover:bg-neutral-200'
                    : 'bg-neutral-900 hover:bg-neutral-850 text-white border-neutral-800'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold">{preset.label}</div>
                  <div className={`text-[11px] ${isSelected ? 'text-neutral-700' : 'text-neutral-400'}`}>
                    {preset.subtitle}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-black shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Option */}
      <form onSubmit={handleApplyCustom} className="flex gap-2 pt-1">
        <div className="relative flex-1">
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="2048"
            placeholder="Custom budget (e.g. 12)"
            value={customGb}
            onChange={(e) => setCustomGb(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-750 text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-white pr-10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-mono">
            GB
          </span>
        </div>
        <button
          type="submit"
          disabled={!customGb || isNaN(parseFloat(customGb))}
          className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white font-semibold text-xs border border-neutral-700 transition-colors"
        >
          Set Custom
        </button>
      </form>

      <div className="flex items-center gap-2 text-[11px] text-neutral-400 pt-1 shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Adjustable anytime in Settings &gt; Storage Diagnostics or via chat commands.</span>
      </div>
    </ModalOverlayContainer>
  );
};
