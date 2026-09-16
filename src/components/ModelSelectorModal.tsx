import React, { useState } from 'react';
import {
  X,
  Check,
  Sparkles,
  Key,
  Clock,
  AlertTriangle,
  ChevronRight,
  Shield,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isAccountInCooldown, getRemainingCooldownString } from '../lib/aiConfig';
import { AIProvider } from '../types';
import { ModalOverlayContainer } from './ModalOverlayContainer';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({ isOpen, onClose }) => {
  const {
    availableModels,
    activeModelId,
    setActiveModelId,
    aiAccounts,
    switchAccount,
    clearCooldown,
    navigateTo,
    showToast,
  } = useApp();

  const [selectedProviderTab, setSelectedProviderTab] = useState<AIProvider | 'all'>('all');

  if (!isOpen) return null;

  // Filter to only external AI tool accounts available for delegation
  const externalModels = availableModels.filter((m) => m.provider !== 'axon' && m.id !== 'axon-offline-core');
  const currentModel =
    externalModels.find((m) => m.id === activeModelId) ||
    externalModels[0] ||
    availableModels[0];

  const filteredModels =
    selectedProviderTab === 'all'
      ? externalModels
      : externalModels.filter((m) => m.provider === selectedProviderTab);

  const providerAccounts = currentModel
    ? aiAccounts.filter((a) => a.provider === currentModel.provider)
    : [];

  const handleSelectModel = (modelId: string) => {
    setActiveModelId(modelId);
    showToast('Delegation model switched');
  };

  const handleManualSwitch = async (accountLabel: string) => {
    if (!currentModel) return;
    const result = await switchAccount(accountLabel, currentModel.provider);
    if (result.success) {
      onClose();
    }
  };

  const hasAnyExternalAccounts = aiAccounts.some((a) => a.provider !== 'axon');

  return (
    <ModalOverlayContainer
      isOpen={isOpen}
      onClose={onClose}
      id="model-selector-modal"
      maxWidth="md"
      ariaLabel="External AI Delegation Model and Account Selector"
      className="p-4 sm:p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white" />
          <div>
            <h3 className="text-sm font-bold text-white">External AI Delegation Tools</h3>
            <p className="text-[11px] text-neutral-400">External AI tool accounts available for sub-task delegation</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Close Model Engine"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {!hasAnyExternalAccounts ? (
        <div className="py-8 px-4 text-center rounded-2xl bg-neutral-950/70 border border-neutral-800/80 space-y-3 my-2">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-300">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white">No External AI Tools Connected</h4>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
              AXON operates as a unified intelligence. No external accounts are pre-added. You can add external tools (Gemini, Claude, ChatGPT) to delegate sub-tasks.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigateTo('settings');
              }}
              className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors inline-flex items-center gap-2 shadow-sm"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Add AI Account in Settings</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Provider Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800 shrink-0">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'gemini', label: 'Gemini' },
                { id: 'claude', label: 'Claude' },
                { id: 'chatgpt', label: 'ChatGPT' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedProviderTab(tab.id)}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all text-center ${
                  selectedProviderTab === tab.id
                    ? 'bg-neutral-800 text-white font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto space-y-4 pr-1 flex-1 min-h-0">
            {/* Models List */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Select External Delegation Model
              </p>

              <div className="space-y-1.5">
                {filteredModels.map((model) => {
                  const isSelected = model.id === activeModelId;
                  const activeAccountForModel = aiAccounts.find(
                    (a) => a.provider === model.provider && a.isActive
                  );
                  const hasKey =
                    Boolean(activeAccountForModel?.apiKey) || model.provider === 'gemini';
                  const inCooldown = isAccountInCooldown(activeAccountForModel);

                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => handleSelectModel(model.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-neutral-800/90 border-neutral-600 shadow-md ring-1 ring-neutral-500/30'
                          : 'bg-neutral-950/60 border-neutral-800/80 hover:bg-neutral-800/40 hover:border-neutral-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{model.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {model.badge}
                          </span>
                          {inCooldown && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {getRemainingCooldownString(activeAccountForModel) || 'Cooldown'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 line-clamp-1">{model.description}</p>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-500 pt-0.5">
                          <span>Provider: {model.providerName}</span>
                          <span>•</span>
                          <span>
                            Account: {activeAccountForModel?.label || 'Not Connected'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-0.5">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-neutral-700" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accounts for Active Provider */}
            <div className="pt-2 border-t border-neutral-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Stored Accounts for {currentModel?.providerName || 'Provider'}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    Manual account switching summarizes context and hands off to new session
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigateTo('settings');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Manage Keys</span>
                </button>
              </div>

              <div className="space-y-2">
                {providerAccounts.length === 0 ? (
                  <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 text-center text-xs text-neutral-400">
                    No accounts saved for this provider. Add one in Settings &gt; AI Accounts.
                  </div>
                ) : (
                  providerAccounts.map((account) => {
                    const inCooldown = isAccountInCooldown(account);
                    const cooldownStr = getRemainingCooldownString(account);

                    return (
                      <div
                        key={account.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          account.isActive
                            ? 'bg-neutral-800/80 border-neutral-700'
                            : 'bg-neutral-950/60 border-neutral-800/80'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white">{account.label}</span>
                            {account.isActive && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Active
                              </span>
                            )}
                            {account.apiKey ? (
                              <span className="text-[10px] text-neutral-500 font-mono">
                                {account.apiKey.length > 8
                                  ? `••••${account.apiKey.slice(-4)}`
                                  : '••••••••'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-500">
                                {account.provider === 'gemini' ? 'Workspace Key' : 'No Key Set'}
                              </span>
                            )}
                          </div>

                          {inCooldown && (
                            <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Limit reached ({cooldownStr})</span>
                              <button
                                type="button"
                                onClick={() => clearCooldown(account.id)}
                                className="underline ml-1 text-neutral-400 hover:text-white"
                              >
                                Reset
                              </button>
                            </div>
                          )}
                        </div>

                        {!account.isActive && (
                          <button
                            type="button"
                            onClick={() => handleManualSwitch(account.label)}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition-colors flex items-center gap-1 shrink-0"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Switch</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <p className="text-[10px] text-neutral-500 italic pt-1">
                Tip: You can also switch accounts naturally by typing e.g. "log into account B" directly into chat.
              </p>
            </div>
          </div>
        </>
      )}

        {/* Footer info */}
        <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400 shrink-0">
          <span>Official API routing • Zero website automation</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 transition-colors"
          >
            Done
          </button>
        </div>
    </ModalOverlayContainer>
  );
};
