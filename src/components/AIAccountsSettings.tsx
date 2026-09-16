import React, { useState } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  Cpu,
  Bot,
  Zap,
  Copy,
  ChevronRight,
  X,
  HelpCircle,
  Search,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  isAccountInCooldown,
  getRemainingCooldownString,
  EXTERNAL_AI_CATALOG,
} from '../lib/aiConfig';
import { AIAccount, AIModelOption, AIProvider } from '../types';
import { ModalOverlayContainer } from './ModalOverlayContainer';

export const AIAccountsSettings: React.FC = () => {
  const {
    availableModels,
    activeModelId,
    setActiveModelId,
    aiAccounts,
    addAIAccount,
    updateAIAccount,
    deleteAIAccount,
    clearCooldown,
    switchAccount,
    requestConfirmation,
    showToast,
  } = useApp();

  // Modals for editing key & adding new account
  const [editingAccount, setEditingAccount] = useState<AIAccount | null>(null);
  const [tempApiKey, setTempApiKey] = useState('');
  const [isTempKeyVisible, setIsTempKeyVisible] = useState(false);

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [newProvider, setNewProvider] = useState<AIProvider>('gemini');
  const [newLabel, setNewLabel] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [isNewKeyVisible, setIsNewKeyVisible] = useState(false);

  // Filtered catalog for Search-and-Add flow
  const filteredCatalog = EXTERNAL_AI_CATALOG.filter((m) => {
    if (!catalogSearchQuery.trim()) return true;
    const q = catalogSearchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q) ||
      m.providerName.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      (m.badge && m.badge.toLowerCase().includes(q))
    );
  });

  const handleOpenAddModal = (presetModel?: AIModelOption) => {
    if (presetModel) {
      setNewProvider(presetModel.provider);
      setNewLabel(`My ${presetModel.name}`);
    } else {
      setNewProvider('gemini');
      setNewLabel('');
    }
    setNewApiKey('');
    setCatalogSearchQuery('');
    setIsNewKeyVisible(false);
    setIsAddingAccount(true);
  };

  // Active intelligence model selection
  const handleSelectModel = (model: AIModelOption) => {
    setActiveModelId(model.id);
    if (model.provider !== 'axon') {
      const providerAcc =
        aiAccounts.find((a) => a.provider === model.provider && a.isActive) ||
        aiAccounts.find((a) => a.provider === model.provider);
      if (providerAcc) {
        switchAccount(providerAcc.label, providerAcc.provider);
      }
    }
    showToast(`Active model: ${model.name}`);
  };

  // Account activation / switching
  const handleSelectAccount = async (account: AIAccount) => {
    const res = await switchAccount(account.label, account.provider);
    if (res.success) {
      showToast(`Switched to ${account.label}`);
    }
  };

  // Open Edit API Key dialog
  const handleOpenEditKey = (account: AIAccount) => {
    setEditingAccount(account);
    setTempApiKey(account.apiKey || '');
    setIsTempKeyVisible(false);
  };

  const handleSaveKey = () => {
    if (!editingAccount) return;
    updateAIAccount(editingAccount.id, { apiKey: tempApiKey.trim() });
    showToast(`API key updated for ${editingAccount.label}`);
    setEditingAccount(null);
  };

  // Confirm-before-delete account
  const handleDeleteAccount = (account: AIAccount) => {
    requestConfirmation({
      title: 'Delete AI Account',
      message: `Are you sure you want to delete "${account.label}"? Any credentials and session links saved for this account will be removed.`,
      confirmLabel: 'Delete Account',
      danger: true,
      onConfirm: () => {
        deleteAIAccount(account.id);
        showToast(`Deleted ${account.label}`);
      },
    });
  };

  // Add new account submit
  const handleAddAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      showToast('Please enter an account label');
      return;
    }

    const isFirst = aiAccounts.length === 0;

    addAIAccount({
      provider: newProvider,
      label: newLabel.trim(),
      apiKey: newApiKey.trim(),
      isActive: isFirst ? true : false,
      isRateLimited: false,
    });

    setIsAddingAccount(false);
    setNewLabel('');
    setNewApiKey('');
    showToast(`Added account "${newLabel.trim()}"`);
  };

  const getProviderIcon = (provider: AIProvider) => {
    switch (provider) {
      case 'axon':
        return <Cpu className="w-4 h-4" />;
      case 'gemini':
        return <Sparkles className="w-4 h-4" />;
      case 'claude':
        return <Bot className="w-4 h-4" />;
      case 'chatgpt':
        return <Zap className="w-4 h-4" />;
      default:
        return <Key className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: External Delegation Models */}
      <div className="space-y-2.5">
        <div className="px-1">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            External Delegation Models
          </h3>
          <p className="text-[11px] text-neutral-400">
            External AI tool accounts available for specialized sub-task delegation
          </p>
        </div>

        <div className="rounded-2xl bg-neutral-900/40 border border-neutral-800/80 overflow-hidden">
          {aiAccounts.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-400">
              No external delegation models connected. Add an external tool below to enable routing.
            </div>
          ) : (
            availableModels
              .filter((m) => m.provider !== 'axon' && m.id !== 'axon-offline-core')
              .map((model) => {
                const isModelActive = activeModelId === model.id;

                // Find matching account if applicable
                const relatedAccount =
                  aiAccounts.find((a) => a.provider === model.provider && a.isActive) ||
                  aiAccounts.find((a) => a.provider === model.provider);

                return (
                  <div
                    key={model.id}
                    onClick={() => handleSelectModel(model)}
                    className={`w-full flex items-center justify-between p-4 hover:bg-neutral-800/40 transition-colors text-left cursor-pointer group ${
                      isModelActive ? 'bg-neutral-850/40' : ''
                    }`}
                  >
                    {/* Left: Icon, Title, Subtitle, Badge */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                      <div
                        className={`p-2 rounded-xl transition-colors shrink-0 ${
                          isModelActive
                            ? 'bg-white text-black'
                            : 'bg-neutral-800/80 text-neutral-300 group-hover:text-white'
                        }`}
                      >
                        {getProviderIcon(model.provider)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-white truncate">{model.name}</p>
                          {model.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/60 font-mono">
                              {model.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {model.description}
                        </p>
                      </div>
                    </div>

                    {/* Right: Controls & Active Indicator */}
                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* API Key action for cloud models */}
                      {model.provider !== 'axon' && relatedAccount && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditKey(relatedAccount)}
                          title={`Manage API Key for ${model.name}`}
                          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                      )}

                      {/* Active selection indicator */}
                      <button
                        type="button"
                        onClick={() => handleSelectModel(model)}
                        title={isModelActive ? 'Active model' : 'Activate model'}
                        className="p-1"
                      >
                        {isModelActive ? (
                          <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center shadow-sm">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-neutral-700 group-hover:border-neutral-400 transition-colors" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* SECTION 2: Saved AI Accounts & Credentials */}
      <div className="space-y-2.5">
        <div className="px-1 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Connected Accounts & API Keys
            </h3>
            <p className="text-[11px] text-neutral-400">
              Manage saved provider credentials and multi-account switching
            </p>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
            {aiAccounts.length} {aiAccounts.length === 1 ? 'account' : 'accounts'}
          </span>
        </div>

        <div className="rounded-2xl bg-neutral-900/40 border border-neutral-800/80 overflow-hidden">
          {aiAccounts.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                No external AI accounts are pre-populated. Connect an external provider (Gemini, Claude, ChatGPT) to enable sub-task delegation.
              </p>
              <button
                type="button"
                onClick={() => handleOpenAddModal()}
                className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Search & Add AI Tool</span>
              </button>
            </div>
          ) : (
            aiAccounts.map((account) => {
              const inCooldown = isAccountInCooldown(account);
              const cooldownStr = inCooldown ? getRemainingCooldownString(account) : null;
              const isMaskedKey =
                account.apiKey && account.apiKey.length > 8
                  ? `••••••••${account.apiKey.slice(-4)}`
                  : account.apiKey
                  ? '••••••••'
                  : 'Pre-connected via server';

              return (
                <div
                  key={account.id}
                  onClick={() => handleSelectAccount(account)}
                  className={`w-full flex items-center justify-between p-4 hover:bg-neutral-800/40 transition-colors text-left cursor-pointer group ${
                    account.isActive ? 'bg-neutral-850/40' : ''
                  }`}
                >
                  {/* Left: Icon, Label, Provider / Key Status */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                    <div
                      className={`p-2 rounded-xl transition-colors shrink-0 ${
                        account.isActive
                          ? 'bg-white text-black'
                          : 'bg-neutral-800/80 text-neutral-300 group-hover:text-white'
                      }`}
                    >
                      {getProviderIcon(account.provider)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-white truncate">{account.label}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/60 font-mono">
                          {account.provider.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5 font-mono">
                        {isMaskedKey}
                      </p>

                      {/* Cooldown Alert */}
                      {inCooldown && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-300">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Cooldown: {cooldownStr} remaining</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearCooldown(account.id);
                              showToast('Cooldown reset');
                            }}
                            className="ml-1 underline text-amber-200 hover:text-white"
                          >
                            Reset Timer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Working controls (Edit Key, Delete, Active indicator) */}
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Edit Key Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditKey(account)}
                      title="Edit API Key"
                      className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    >
                      <Key className="w-4 h-4" />
                    </button>

                    {/* Delete Account Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(account)}
                      title="Delete Account"
                      className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Select / Active Account Indicator */}
                    <button
                      type="button"
                      onClick={() => handleSelectAccount(account)}
                      title={account.isActive ? 'Active account' : 'Switch to this account'}
                      className="p-1"
                    >
                      {account.isActive ? (
                        <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center shadow-sm">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-neutral-700 group-hover:border-neutral-400 transition-colors" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Add Account Row */}
          {aiAccounts.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="w-full flex items-center justify-between p-4 hover:bg-neutral-800/40 transition-colors text-left group border-t border-neutral-800/60"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-neutral-800/80 text-neutral-300 group-hover:text-white">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Add AI Account</p>
                  <p className="text-[11px] text-neutral-400">
                    Connect Gemini, Claude, or ChatGPT with your API key
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 3: Account Switching Guide */}
      <div className="p-4 rounded-2xl bg-neutral-900/20 border border-neutral-800/60 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-neutral-400" />
          <p className="font-semibold text-neutral-300">In-Chat Account Switching Commands</p>
        </div>
        <p className="text-neutral-400 text-[11px] leading-relaxed">
          Switch stored accounts anytime during chat by typing or speaking natural commands:
        </p>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {['"log into account B"', '"switch to account B"', '"switch account to Account A"'].map(
            (cmd) => (
              <span
                key={cmd}
                className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono text-[10px]"
              >
                {cmd}
              </span>
            )
          )}
        </div>
        <p className="text-[10px] text-neutral-500 pt-0.5">
          AXON automatically transfers conversation context across account switches.
        </p>
      </div>

      {/* MODAL 1: Edit API Key Modal */}
      {editingAccount && (
        <ModalOverlayContainer
          isOpen={true}
          onClose={() => setEditingAccount(null)}
          id="edit-api-key-modal"
          maxWidth="sm"
          ariaLabel="Manage API Key"
          className="p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-neutral-800 text-white">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">
                  Manage Key • {editingAccount.label}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  {editingAccount.provider.toUpperCase()} Official API Authentication
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingAccount(null)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-neutral-300 mb-1.5 font-medium">API Key</label>
              <div className="relative flex items-center">
                <input
                  type={isTempKeyVisible ? 'text' : 'password'}
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder={
                    editingAccount.provider === 'gemini'
                      ? 'Pre-connected (or enter custom key AIzaSy...)'
                      : 'Enter API key'
                  }
                  className="w-full pl-3 pr-16 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono text-xs focus:outline-none focus:border-neutral-600"
                  autoFocus
                />
                <div className="absolute right-2 flex items-center gap-1">
                  {tempApiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(tempApiKey);
                        showToast('Key copied');
                      }}
                      title="Copy Key"
                      className="p-1 text-neutral-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsTempKeyVisible(!isTempKeyVisible)}
                    title={isTempKeyVisible ? 'Hide key' : 'Show key'}
                    className="p-1 text-neutral-400 hover:text-white transition-colors"
                  >
                    {isTempKeyVisible ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              {editingAccount.provider === 'gemini' && (
                <p className="text-[10px] text-neutral-500 mt-1">
                  Gemini is pre-connected with server environment credentials if left blank.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveKey}
                className="px-4 py-1.5 text-xs font-semibold bg-white text-black rounded-xl hover:bg-neutral-200 transition-colors"
              >
                Save Key
              </button>
            </div>
          </div>
        </ModalOverlayContainer>
      )}

      {/* MODAL 2: Add AI Account Modal */}
      {isAddingAccount && (
        <ModalOverlayContainer
          isOpen={true}
          onClose={() => setIsAddingAccount(false)}
          id="add-ai-account-modal"
          maxWidth="sm"
          ariaLabel="Add AI Account"
          className="p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-neutral-800 text-white">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">Add AI Account</h3>
                <p className="text-[11px] text-neutral-400">
                  Connect official generative AI provider endpoint
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingAccount(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddAccountSubmit} className="space-y-3.5 text-xs">
            {/* Quick search and select from external AI catalog */}
            <div>
              <label className="block text-neutral-300 mb-1.5 font-medium">
                Choose or Search Tool
              </label>
              <div className="relative flex items-center mb-2">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3" />
                <input
                  type="text"
                  placeholder="Search catalog (e.g. Gemini, Claude, GPT-4o)..."
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                {filteredCatalog.map((catModel) => {
                  const isSelected = newProvider === catModel.provider;
                  return (
                    <button
                      key={catModel.id}
                      type="button"
                      onClick={() => {
                        setNewProvider(catModel.provider);
                        if (!newLabel || newLabel.startsWith('My ')) {
                          setNewLabel(`My ${catModel.name}`);
                        }
                      }}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        isSelected
                          ? 'bg-neutral-800 border-neutral-600 text-white'
                          : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold truncate">{catModel.name}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 block truncate">
                        {catModel.providerName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 mb-1.5 font-medium">Provider</label>
              <select
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value as AIProvider)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-neutral-600"
              >
                <option value="gemini">Google Gemini</option>
                <option value="claude">Anthropic Claude</option>
                <option value="chatgpt">OpenAI ChatGPT</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-300 mb-1.5 font-medium">Account Label</label>
              <input
                type="text"
                placeholder="e.g. Account B (Secondary), Work Account"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-neutral-600 placeholder-neutral-500"
                required
              />
            </div>

            <div>
              <label className="block text-neutral-300 mb-1.5 font-medium">API Key</label>
              <div className="relative flex items-center">
                <input
                  type={isNewKeyVisible ? 'text' : 'password'}
                  placeholder="Paste official API key"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono focus:outline-none focus:border-neutral-600 placeholder-neutral-500"
                />
                <button
                  type="button"
                  onClick={() => setIsNewKeyVisible(!isNewKeyVisible)}
                  title={isNewKeyVisible ? 'Hide key' : 'Show key'}
                  className="absolute right-3 text-neutral-400 hover:text-white p-1"
                >
                  {isNewKeyVisible ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingAccount(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-white text-black rounded-xl hover:bg-neutral-200 transition-colors"
              >
                Save Account
              </button>
            </div>
          </form>
        </ModalOverlayContainer>
      )}
    </div>
  );
};
