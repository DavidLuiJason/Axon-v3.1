import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Wrench,
  Code2,
  FileText,
  Settings,
  Zap,
  Video,
  HardDrive,
  Type,
  Calculator,
  ArrowRightLeft,
  Palette,
  Image as ImageIcon,
  FileUp,
  Bookmark,
  Sparkles,
  Bell,
  User,
  SlidersHorizontal,
  X,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Star,
  Heart,
  Flame,
  Terminal,
  Send,
  ExternalLink,
} from 'lucide-react';
import { ScreenId } from '../types';
import { useApp } from '../context/AppContext';
import { ModalOverlayContainer } from './ModalOverlayContainer';

export interface ShortcutItem {
  id: string;
  label: string;
  screenId?: ScreenId;
  iconName: string;
  isCustom?: boolean;
  actionType?: 'screen' | 'prompt' | 'quick';
  promptText?: string;
  quickAction?: 'workspace' | 'clear' | 'new_project';
}

export const BUILT_IN_SHORTCUTS: ShortcutItem[] = [
  { id: 'axon', label: 'Chat', screenId: 'axon', iconName: 'MessageSquare', actionType: 'screen' },
  { id: 'tools', label: 'Tools', screenId: 'tools', iconName: 'Wrench', actionType: 'screen' },
  { id: 'code', label: 'Code', screenId: 'code', iconName: 'Code2', actionType: 'screen' },
  { id: 'notes', label: 'Library', screenId: 'notes', iconName: 'FileText', actionType: 'screen' },
  { id: 'settings', label: 'Settings', screenId: 'settings', iconName: 'Settings', actionType: 'screen' },
  { id: 'automation', label: 'Automation', screenId: 'automation', iconName: 'Zap', actionType: 'screen' },
  { id: 'video_editor', label: 'Video Editor', screenId: 'video_editor', iconName: 'Video', actionType: 'screen' },
  { id: 'storage', label: 'Storage', screenId: 'storage', iconName: 'HardDrive', actionType: 'screen' },
  { id: 'tool_text', label: 'Text Tools', screenId: 'tool_text', iconName: 'Type', actionType: 'screen' },
  { id: 'tool_calc', label: 'Calculator', screenId: 'tool_calc', iconName: 'Calculator', actionType: 'screen' },
  { id: 'tool_units', label: 'Units', screenId: 'tool_units', iconName: 'ArrowRightLeft', actionType: 'screen' },
  { id: 'tool_colors', label: 'Colors', screenId: 'tool_colors', iconName: 'Palette', actionType: 'screen' },
  { id: 'tool_images', label: 'Images', screenId: 'tool_images', iconName: 'ImageIcon', actionType: 'screen' },
  { id: 'tool_files', label: 'Files', screenId: 'tool_files', iconName: 'FileUp', actionType: 'screen' },
  { id: 'tool_bible', label: 'Bible', screenId: 'tool_bible', iconName: 'Bookmark', actionType: 'screen' },
  { id: 'tool_speech_rate', label: 'Speech Rate', screenId: 'tool_speech_rate', iconName: 'Sparkles', actionType: 'screen' },
  { id: 'notifications', label: 'Alerts', screenId: 'notifications', iconName: 'Bell', actionType: 'screen' },
  { id: 'account', label: 'Account', screenId: 'account', iconName: 'User', actionType: 'screen' },
];

export const AVAILABLE_ICONS = [
  'Sparkles',
  'Zap',
  'MessageSquare',
  'Code2',
  'Wrench',
  'FileText',
  'Settings',
  'Terminal',
  'Star',
  'Flame',
  'Heart',
  'Bookmark',
  'Calculator',
  'Type',
  'Palette',
  'Video',
  'HardDrive',
  'Send',
];

export function renderShortcutIcon(iconName: string, className = 'w-4 h-4') {
  switch (iconName) {
    case 'MessageSquare':
      return <MessageSquare className={className} />;
    case 'Wrench':
      return <Wrench className={className} />;
    case 'Code2':
      return <Code2 className={className} />;
    case 'FileText':
      return <FileText className={className} />;
    case 'Settings':
      return <Settings className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Video':
      return <Video className={className} />;
    case 'HardDrive':
      return <HardDrive className={className} />;
    case 'Type':
      return <Type className={className} />;
    case 'Calculator':
      return <Calculator className={className} />;
    case 'ArrowRightLeft':
      return <ArrowRightLeft className={className} />;
    case 'Palette':
      return <Palette className={className} />;
    case 'ImageIcon':
      return <ImageIcon className={className} />;
    case 'FileUp':
      return <FileUp className={className} />;
    case 'Bookmark':
      return <Bookmark className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Bell':
      return <Bell className={className} />;
    case 'User':
      return <User className={className} />;
    case 'Star':
      return <Star className={className} />;
    case 'Heart':
      return <Heart className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'Terminal':
      return <Terminal className={className} />;
    case 'Send':
      return <Send className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

interface ChatShortcutBarProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertPrompt?: (prompt: string) => void;
}

export const ChatShortcutBar: React.FC<ChatShortcutBarProps> = ({
  isOpen,
  onClose,
  onInsertPrompt,
}) => {
  const {
    navigateTo,
    setPaneViewState,
    showToast,
    createProject,
    openPanel,
    closePanel,
    isPanelOpen,
  } = useApp();

  // Custom shortcuts created by user
  const [customShortcuts, setCustomShortcuts] = useState<ShortcutItem[]>(() => {
    try {
      const saved = localStorage.getItem('axon_custom_shortcuts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Active shortcut IDs — NO 5-ITEM LIMIT! Can hold as many as user wants
  const [activeShortcutIds, setActiveShortcutIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('axon_active_shortcuts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return ['axon', 'tools', 'code', 'notes', 'settings', 'automation', 'tool_calc', 'tool_text'];
  });

  const [localEditModalOpen, setLocalEditModalOpen] = useState(false);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);

  const isEditModalOpen = isPanelOpen('customize-shortcuts') || localEditModalOpen;

  const handleOpenCustomize = () => {
    setLocalEditModalOpen(true);
    openPanel('customize-shortcuts');
  };

  const handleCloseCustomize = () => {
    setLocalEditModalOpen(false);
    setIsCreatingCustom(false);
    closePanel('customize-shortcuts');
  };

  // New custom shortcut form state
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('Sparkles');
  const [newActionType, setNewActionType] = useState<'prompt' | 'screen' | 'quick'>('prompt');
  const [newPromptText, setNewPromptText] = useState('');
  const [newScreenId, setNewScreenId] = useState<ScreenId>('tools');
  const [newQuickAction, setNewQuickAction] = useState<'workspace' | 'clear' | 'new_project'>('workspace');

  // Combined pool of all shortcuts
  const allShortcuts: ShortcutItem[] = [...BUILT_IN_SHORTCUTS, ...customShortcuts];

  // Save active shortcuts to localStorage
  const saveActiveShortcuts = (ids: string[]) => {
    setActiveShortcutIds(ids);
    try {
      localStorage.setItem('axon_active_shortcuts', JSON.stringify(ids));
    } catch {
      // ignore
    }
  };

  // Save custom shortcuts to localStorage
  const saveCustomShortcuts = (shortcuts: ShortcutItem[]) => {
    setCustomShortcuts(shortcuts);
    try {
      localStorage.setItem('axon_custom_shortcuts', JSON.stringify(shortcuts));
    } catch {
      // ignore
    }
  };

  const handleShortcutClick = (shortcut: ShortcutItem) => {
    if (shortcut.actionType === 'prompt' && shortcut.promptText) {
      if (onInsertPrompt) {
        onInsertPrompt(shortcut.promptText);
        showToast(`Inserted shortcut: "${shortcut.label}"`);
      }
      onClose();
      return;
    }

    if (shortcut.actionType === 'quick') {
      if (shortcut.quickAction === 'workspace') {
        setPaneViewState('workspace-only');
        showToast('Switched to Workspace');
      } else if (shortcut.quickAction === 'new_project') {
        createProject(`Project ${Date.now().toString().slice(-4)}`);
        showToast('Created new project');
      }
      onClose();
      return;
    }

    // Default: navigate to screen
    if (shortcut.screenId) {
      navigateTo(shortcut.screenId);
      onClose();
    }
  };

  // Toggle shortcut active status
  const handleToggleShortcut = (shortcutId: string) => {
    if (activeShortcutIds.includes(shortcutId)) {
      saveActiveShortcuts(activeShortcutIds.filter((id) => id !== shortcutId));
      showToast('Shortcut removed from quick bar');
    } else {
      saveActiveShortcuts([...activeShortcutIds, shortcutId]);
      showToast('Shortcut added to quick bar');
    }
  };

  // Create custom shortcut
  const handleCreateCustomShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      showToast('Please enter a shortcut name');
      return;
    }

    const customId = `custom_${Date.now()}`;
    const newShortcut: ShortcutItem = {
      id: customId,
      label: newLabel.trim(),
      iconName: newIcon,
      isCustom: true,
      actionType: newActionType,
      promptText: newActionType === 'prompt' ? newPromptText.trim() : undefined,
      screenId: newActionType === 'screen' ? newScreenId : undefined,
      quickAction: newActionType === 'quick' ? newQuickAction : undefined,
    };

    const updatedCustom = [...customShortcuts, newShortcut];
    saveCustomShortcuts(updatedCustom);
    saveActiveShortcuts([...activeShortcutIds, customId]);

    // Reset form
    setNewLabel('');
    setNewPromptText('');
    setIsCreatingCustom(false);
    showToast(`Created custom shortcut "${newShortcut.label}"`);
  };

  // Delete custom shortcut
  const handleDeleteCustomShortcut = (customId: string) => {
    const updatedCustom = customShortcuts.filter((s) => s.id !== customId);
    saveCustomShortcuts(updatedCustom);
    saveActiveShortcuts(activeShortcutIds.filter((id) => id !== customId));
    showToast('Custom shortcut deleted');
  };

  const activeShortcuts = activeShortcutIds
    .map((id) => allShortcuts.find((s) => s.id === id))
    .filter(Boolean) as ShortcutItem[];

  return (
    <>
      {/* Slide-up Bottom Shortcut Bar: Responsive horizontal scroll, unlimited shortcuts */}
      <div
        id="chat-bottom-shortcut-bar"
        data-no-swipe="true"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className={`no-swipe-gesture w-full overflow-hidden transition-all duration-300 ease-out border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-md select-none ${
          isOpen
            ? 'max-h-36 opacity-100 py-2 px-3 border-t'
            : 'max-h-0 opacity-0 py-0 px-3 border-t-0 pointer-events-none'
        }`}
      >
        {/* Top Header Row with Title, always-visible Edit button, and Close button */}
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wide">Quick Shortcuts</span>
            <span className="text-[10px] text-neutral-400 font-mono px-1.5 py-0.5 rounded-md bg-neutral-900 border border-neutral-800">
              {activeShortcuts.length} active
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Customize / Edit Shortcuts button */}
            <button
              id="chat-edit-shortcuts-btn"
              type="button"
              onClick={handleOpenCustomize}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-850 active:scale-95 text-neutral-200 hover:text-white border border-neutral-700 text-xs font-semibold transition-all shadow-sm"
              title="Customize Shortcuts"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-300" />
              <span>Customize</span>
            </button>

            {/* Quick close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-850 transition-colors"
              title="Close shortcuts"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Shortcut Row with No 5-Item Limit */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {activeShortcuts.map((sc) => (
            <button
              key={sc.id}
              id={`chat-shortcut-${sc.id}`}
              type="button"
              onClick={() => handleShortcutClick(sc)}
              className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 active:scale-95 border border-neutral-800 hover:border-neutral-700 text-white transition-all group min-w-[70px]"
            >
              <div className="p-1 rounded-lg bg-neutral-800 group-hover:bg-neutral-700 text-neutral-200 group-hover:text-white transition-colors">
                {renderShortcutIcon(sc.iconName, 'w-3.5 h-3.5')}
              </div>
              <span className="text-xs font-medium text-neutral-300 group-hover:text-white whitespace-nowrap">
                {sc.label}
              </span>
            </button>
          ))}

          {/* Direct Add Shortcut Button at end of scroll */}
          <button
            type="button"
            onClick={handleOpenCustomize}
            className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl border border-dashed border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-white text-xs font-semibold active:scale-95 transition-all"
            title="Add or create shortcuts"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add / Create</span>
          </button>
        </div>
      </div>

      {/* Edit & Create Shortcuts Modal (Fully self-contained via ModalOverlayContainer) */}
      <ModalOverlayContainer
        isOpen={isEditModalOpen}
        onClose={handleCloseCustomize}
        id="edit-shortcuts-modal"
        maxWidth="md"
        ariaLabel="Customize Shortcuts"
        className="p-4"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Customize Shortcuts</h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Select available shortcuts or build your own custom actions
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseCustomize}
            className="p-1.5 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-4 pr-1">
              {/* Toggle Create Custom Shortcut Form */}
              {!isCreatingCustom ? (
                <button
                  type="button"
                  onClick={() => setIsCreatingCustom(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-neutral-700 hover:border-neutral-500 bg-neutral-900/40 hover:bg-neutral-900 flex items-center justify-center gap-2 text-xs font-semibold text-neutral-300 hover:text-white transition-all active:scale-98"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Create Custom Shortcut</span>
                </button>
              ) : (
                <form
                  onSubmit={handleCreateCustomShortcut}
                  className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-700 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">New Custom Shortcut</span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingCustom(false)}
                      className="text-[11px] text-neutral-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Label */}
                  <div>
                    <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                      Shortcut Name
                    </label>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g. Summarize, Fix Code, Quick Note"
                      className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-neutral-600"
                    />
                  </div>

                  {/* Icon Selector */}
                  <div>
                    <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                      Choose Icon
                    </label>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {AVAILABLE_ICONS.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setNewIcon(ic)}
                          className={`p-2 rounded-lg border transition-all ${
                            newIcon === ic
                              ? 'bg-white text-black border-white'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                          }`}
                        >
                          {renderShortcutIcon(ic, 'w-3.5 h-3.5')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Type */}
                  <div>
                    <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                      Action Type
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewActionType('prompt')}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all ${
                          newActionType === 'prompt'
                            ? 'bg-white text-black border-white'
                            : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                        }`}
                      >
                        Insert Prompt
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewActionType('screen')}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all ${
                          newActionType === 'screen'
                            ? 'bg-white text-black border-white'
                            : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                        }`}
                      >
                        Open Screen
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewActionType('quick')}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all ${
                          newActionType === 'quick'
                            ? 'bg-white text-black border-white'
                            : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                        }`}
                      >
                        Quick Action
                      </button>
                    </div>
                  </div>

                  {/* Action specific config */}
                  {newActionType === 'prompt' && (
                    <div>
                      <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                        Prompt Text to Insert
                      </label>
                      <textarea
                        value={newPromptText}
                        onChange={(e) => setNewPromptText(e.target.value)}
                        placeholder="e.g. Please explain this step by step in clear terms:"
                        rows={2}
                        className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-neutral-600 resize-none"
                      />
                    </div>
                  )}

                  {newActionType === 'screen' && (
                    <div>
                      <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                        Select Target Screen
                      </label>
                      <select
                        value={newScreenId}
                        onChange={(e) => setNewScreenId(e.target.value as ScreenId)}
                        className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none"
                      >
                        <option value="tools">Tools Hub</option>
                        <option value="code">Code Editor</option>
                        <option value="notes">Project Notes</option>
                        <option value="video_editor">Video Editor</option>
                        <option value="automation">Automation Hub</option>
                        <option value="tool_calc">Calculator</option>
                        <option value="tool_text">Text Tools</option>
                        <option value="tool_units">Units Converter</option>
                        <option value="tool_colors">Color Tools</option>
                        <option value="tool_images">Image Tools</option>
                        <option value="tool_files">File Converter</option>
                        <option value="tool_bible">Bible</option>
                        <option value="settings">Settings</option>
                      </select>
                    </div>
                  )}

                  {newActionType === 'quick' && (
                    <div>
                      <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                        Select Quick Action
                      </label>
                      <select
                        value={newQuickAction}
                        onChange={(e) => setNewQuickAction(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none"
                      >
                        <option value="workspace">Open Workspace View</option>
                        <option value="new_project">Create New Project</option>
                      </select>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors active:scale-98"
                  >
                    Save & Add to Bar
                  </button>
                </form>
              )}

              {/* User Custom Shortcuts Section (if any exist) */}
              {customShortcuts.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-neutral-300 block mb-2">
                    Your Custom Shortcuts
                  </span>
                  <div className="space-y-1.5">
                    {customShortcuts.map((cs) => {
                      const isActive = activeShortcutIds.includes(cs.id);
                      return (
                        <div
                          key={cs.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-neutral-900 border border-neutral-800"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="p-1 rounded bg-neutral-800 text-neutral-300">
                              {renderShortcutIcon(cs.iconName, 'w-3.5 h-3.5')}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">{cs.label}</p>
                              <p className="text-[10px] text-neutral-400 truncate">
                                {cs.actionType === 'prompt'
                                  ? `Prompt: "${cs.promptText}"`
                                  : cs.actionType === 'screen'
                                  ? `Screen: ${cs.screenId}`
                                  : 'Quick Action'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => handleToggleShortcut(cs.id)}
                              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                isActive
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
                              }`}
                            >
                              {isActive ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomShortcut(cs.id)}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                              title="Delete custom shortcut"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Built-in Shortcuts */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300 mb-2">
                  <span>Available Tools & Screens</span>
                  <button
                    type="button"
                    onClick={() => {
                      saveActiveShortcuts(BUILT_IN_SHORTCUTS.map((s) => s.id));
                      showToast('Added all shortcuts to quick bar');
                    }}
                    className="text-[11px] text-neutral-400 hover:text-white transition-colors"
                  >
                    Select All
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {BUILT_IN_SHORTCUTS.map((shortcut) => {
                    const isAlreadyActive = activeShortcutIds.includes(shortcut.id);

                    return (
                      <button
                        key={shortcut.id}
                        type="button"
                        onClick={() => handleToggleShortcut(shortcut.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all text-xs active:scale-98 ${
                          isAlreadyActive
                            ? 'bg-neutral-900 border-white/40 text-white'
                            : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="p-1 rounded bg-neutral-800 text-neutral-300 shrink-0">
                            {renderShortcutIcon(shortcut.iconName, 'w-3.5 h-3.5')}
                          </span>
                          <span className="font-medium truncate">{shortcut.label}</span>
                        </div>
                        {isAlreadyActive ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-neutral-500 shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  saveActiveShortcuts(['axon', 'tools', 'code', 'notes', 'settings']);
                  showToast('Reset to default shortcuts');
                }}
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>

              <button
                type="button"
                onClick={handleCloseCustomize}
                className="px-5 py-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-semibold active:scale-95 transition-all shadow-md"
              >
                Done
              </button>
            </div>
      </ModalOverlayContainer>
    </>
  );
};
