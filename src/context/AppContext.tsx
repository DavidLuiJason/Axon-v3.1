import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ScreenId,
  PaneViewState,
  NavHistoryEntry,
  ChatMessage,
  ChatAttachment,
  QueuedTask,
  NoteItem,
  NoteCategory,
  ProjectItem,
  IconAvatarSettings,
  ThemeSettings,
  AppStateData,
  IconPreset,
  AppNameTextCase,
  AIAccount,
  AIModelOption,
  AIProvider,
  CodeSkillLevel,
  SavedScript,
  AutomationRule,
  RunCodeEntry,
  AssetManifestItem,
  AssetCategory,
  SaveMode,
  QualityState,
  KnowledgeStatus,
  StorageBudgetConfig,
  TrimCategoryPriority,
  GeneralSettings,
  FunctionColors,
  ProjectActivityEvent,
  ProjectTimelineQuery,
  WorkspaceCodeLoadMode,
  WorkspaceSnippetHistoryItem,
  WorkspaceMode,
  FormattedTraceback,
} from '../types';
import {
  captureScreenScroll,
  restoreScreenScroll,
  clearLiveScrollPositions,
  initNavigationScrollTracker,
} from '../utils/navigationManager';
import {
  DEFAULT_ASSET_MANIFEST,
  DEFAULT_STORAGE_BUDGET_CONFIG,
  AVAILABLE_DOWNLOADABLE_PACKS,
  calculateStorageBreakdown,
  StorageBreakdown,
  performEnhanceOrRevert,
  changeAssetSaveMode,
  simulateTrimPlan,
  formatBytes,
  checkStorageBudget,
  DeviceStorageEstimate,
  getDeviceStorageRecommendation,
  calculateDeviceAwareBudget,
} from '../lib/storageManifest';
import { exportChatToPdf, exportChatToImagePdf } from '../lib/pdfExport';
import {
  tryEvaluateMathExpression,
  handleStorageChatCommand,
} from '../lib/storageChatHandler';
import { handleSettingsChatCommand } from '../lib/settingsChatHandler';
import { evaluateSettingsCommand } from '../lib/chatCapabilityManifest';
import { evaluateInterfaceCaptureChatCommand } from '../lib/interfaceCaptureChatHandler';
import {
  AVAILABLE_AI_MODELS,
  DEFAULT_AI_ACCOUNTS,
  isAccountInCooldown,
  getRemainingCooldownString,
  findAccountByLabel,
} from '../lib/aiConfig';
import {
  detectSelfKnowledgeQuery,
  detectAccountSwitchCommand,
  buildAxonSystemInstruction,
} from '../lib/axonKnowledge';
import {
  DEFAULT_AUTOMATION_RULES,
  DEFAULT_RUN_CODE_ENTRIES,
  executeRunCodeScript,
} from '../lib/automationEngine';
import {
  DEFAULT_PROJECTS,
  DEFAULT_NOTES,
  formatConversationAsMarkdown,
  formatConversationAsPlainText,
  formatConversationAsJson,
  synthesizeExecutiveSummary,
  triggerFileDownload,
} from '../lib/projectMemory';
import { axonBrain, BrainProcessResult } from '../lib/axonBrain';
import { buildCapabilityRegistry, CapabilityRegistry } from '../lib/capabilityRegistry';
import {
  DEFAULT_PROJECT_ACTIVITIES,
  createProjectActivityEvent,
  queryProjectTimeline,
} from '../lib/projectTimeline';
import { fileIntelligence } from '../lib/fileIntelligence';
import { formatChatCodeResponse } from '../utils/chatCodeFormatter';

interface ConfirmationConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface AppContextType {
  // Navigation & Persistent History Stack
  currentScreen: ScreenId;
  previousScreen: ScreenId | null;
  canGoBack: boolean;
  navHistory: NavHistoryEntry[];
  navigateTo: (
    screen: ScreenId,
    options?: {
      panel?: string | null;
      payload?: any;
      preserveMenu?: boolean;
      screenState?: Record<string, any>;
    }
  ) => void;
  goBack: () => void;

  // Central Panel & Drawer Navigation
  activePanel: string | null;
  activePanelPayload: any;
  openPanel: (panelId: string, payload?: any) => void;
  closePanel: (panelId?: string) => void;
  isPanelOpen: (panelId: string) => boolean;
  pushNavState: (stateUpdate: Partial<NavHistoryEntry>) => void;

  // Dual-pane workspace state
  paneViewState: PaneViewState;
  setPaneViewState: (state: PaneViewState) => void;
  splitRatio: number; // 0 to 100 (0 = workspace only, 50 = split, 100 = chat only)
  setSplitRatio: (ratio: number) => void;

  // Projects & Memory Scoping (Part 6)
  projects: ProjectItem[];
  activeProjectId: string;
  activeProject: ProjectItem;
  setActiveProjectId: (id: string) => void;
  createProject: (name: string, description?: string, systemContext?: string, color?: string) => ProjectItem;
  updateProject: (id: string, updates: Partial<ProjectItem>) => void;
  deleteProject: (id: string) => void;

  // Messages / Chat (Scoped to active project)
  messages: ChatMessage[];
  activeProjectMessages: ChatMessage[];
  addMessage: (
    textOrOptions: string | { text: string; sender?: 'user' | 'axon'; attachment?: ChatAttachment; attachments?: ChatAttachment[] },
    attachment?: ChatAttachment | ChatAttachment[]
  ) => void;
  deleteMessage: (messageId: string) => void;
  clearMessages: () => void;

  // Multi-AI Model & Account State
  availableModels: AIModelOption[];
  activeModelId: string;
  activeModel: AIModelOption;
  setActiveModelId: (modelId: string) => void;
  aiAccounts: AIAccount[];
  activeAccount?: AIAccount;
  addAIAccount: (account: Omit<AIAccount, 'id' | 'createdAt'>) => void;
  updateAIAccount: (id: string, updates: Partial<AIAccount>) => void;
  deleteAIAccount: (id: string) => void;
  switchAccount: (query: string, preferredProvider?: AIProvider) => Promise<{ success: boolean; message: string }>;
  clearCooldown: (accountId: string) => void;
  isGeneratingResponse: boolean;
  conversationSummary: string;

  // Task Queue & Cancellation (Phase 2)
  taskQueue: QueuedTask[];
  cancelCurrentTask: () => void;
  clearTaskQueue: () => void;
  removeQueuedTask: (id: string) => void;

  // Notes & Memory (Part 6)
  notes: NoteItem[];
  activeProjectNotes: NoteItem[];
  addNote: (title: string, content: string, projectId?: string, tags?: string[], category?: NoteCategory) => NoteItem;
  updateNote: (id: string, updates: Partial<NoteItem>) => void;
  togglePinNote: (id: string) => void;
  deleteNote: (id: string) => void;

  // Conversation Data Extraction (Part 6)
  extractConversationToNote: (options?: { title?: string; mode?: 'summary' | 'raw'; targetProjectId?: string }) => Promise<NoteItem>;
  extractSingleMessageToNote: (message: ChatMessage, targetProjectId?: string) => NoteItem;
  exportConversationToFile: (format: 'markdown' | 'text' | 'json' | 'pdf' | 'image-pdf', sourceElement?: HTMLElement | null) => Promise<void> | void;

  // Settings: Theme & Icons
  theme: ThemeSettings;
  setThemeMode: (mode: 'dark' | 'light') => void;
  setAccentColor: (color: string) => void;

  icons: IconAvatarSettings;
  setAppIconPreset: (preset: IconPreset) => void;
  setAppIconCustom: (dataUrl: string) => void;
  setAvatarPreset: (preset: IconPreset) => void;
  setAvatarCustom: (dataUrl: string) => void;
  removeAvatar: () => void; // Revert avatar to default
  restoreAvatar: () => void; // Restore previously removed custom avatar
  setSyncAppIconAndAvatar: (sync: boolean) => void;
  setAppNameTextCase: (textCase: AppNameTextCase) => void;

  // Notification / Sound settings
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;

  // AXON Code state & persistence
  codeSkillLevel: CodeSkillLevel;
  setCodeSkillLevel: (level: CodeSkillLevel) => void;
  savedScripts: SavedScript[];
  saveScript: (script: Omit<SavedScript, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => SavedScript;
  deleteScript: (id: string) => void;

  // Workspace Code Loading & Snippet History
  workspaceCodeLoadMode: WorkspaceCodeLoadMode;
  setWorkspaceCodeLoadMode: (mode: WorkspaceCodeLoadMode) => void;
  workspaceSnippetHistory: WorkspaceSnippetHistoryItem[];
  addWorkspaceSnippetHistory: (entry: Omit<WorkspaceSnippetHistoryItem, 'id' | 'timestamp'>) => void;
  deleteWorkspaceSnippetHistoryItem: (id: string) => void;
  clearWorkspaceSnippetHistory: () => void;
  workspaceCode: string;
  setWorkspaceCode: (code: string) => void;
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  workspaceActiveTab: 'code' | 'preview';
  setWorkspaceActiveTab: (tab: 'code' | 'preview') => void;
  workspaceExecutionError: FormattedTraceback | null;
  setWorkspaceExecutionError: (err: FormattedTraceback | null) => void;
  addChatNotification: (text: string, hasBuildRunResult?: boolean) => void;

  // Automation Rules Engine (Part 5)
  automationRules: AutomationRule[];
  saveRule: (rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'> & { id?: string }) => AutomationRule;
  deleteRule: (id: string) => void;
  toggleRule: (id: string, enabled?: boolean) => void;
  testRule: (id: string) => { success: boolean; log: string };

  // Run Code Layer (Part 5 - Live Behavior Extension Layer)
  runCodeEntries: RunCodeEntry[];
  saveRunCodeEntry: (entry: Omit<RunCodeEntry, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'> & { id?: string }) => RunCodeEntry;
  deleteRunCodeEntry: (id: string) => void;
  toggleRunCodeEntry: (id: string, enabled?: boolean) => void;
  testRunCodeEntry: (id: string, testInput?: string) => Promise<{ success: boolean; output: string; executionTimeMs: number; error?: string }>;

  // Storage, Compression & Asset Manifest (Part 7)
  assetManifest: AssetManifestItem[];
  storageBudget: StorageBudgetConfig;
  storageBreakdown: StorageBreakdown;
  deviceStorageEstimate: DeviceStorageEstimate;
  registerAssetInManifest: (
    item: Omit<AssetManifestItem, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'> & { id?: string }
  ) => AssetManifestItem;
  updateAssetManifestItem: (id: string, updates: Partial<AssetManifestItem>) => void;
  deleteAssetFromManifest: (id: string) => void;
  toggleAssetEnabled: (id: string, enabled?: boolean) => void;
  addDownloadablePack: (pack: { id: string; name: string; sizeBytes: number; category: AssetCategory; description: string }) => void;
  removeDownloadablePack: (packId: string) => void;
  setStorageBudgetBytes: (bytes: number) => void;
  hasCompletedStorageOnboarding: boolean;
  setHasCompletedStorageOnboarding: (val: boolean) => void;
  reallocateAssetSpace: (assetId: string, bytesToFree: number) => { success: boolean; message: string };
  setAssetSaveMode: (id: string, mode: SaveMode) => void;
  revertOrEnhanceAssetItem: (id: string) => { resultType: string; message: string };
  updateStorageBudget: (updates: Partial<StorageBudgetConfig>) => void;
  trimStorageWithPlan: (priority?: TrimCategoryPriority[], targetBytes?: number) => { itemsPruned: number; bytesFreed: number };
  refreshStaleKnowledgeAsset: (id: string) => void;

  // AXON Intelligence Core & Timeline (Phase 0)
  capabilityRegistry: CapabilityRegistry;
  projectActivities: ProjectActivityEvent[];
  recordProjectActivity: (event: Omit<ProjectActivityEvent, 'id' | 'timestamp' | 'dateString' | 'timeString'>) => ProjectActivityEvent;
  queryTimeline: (query: ProjectTimelineQuery) => ProjectActivityEvent[];

  // Global Confirmation Prompt
  requestConfirmation: (config: Omit<ConfirmationConfig, 'isOpen'>) => void;
  confirmationConfig: ConfirmationConfig;
  closeConfirmation: () => void;

  // Backup / Restore
  exportStateJson: () => string;
  importStateJson: (jsonString: string) => boolean;
  resetAllData: () => void;

  // Toast / System notice
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // General Settings (Safety Countdown, WPM, AI Call Mode)
  generalSettings: GeneralSettings;
  updateGeneralSettings: (updates: Partial<GeneralSettings>) => void;

  // Drawer visibility & swipe navigation
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  openMenu: () => void;
  closeMenu: () => void;
  drawerGestureOffset: number | null;
  setDrawerGestureOffset: (offset: number | null) => void;

  // Appearance & Function-level color customization
  setFunctionColor: (element: keyof FunctionColors, color: string) => void;
  resetThemeToDefault: () => void;

  // Live thinking status
  liveThinkingStatus: string | null;
}

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  deleteConfirmationWaitTimerSeconds: 5,
  deleteConfirmationTimerEnabled: true,
  userReadingSpeedWpm: 200,
  aiCallMode: 'single',
};

const DEFAULT_SAVED_SCRIPTS: SavedScript[] = [
  {
    id: 'script-welcome',
    title: 'AXON Mobile Runner',
    code: `// AXON Code - Phone-Optimized Lightweight Engine
// Minimum target device: 4GB RAM / 64GB storage

function getSystemMetrics() {
  return {
    targetRam: "4GB budget",
    executionEnvironment: "AXON Native Mobile Engine",
    status: "Optimal",
    offlineMode: true
  };
}

console.log("Welcome to AXON Code!");
console.log(getSystemMetrics());`,
    language: 'javascript',
    skillLevel: 'guided',
    createdAt: '2026-09-06',
    updatedAt: '2026-09-06',
    description: 'System specifications and starter execution test.',
  },
  {
    id: 'script-color-button',
    title: 'Color Changer Shorthand',
    code: `button "Shift Color" -> change color to emerald and show "Color transformed!"`,
    language: 'shorthand',
    skillLevel: 'guided',
    createdAt: '2026-09-06',
    updatedAt: '2026-09-06',
    description: 'Beginner shorthand button with live interactive preview.',
  },
];

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-init-1',
    sender: 'axon',
    text: 'Hello, how can I assist you with your project today?',
    timestamp: '10:42 AM',
  },
  {
    id: 'msg-init-2',
    sender: 'user',
    text: 'Can you provide more details about the core challenge?',
    timestamp: '10:43 AM',
  },
  {
    id: 'msg-init-3',
    sender: 'axon',
    text: "I've processed your input and am generating a report. The analysis shows a 15% optimization potential.",
    timestamp: '10:44 AM',
  },
  {
    id: 'msg-init-4',
    sender: 'user',
    text: 'What is the target deployment environment?',
    timestamp: '10:45 AM',
  },
  {
    id: 'msg-init-5',
    sender: 'axon',
    text: 'Our neural network model can adapt to real-time changes.',
    timestamp: '10:46 AM',
  },
];

export const sanitizeMessages = (rawList: any[]): ChatMessage[] => {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((m: any, idx: number) => {
    let resolvedText = '';
    let resolvedAttachment = m?.attachment;
    if (typeof m?.text === 'string') {
      resolvedText = m.text;
    } else if (m?.text && typeof m.text === 'object') {
      resolvedText = typeof m.text.text === 'string' ? m.text.text : JSON.stringify(m.text);
      if (!resolvedAttachment && m.text.attachment) {
        resolvedAttachment = m.text.attachment;
      }
    } else if (m?.text != null) {
      resolvedText = String(m.text);
    }
    return {
      id: m?.id || `msg-${Date.now()}-${idx}`,
      sender: m?.sender === 'axon' ? 'axon' : 'user',
      text: resolvedText,
      timestamp: m?.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      projectId: m?.projectId,
      modelUsed: m?.modelUsed,
      accountUsed: m?.accountUsed,
      isRateLimitedNotice: m?.isRateLimitedNotice,
      workspaceArtifactId: m?.workspaceArtifactId,
      workspaceArtifactTitle: m?.workspaceArtifactTitle,
      attachment: resolvedAttachment,
    };
  });
};

const DEFAULT_ICONS: IconAvatarSettings = {
  appIconType: 'preset',
  appIconPreset: 'axon-orb',
  avatarType: 'preset',
  avatarPreset: 'axon-orb',
  syncAppIconAndAvatar: false,
  showChatAvatar: false,
  appNameTextCase: 'uppercase',
};

const DEFAULT_FUNCTION_COLORS: FunctionColors = {
  aiChatBubbleBg: '#171717',
  aiChatBubbleText: '#f5f5f5',
  userChatBubbleBg: '#ffffff',
  userChatBubbleText: '#000000',
  userBubbleColor: '#ffffff',
  axonBubbleColor: '#171717',
  sendButtonColor: '#ffffff',
  chatInputBg: '#171717',
  userMsgBtnColor: '#000000',
  axonMsgBtnColor: '#ffffff',
  messageButtonAutoContrast: true,
  micRecordingColor: '#ef4444',
  toolText: '#ffffff',
  toolCalc: '#ffffff',
  toolColors: '#ffffff',
  toolImages: '#ffffff',
  toolFiles: '#ffffff',
  toolBible: '#ffffff',
  toolSpeech: '#ffffff',
  videoEditor: '#ffffff',
  codeWorkspace: '#ffffff',
  notesLibrary: '#ffffff',
  storageManifest: '#ffffff',
};

const DEFAULT_THEME: ThemeSettings = {
  mode: 'dark',
  accentColor: '#ffffff',
  palette: {
    background: '#000000',
    surface: '#171717',
    text: '#ffffff',
    textMuted: '#a3a3a3',
    border: '#262626',
    activeHighlight: '#ffffff',
    avatarGlow: '#ffffff',
  },
  functionColors: DEFAULT_FUNCTION_COLORS,
};

const STORAGE_KEY = 'axon_app_storage_v1';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Central Navigation & History Stack (single source of truth for all screens, drawers, panels, and views)
  const [navHistory, setNavHistory] = useState<NavHistoryEntry[]>([
    {
      id: 'root-axon-0',
      screen: 'axon',
      isMenuOpen: false,
      paneViewState: 'chat-only',
      splitRatio: 100,
      activePanel: null,
      panelPayload: null,
      scrollPositions: {},
    },
  ]);

  const [drawerGestureOffset, setDrawerGestureOffset] = useState<number | null>(null);

  // Synchronize browser history and global passive scroll listener
  useEffect(() => {
    const cleanupScroll = initNavigationScrollTracker();

    try {
      if (typeof window !== 'undefined' && (!window.history.state || !window.history.state.axonNav)) {
        window.history.replaceState({ axonNav: true, id: 'root-axon-0' }, '');
      }
    } catch (e) {}

    const handlePopState = (event: PopStateEvent) => {
      const targetId = event.state?.id;

      setNavHistory((prev) => {
        if (prev.length <= 1) return prev;

        // If targetId is provided, find where to slice
        if (targetId) {
          const targetIndex = prev.findIndex((entry) => entry.id === targetId);
          if (targetIndex !== -1) {
            // If already at target (e.g. in-app back button triggered this popstate), no-op!
            if (targetIndex === prev.length - 1) return prev;

            const nextStack = prev.slice(0, targetIndex + 1);
            const restoredTop = nextStack[nextStack.length - 1];
            if (restoredTop) {
              clearLiveScrollPositions();
              restoreScreenScroll(restoredTop.scrollPositions, restoredTop.screen);
            }
            return nextStack;
          }
        }

        // If cannot confidently match the browser history event to a specific stack entry, do nothing (no-op)
        return prev;
      });
      setDrawerGestureOffset(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      cleanupScroll();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Derive current navigation state directly from top of the stack
  const currentNavEntry = navHistory[navHistory.length - 1] || {
    id: 'root-fallback',
    screen: 'axon',
    isMenuOpen: false,
    paneViewState: 'chat-only',
    splitRatio: 100,
    activePanel: null,
    panelPayload: null,
    scrollPositions: {},
  };

  const currentScreen = currentNavEntry.screen;
  const isMenuOpen = currentNavEntry.isMenuOpen;
  const activePanel = currentNavEntry.activePanel;
  const activePanelPayload = currentNavEntry.panelPayload;
  const paneViewState = currentNavEntry.paneViewState;
  const splitRatio = currentNavEntry.splitRatio;
  const canGoBack = navHistory.length > 1;
  const previousScreen = navHistory.length > 1 ? navHistory[navHistory.length - 2].screen : null;

  const openMenu = () => {
    const currentScrolls = captureScreenScroll(currentScreen);
    setNavHistory((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.isMenuOpen) return prev;

      let updatedPrev = [...prev];
      if (updatedPrev.length > 0) {
        const lastIdx = updatedPrev.length - 1;
        updatedPrev[lastIdx] = {
          ...updatedPrev[lastIdx],
          scrollPositions: { ...(updatedPrev[lastIdx].scrollPositions || {}), ...currentScrolls },
        };
      }

      const newEntry: NavHistoryEntry = {
        ...(top || {
          screen: 'axon',
          paneViewState: 'chat-only',
          splitRatio: 100,
          activePanel: null,
          panelPayload: null,
        }),
        id: `menu-open-${Date.now()}`,
        isMenuOpen: true,
        scrollPositions: currentScrolls,
      };

      try {
        if (typeof window !== 'undefined') {
          window.history.pushState({ axonNav: true, id: newEntry.id, menu: true }, '');
        }
      } catch (e) {}

      return [...updatedPrev, newEntry];
    });
    setDrawerGestureOffset(null);
  };

  const closeMenu = () => {
    let shouldSyncBrowserHistory = false;
    setNavHistory((prev) => {
      const top = prev[prev.length - 1];
      if (!top || !top.isMenuOpen) return prev;
      if (prev.length > 1 && top.id.startsWith('menu-open-')) {
        shouldSyncBrowserHistory = true;
        const nextStack = prev.slice(0, -1);
        const restoredTop = nextStack[nextStack.length - 1];
        if (restoredTop) {
          clearLiveScrollPositions();
          restoreScreenScroll(restoredTop.scrollPositions, restoredTop.screen);
        }
        return nextStack;
      }
      return [{ ...top, isMenuOpen: false }];
    });
    setDrawerGestureOffset(null);

    if (shouldSyncBrowserHistory) {
      try {
        if (typeof window !== 'undefined' && window.history.state?.menu) {
          window.history.back();
        }
      } catch (e) {}
    }
  };

  const setIsMenuOpen = (open: boolean) => {
    if (open) openMenu();
    else closeMenu();
  };

  // Live thinking status (concise activity label)
  const [liveThinkingStatus, setLiveThinkingStatus] = useState<string | null>(null);

  // Sync paneViewState with splitRatio and navigation stack
  const updatePaneViewState = (state: PaneViewState) => {
    setNavHistory((prev) => {
      const top = prev[prev.length - 1];
      if (!top) return prev;
      const newRatio = state === 'chat-only' ? 100 : state === 'workspace-only' ? 0 : top.splitRatio;
      return [
        ...prev.slice(0, -1),
        {
          ...top,
          paneViewState: state,
          splitRatio: newRatio,
        },
      ];
    });
  };

  const updateSplitRatio = (ratio: number) => {
    const clamped = Math.max(0, Math.min(100, ratio));
    const nextView: PaneViewState = clamped >= 50 ? 'chat-only' : 'workspace-only';
    setNavHistory((prev) => {
      const top = prev[prev.length - 1];
      if (!top) return prev;
      return [
        ...prev.slice(0, -1),
        {
          ...top,
          splitRatio: clamped,
          paneViewState: nextView,
        },
      ];
    });
  };

  // Projects State (Part 6)
  const [projects, setProjects] = useState<ProjectItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.projects && parsed.projects.length > 0) return parsed.projects;
      }
    } catch (e) {
      console.warn('Failed to load saved projects', e);
    }
    return DEFAULT_PROJECTS;
  });

  // Project Timeline Activities (Phase 0 Core)
  const [projectActivities, setProjectActivities] = useState<ProjectActivityEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.projectActivities && parsed.projectActivities.length > 0) {
          return parsed.projectActivities;
        }
      }
    } catch (e) {
      console.warn('Failed to load saved project activities', e);
    }
    return DEFAULT_PROJECT_ACTIVITIES;
  });

  const [activeProjectId, setActiveProjectIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.settings?.activeProjectId) return parsed.settings.activeProjectId;
      }
    } catch (e) {}
    return 'proj-general';
  });

  // Chat & Notes state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.messages && parsed.messages.length > 0) {
          return sanitizeMessages(parsed.messages);
        }
      }
    } catch (e) {
      console.warn('Failed to load saved messages', e);
    }
    return sanitizeMessages(DEFAULT_MESSAGES);
  });

  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.notes && parsed.notes.length > 0) return parsed.notes;
      }
    } catch (e) {
      console.warn('Failed to load saved notes', e);
    }
    return DEFAULT_NOTES;
  });

  // Settings
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.settings?.theme) return parsed.settings.theme;
      }
    } catch (e) {}
    return DEFAULT_THEME;
  });

  const [icons, setIcons] = useState<IconAvatarSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.settings?.icons) {
          return {
            ...DEFAULT_ICONS,
            ...parsed.settings.icons,
          };
        }
      }
    } catch (e) {}
    return DEFAULT_ICONS;
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // General Settings
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.settings?.generalSettings) {
          return {
            ...DEFAULT_GENERAL_SETTINGS,
            ...parsed.settings.generalSettings,
          };
        }
      }
    } catch (e) {}
    return DEFAULT_GENERAL_SETTINGS;
  });

  const updateGeneralSettings = useCallback((updates: Partial<GeneralSettings>) => {
    setGeneralSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Multi-AI Model & Account State
  const [aiAccounts, setAiAccounts] = useState<AIAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.settings?.aiAccounts && parsed.settings.aiAccounts.length > 0) {
          // Exclude any stale AXON entries from external AI tool accounts
          const externalAccounts = parsed.settings.aiAccounts.filter(
            (a) => a.provider !== 'axon' && a.id !== 'account-axon-offline'
          );
          if (externalAccounts.length > 0) {
            return externalAccounts;
          }
        }
      }
    } catch (e) {}
    return DEFAULT_AI_ACCOUNTS;
  });

  const [activeModelId, setActiveModelId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.settings?.activeModelId) {
          if (
            parsed.settings.activeModelId === 'gemini-3.6-flash' ||
            parsed.settings.activeModelId === 'gemini-2.5-flash' ||
            parsed.settings.activeModelId === 'gemini-2.5-pro' ||
            !parsed.settings.activeModelId
          ) {
            return 'gemini-3.8-flash';
          }
          return parsed.settings.activeModelId;
        }
      }
    } catch (e) {}
    return 'gemini-3.8-flash';
  });

  const [conversationSummary, setConversationSummary] = useState<string>('');
  const [isGeneratingResponse, setIsGeneratingResponse] = useState<boolean>(false);
  const [taskQueue, setTaskQueue] = useState<QueuedTask[]>([]);
  const taskQueueRef = useRef<QueuedTask[]>([]);
  taskQueueRef.current = taskQueue;
  const isGeneratingResponseRef = useRef<boolean>(false);
  isGeneratingResponseRef.current = isGeneratingResponse;
  const abortControllerRef = useRef<AbortController | null>(null);

  // AXON Code Skill Level and Saved Scripts
  const [codeSkillLevel, setCodeSkillLevel] = useState<CodeSkillLevel>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.settings?.codeSkillLevel) {
          return parsed.settings.codeSkillLevel;
        }
      }
    } catch (e) {}
    return 'guided';
  });

  const [savedScripts, setSavedScripts] = useState<SavedScript[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.userContent?.savedScripts && Array.isArray(parsed.userContent.savedScripts)) {
          return parsed.userContent.savedScripts;
        }
      }
    } catch (e) {}
    return DEFAULT_SAVED_SCRIPTS;
  });

  const saveScript = (
    script: Omit<SavedScript, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): SavedScript => {
    const now = new Date().toISOString();
    let updatedScript: SavedScript;
    if (script.id) {
      updatedScript = {
        ...script,
        id: script.id,
        createdAt: script.id.startsWith('script-') ? '2026-09-06' : now,
        updatedAt: now,
      };
      setSavedScripts((prev) =>
        prev.map((s) => (s.id === script.id ? updatedScript : s))
      );
    } else {
      updatedScript = {
        ...script,
        id: 'script-' + Date.now(),
        createdAt: now,
        updatedAt: now,
      };
      setSavedScripts((prev) => [updatedScript, ...prev]);
    }
    showToast('Script saved to AXON workspace');
    return updatedScript;
  };

  const deleteScript = (id: string) => {
    setSavedScripts((prev) => prev.filter((s) => s.id !== id));
    showToast('Script deleted');
  };

  // Workspace Code Loading Mode & Snippet History
  const [workspaceCodeLoadMode, setWorkspaceCodeLoadModeState] = useState<WorkspaceCodeLoadMode>(() => {
    try {
      const saved = localStorage.getItem('axon_workspace_code_load_mode_v1');
      if (saved === 'auto' || saved === 'manual') return saved;
    } catch {}
    return 'manual';
  });

  const setWorkspaceCodeLoadMode = useCallback((mode: WorkspaceCodeLoadMode) => {
    setWorkspaceCodeLoadModeState(mode);
    try {
      localStorage.setItem('axon_workspace_code_load_mode_v1', mode);
    } catch {}
    showToast(`Workspace code loading set to ${mode === 'auto' ? 'Auto-load' : 'Manual'}`);
  }, []);

  const [workspaceSnippetHistory, setWorkspaceSnippetHistory] = useState<WorkspaceSnippetHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('axon_workspace_history_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const defaultSnippet: WorkspaceSnippetHistoryItem = {
      id: 'snip-initial-starter',
      title: 'AXON Workspace System Report',
      code: `// AXON Workspace Engine\n// Safe client-side execution & rapid prototyping\n\nfunction generateSystemReport() {\n  return {\n    engine: 'AXON Unified Intelligence',\n    status: 'Operational',\n    timestamp: new Date().toLocaleTimeString(),\n    mode: 'Unified Workspace Code & Preview'\n  };\n}\n\nreturn generateSystemReport();`,
      language: 'javascript',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
      source: 'custom',
      lineCount: 13,
      byteSize: 310,
    };
    try {
      localStorage.setItem('axon_workspace_history_v1', JSON.stringify([defaultSnippet]));
    } catch {}
    return [defaultSnippet];
  });

  const addWorkspaceSnippetHistory = useCallback((entry: Omit<WorkspaceSnippetHistoryItem, 'id' | 'timestamp'>) => {
    setWorkspaceSnippetHistory((prev) => {
      // Avoid duplicate consecutive entries with identical code
      if (prev.length > 0 && prev[0].code.trim() === entry.code.trim()) {
        return prev;
      }
      const newItem: WorkspaceSnippetHistoryItem = {
        ...entry,
        id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
        lineCount: entry.code.split('\n').length,
        byteSize: new Blob([entry.code]).size,
      };
      const updated = [newItem, ...prev].slice(0, 100);
      try {
        localStorage.setItem('axon_workspace_history_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const deleteWorkspaceSnippetHistoryItem = useCallback((id: string) => {
    setWorkspaceSnippetHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem('axon_workspace_history_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const clearWorkspaceSnippetHistory = useCallback(() => {
    setWorkspaceSnippetHistory([]);
    try {
      localStorage.removeItem('axon_workspace_history_v1');
    } catch {}
    showToast('Workspace snippet history cleared');
  }, []);

  // Unified Workspace State (AXON Code & Workspace Pane)
  const [workspaceCode, setWorkspaceCodeState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('axon_workspace_code_v1');
      if (saved) return saved;
    } catch {}
    return `// AXON Workspace Engine\n// Safe client-side execution & rapid prototyping\n\nfunction generateSystemReport() {\n  return {\n    engine: 'AXON Unified Intelligence',\n    status: 'Operational',\n    timestamp: new Date().toLocaleTimeString(),\n    mode: 'Unified Workspace Code & Preview'\n  };\n}\n\nreturn generateSystemReport();`;
  });

  const setWorkspaceCode = useCallback((code: string) => {
    setWorkspaceCodeState(code);
    try {
      localStorage.setItem('axon_workspace_code_v1', code);
    } catch {}
  }, []);

  const [workspaceMode, setWorkspaceModeState] = useState<WorkspaceMode>(() => {
    try {
      const saved = localStorage.getItem('axon_workspace_mode_v1');
      if (saved === 'javascript' || saved === 'html' || saved === 'json') return saved;
    } catch {}
    return 'javascript';
  });

  const setWorkspaceMode = useCallback((mode: WorkspaceMode) => {
    setWorkspaceModeState(mode);
    try {
      localStorage.setItem('axon_workspace_mode_v1', mode);
    } catch {}
  }, []);

  const [workspaceActiveTab, setWorkspaceActiveTab] = useState<'code' | 'preview'>('code');
  const [workspaceExecutionError, setWorkspaceExecutionError] = useState<FormattedTraceback | null>(null);

  const addChatNotification = useCallback((text: string, hasBuildRunResult?: boolean) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-notify`,
        sender: 'axon',
        text,
        projectId: activeProjectId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'AXON Workspace Core',
        hasBuildRunResult: Boolean(hasBuildRunResult),
      },
    ]);
  }, [activeProjectId]);

  // Part 5: Automation Rules Engine State
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.userContent?.automationRules && Array.isArray(parsed.userContent.automationRules)) {
          return parsed.userContent.automationRules;
        }
      }
    } catch (e) {}
    return DEFAULT_AUTOMATION_RULES;
  });

  const saveRule = (
    rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'> & { id?: string }
  ): AutomationRule => {
    const now = new Date().toISOString();
    let updatedRule: AutomationRule;
    if (rule.id) {
      const existing = automationRules.find((r) => r.id === rule.id);
      updatedRule = {
        ...rule,
        id: rule.id,
        triggerCount: existing?.triggerCount || 0,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      setAutomationRules((prev) => prev.map((r) => (r.id === rule.id ? updatedRule : r)));
      showToast(`Rule "${updatedRule.title}" updated`);
    } else {
      updatedRule = {
        ...rule,
        id: 'rule-' + Date.now(),
        triggerCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      setAutomationRules((prev) => [updatedRule, ...prev]);
      showToast(`Rule "${updatedRule.title}" created`);
    }
    return updatedRule;
  };

  const deleteRule = (id: string) => {
    setAutomationRules((prev) => prev.filter((r) => r.id !== id));
    showToast('Automation rule deleted');
  };

  const toggleRule = (id: string, enabled?: boolean) => {
    setAutomationRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const nextState = enabled !== undefined ? enabled : !r.enabled;
        return { ...r, enabled: nextState, updatedAt: new Date().toISOString() };
      })
    );
  };

  const testRule = (id: string): { success: boolean; log: string } => {
    const rule = automationRules.find((r) => r.id === id);
    if (!rule) return { success: false, log: 'Rule not found.' };

    const now = new Date().toISOString();
    const logMsg = `Triggered [${rule.triggerLabel}]. Executed action [${rule.actionLabel}].`;

    setAutomationRules((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              triggerCount: r.triggerCount + 1,
              lastTriggered: now,
              lastExecutionLog: logMsg,
            }
          : r
      )
    );
    showToast(`Simulated: ${rule.title} triggered`);
    return { success: true, log: logMsg };
  };

  // Part 5: Run Code Layer State (Live Behavior Extension Layer)
  const [runCodeEntries, setRunCodeEntries] = useState<RunCodeEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.userContent?.runCodeEntries && Array.isArray(parsed.userContent.runCodeEntries)) {
          return parsed.userContent.runCodeEntries;
        }
      }
    } catch (e) {}
    return DEFAULT_RUN_CODE_ENTRIES;
  });

  const saveRunCodeEntry = (
    entry: Omit<RunCodeEntry, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'> & { id?: string }
  ): RunCodeEntry => {
    const now = new Date().toISOString();
    let updatedEntry: RunCodeEntry;
    if (entry.id) {
      const existing = runCodeEntries.find((e) => e.id === entry.id);
      updatedEntry = {
        ...entry,
        id: entry.id,
        executionCount: existing?.executionCount || 0,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      setRunCodeEntries((prev) => prev.map((e) => (e.id === entry.id ? updatedEntry : e)));
      showToast(`Extension "${updatedEntry.title}" updated`);
    } else {
      updatedEntry = {
        ...entry,
        id: 'runcode-' + Date.now(),
        executionCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      setRunCodeEntries((prev) => [updatedEntry, ...prev]);
      showToast(`Extension "${updatedEntry.title}" added to library`);
    }
    return updatedEntry;
  };

  const deleteRunCodeEntry = (id: string) => {
    setRunCodeEntries((prev) => prev.filter((e) => e.id !== id));
    showToast('Run Code extension deleted');
  };

  const toggleRunCodeEntry = (id: string, enabled?: boolean) => {
    setRunCodeEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const nextState = enabled !== undefined ? enabled : !e.enabled;
        return { ...e, enabled: nextState, updatedAt: new Date().toISOString() };
      })
    );
  };

  const testRunCodeEntry = async (id: string, testInput?: string) => {
    const entry = runCodeEntries.find((e) => e.id === id);
    if (!entry) return { success: false, output: '', executionTimeMs: 0, error: 'Extension not found' };

    const defaultSample = entry.commandKeyword
      ? `${entry.commandKeyword} test`
      : entry.hookPoint === 'post_response'
      ? 'AXON is ready to assist with full workspace tools.'
      : 'Explain how asynchronous programming works in JavaScript.';
    const inputToUse = testInput !== undefined ? testInput : defaultSample;

    const result = await executeRunCodeScript(entry, inputToUse, {
      activeRulesCount: automationRules.filter((r) => r.enabled).length,
      activeRunCodeCount: runCodeEntries.filter((e) => e.enabled).length,
      userModel: activeModel?.name,
    });

    const now = new Date().toISOString();
    setRunCodeEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              executionCount: e.executionCount + 1,
              lastExecuted: now,
              lastOutput: result.success ? result.output : `Error: ${result.error}`,
            }
          : e
      )
    );

    return result;
  };

  // Part 7: Asset Manifest & Storage Budget State
  const [assetManifest, setAssetManifest] = useState<AssetManifestItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.assetManifest && Array.isArray(parsed.assetManifest) && parsed.assetManifest.length > 0) {
          const seenIds = new Set<string>();
          const seenLocations = new Set<string>();
          const deduped: AssetManifestItem[] = [];
          for (let i = 0; i < parsed.assetManifest.length; i++) {
            const item = parsed.assetManifest[i];
            if (!item) continue;
            const loc = item.storageLocation || item.name;
            // Skip exact duplicate storage locations to prevent duplicate file records
            if (loc && seenLocations.has(loc)) {
              continue;
            }
            if (loc) seenLocations.add(loc);

            let safeId = item.id;
            if (!safeId || seenIds.has(safeId)) {
              safeId = `asset-${item.category || 'user_file'}-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 8)}`;
            }
            seenIds.add(safeId);
            deduped.push({ ...item, id: safeId });
          }
          if (deduped.length > 0) return deduped;
        }
      }
    } catch (e) {}
    return DEFAULT_ASSET_MANIFEST;
  });

  const [storageBudget, setStorageBudget] = useState<StorageBudgetConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppStateData = JSON.parse(saved);
        if (parsed.settings?.storageBudget) {
          return parsed.settings.storageBudget;
        }
      }
    } catch (e) {}
    return DEFAULT_STORAGE_BUDGET_CONFIG;
  });

  const [deviceStorageEstimate, setDeviceStorageEstimate] = useState<DeviceStorageEstimate>(() =>
    calculateDeviceAwareBudget()
  );

  useEffect(() => {
    let isMounted = true;
    getDeviceStorageRecommendation().then((estimate) => {
      if (!isMounted) return;
      setDeviceStorageEstimate(estimate);
      // If user hasn't explicitly set a custom budget or completed onboarding yet,
      // adopt the device-aware recommended budget:
      setStorageBudget((prev) => {
        if (!prev.hasCompletedOnboarding && prev.customLimitBytes === undefined) {
          return {
            ...prev,
            budgetBytes: estimate.recommendedBudgetBytes,
          };
        }
        return prev;
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const storageBreakdown = useMemo(() => {
    return calculateStorageBreakdown(assetManifest);
  }, [assetManifest]);

  const registerAssetInManifest = (
    item: Omit<AssetManifestItem, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'> & { id?: string }
  ): AssetManifestItem => {
    const now = new Date().toISOString();
    const saveMode = item.saveMode || 'archive';
    const isOriginalPreserved = saveMode === 'archive';
    const originalSize = item.originalSizeBytes || 1024;
    const storedSize =
      item.storedSizeBytes !== undefined
        ? item.storedSizeBytes
        : saveMode === 'archive'
        ? Math.round(originalSize * 0.82)
        : Math.round(originalSize * 0.28);

    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const finalId = item.id || `asset-${item.category}-${uniqueSuffix}`;

    const newItem: AssetManifestItem = {
      ...item,
      id: finalId,
      saveMode,
      isOriginalPreserved,
      originalSizeBytes: originalSize,
      storedSizeBytes: storedSize,
      qualityState: item.qualityState || (saveMode === 'archive' ? 'lossless' : 'downsampled'),
      knowledgeStatus: item.knowledgeStatus || 'not_applicable',
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };

    const budgetCheck = checkStorageBudget(
      storageBreakdown.totalStoredBytes,
      storedSize,
      storageBudget.budgetBytes,
      storageBudget.warningThresholdPercent
    );

    setAssetManifest((prev) => {
      const filtered = prev.filter(
        (a) => a.id !== finalId && (!item.storageLocation || a.storageLocation !== item.storageLocation)
      );
      return [newItem, ...filtered];
    });
    if (budgetCheck.wouldExceedBudget) {
      showToast(`Warning: Exceeds ${formatBytes(storageBudget.budgetBytes, 0)} budget! Registered "${newItem.name}" (${formatBytes(newItem.storedSizeBytes)}).`);
    } else if (budgetCheck.wouldTriggerWarning) {
      showToast(`Storage warning: ${Math.round(budgetCheck.usagePercentAfter)}% of budget reached after adding "${newItem.name}".`);
    } else {
      showToast(`Registered "${newItem.name}" in manifest (${formatBytes(newItem.storedSizeBytes)})`);
    }
    return newItem;
  };

  const updateAssetManifestItem = (id: string, updates: Partial<AssetManifestItem>) => {
    const now = new Date().toISOString();
    setAssetManifest((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates, updatedAt: now } : item))
    );
    showToast('Asset updated in manifest');
  };

  const deleteAssetFromManifest = (id: string) => {
    const item = assetManifest.find((a) => a.id === id);
    if (!item) return;

    if (item.isCore) {
      showToast(`"${item.name}" is a protected core system component and cannot be deleted. You can disable it instead.`);
      return;
    }

    requestConfirmation({
      title: 'Delete Asset',
      message: `Are you sure you want to delete "${item.name}"? This will free ${formatBytes(item.storedSizeBytes)} from storage and remove it from the asset manifest.`,
      confirmLabel: 'Delete File',
      danger: true,
      onConfirm: () => {
        setAssetManifest((prev) => prev.filter((a) => a.id !== id));
        closeConfirmation();
        showToast(`Deleted "${item.name}"`);
      },
    });
  };

  const toggleAssetEnabled = (id: string, enabled?: boolean) => {
    setAssetManifest((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const nextVal = enabled !== undefined ? enabled : !a.isEnabled;
          return { ...a, isEnabled: nextVal, updatedAt: new Date().toISOString() };
        }
        return a;
      })
    );
    const item = assetManifest.find((a) => a.id === id);
    if (item) {
      const stateStr = item.isEnabled ? 'disabled' : 'enabled';
      showToast(`"${item.name}" is now ${stateStr}`);
    }
  };

  const reallocateAssetSpace = (assetId: string, bytesToFree: number): { success: boolean; message: string } => {
    const target = assetManifest.find((a) => a.id === assetId);
    if (!target) return { success: false, message: 'Asset not found in manifest.' };

    const allocated = target.allocatedSizeBytes || target.storedSizeBytes;
    const used = target.storedSizeBytes;
    const maxFreeable = Math.max(0, allocated - used);

    if (maxFreeable <= 0) {
      return {
        success: false,
        message: `Asset "${target.name}" is currently using all its allocated space (${formatBytes(used)}). No free space available to reallocate.`,
      };
    }

    const actualFree = Math.min(bytesToFree, maxFreeable);
    const newAllocated = allocated - actualFree;

    setAssetManifest((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, allocatedSizeBytes: newAllocated, updatedAt: new Date().toISOString() } : a))
    );

    const msg = `Reallocated ${formatBytes(actualFree)} from "${target.name}" to general storage pool. New allocated space for "${target.name}": ${formatBytes(newAllocated)}.`;
    showToast(msg);
    return { success: true, message: msg };
  };

  const addDownloadablePack = (pack: { id: string; name: string; sizeBytes: number; category: AssetCategory; description: string }) => {
    const existing = assetManifest.find((a) => a.id === pack.id);
    if (existing) {
      showToast(`"${pack.name}" is already installed in manifest.`);
      return;
    }

    const budgetCheck = checkStorageBudget(
      storageBreakdown.totalStoredBytes,
      pack.sizeBytes,
      storageBudget.budgetBytes,
      storageBudget.warningThresholdPercent
    );

    if (budgetCheck.wouldExceedBudget) {
      showToast(
        `Cannot install "${pack.name}": Exceeds storage budget (${formatBytes(budgetCheck.remainingBytes)} free of ${formatBytes(storageBudget.budgetBytes, 0)}). Please trim assets or adjust budget.`
      );
      return;
    }

    const now = new Date().toISOString();
    const newItem: AssetManifestItem = {
      id: pack.id,
      name: pack.name,
      category: pack.category,
      storageLocation: `/local/packs/${pack.id}.pack`,
      mimeType: 'application/octet-stream',
      originalSizeBytes: pack.sizeBytes,
      storedSizeBytes: pack.sizeBytes,
      allocatedSizeBytes: pack.sizeBytes,
      saveMode: 'archive',
      isOriginalPreserved: true,
      qualityState: 'original',
      knowledgeStatus: 'current',
      isCore: false,
      isEnabled: true,
      description: pack.description,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };
    setAssetManifest((prev) => [...prev, newItem]);
    if (budgetCheck.wouldTriggerWarning) {
      showToast(`Installed "${pack.name}" (${formatBytes(pack.sizeBytes)}). Storage warning: ${Math.round(budgetCheck.usagePercentAfter)}% of budget used.`);
    } else {
      showToast(`Downloaded and installed "${pack.name}" (${formatBytes(pack.sizeBytes)})`);
    }
  };

  const removeDownloadablePack = (packId: string) => {
    deleteAssetFromManifest(packId);
  };

  const setStorageBudgetBytes = (bytes: number) => {
    setStorageBudget((prev) => ({
      ...prev,
      budgetBytes: bytes,
      customLimitBytes: bytes,
      hasCompletedOnboarding: true,
    }));
    showToast(`Storage budget set to ${formatBytes(bytes)}`);
  };

  const hasCompletedStorageOnboarding = !!storageBudget.hasCompletedOnboarding;
  const setHasCompletedStorageOnboarding = (val: boolean) => {
    setStorageBudget((prev) => ({
      ...prev,
      hasCompletedOnboarding: val,
    }));
  };

  const setAssetSaveMode = (id: string, mode: SaveMode) => {
    const target = assetManifest.find((a) => a.id === id);
    if (!target) return;
    if (target.saveMode === mode) return;

    const updated = changeAssetSaveMode(target, mode);
    setAssetManifest((prev) => prev.map((a) => (a.id === id ? updated : a)));
    showToast(
      mode === 'space_saver'
        ? `Switched to Space-Saver mode (Original discarded to save space)`
        : `Switched to Archive mode (Lossless original preserved)`
    );
  };

  const revertOrEnhanceAssetItem = (id: string): { resultType: string; message: string } => {
    const target = assetManifest.find((a) => a.id === id);
    if (!target) return { resultType: 'error', message: 'Asset not found' };

    const { updatedItem, resultType, message } = performEnhanceOrRevert(target);
    setAssetManifest((prev) => prev.map((a) => (a.id === id ? updatedItem : a)));
    showToast(message);
    return { resultType, message };
  };

  const updateStorageBudget = (updates: Partial<StorageBudgetConfig>) => {
    setStorageBudget((prev) => ({ ...prev, ...updates }));
    showToast('Storage budget updated');
  };

  const trimStorageWithPlan = (
    priority?: TrimCategoryPriority[],
    targetBytes?: number
  ): { itemsPruned: number; bytesFreed: number } => {
    const prio = priority || storageBudget.trimPriority;
    const target =
      targetBytes ||
      Math.max(500 * 1024 * 1024, storageBreakdown.totalStoredBytes - storageBudget.budgetBytes * 0.85);

    const plan = simulateTrimPlan(assetManifest, target, prio);
    if (plan.itemsToPrune.length === 0) {
      showToast('No candidates available to trim in current priority categories');
      return { itemsPruned: 0, bytesFreed: 0 };
    }

    const idsToRemove = new Set(plan.itemsToPrune.map((p) => p.item.id));
    setAssetManifest((prev) => prev.filter((a) => !idsToRemove.has(a.id)));
    showToast(`Storage trimmed: Freed ${formatBytes(plan.totalSimulatedSavingsBytes)} across ${plan.itemsToPrune.length} items`);
    return {
      itemsPruned: plan.itemsToPrune.length,
      bytesFreed: plan.totalSimulatedSavingsBytes,
    };
  };

  const refreshStaleKnowledgeAsset = (id: string) => {
    const target = assetManifest.find((a) => a.id === id);
    if (!target) return;
    const now = new Date().toISOString();
    const updated: AssetManifestItem = {
      ...target,
      knowledgeStatus: 'current',
      staleReason: undefined,
      updatedAt: now,
      lastAccessedAt: now,
    };
    setAssetManifest((prev) => prev.map((a) => (a.id === id ? updated : a)));
    showToast(`Refreshed cached knowledge for "${target.name}"`);
  };

  const availableModels = AVAILABLE_AI_MODELS;

  const activeModel = useMemo(() => {
    return availableModels.find((m) => m.id === activeModelId) || availableModels[0];
  }, [activeModelId, availableModels]);

  const activeAccount = useMemo(() => {
    return (
      aiAccounts.find((a) => a.provider === activeModel.provider && a.isActive) ||
      aiAccounts.find((a) => a.provider === activeModel.provider)
    );
  }, [aiAccounts, activeModel]);

  // Project Scoping & Isolation (Part 6)
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0] || DEFAULT_PROJECTS[0];
  }, [projects, activeProjectId]);

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id);
    const found = projects.find((p) => p.id === id);
    if (found) {
      showToast(`Switched to "${found.name}"`);
    }
  };

  const activeProjectMessages = useMemo(() => {
    return messages.filter((m) => (m.projectId || 'proj-general') === activeProjectId);
  }, [messages, activeProjectId]);

  const activeProjectNotes = useMemo(() => {
    return notes.filter((n) => (n.projectId || 'proj-general') === activeProjectId || n.projectId === 'global');
  }, [notes, activeProjectId]);

  // AXON Capability Registry (Phase 0 Core — Internal tracking of external AI tool capabilities)
  const capabilityRegistry = useMemo(() => {
    return buildCapabilityRegistry(aiAccounts);
  }, [aiAccounts]);

  const recordProjectActivity = (
    event: Omit<ProjectActivityEvent, 'id' | 'timestamp' | 'dateString' | 'timeString'>
  ): ProjectActivityEvent => {
    const newEvent = createProjectActivityEvent({
      projectId: event.projectId,
      type: event.type,
      title: event.title,
      summary: event.summary,
      metadata: event.metadata,
    });
    setProjectActivities((prev) => [newEvent, ...prev]);
    return newEvent;
  };

  const queryTimeline = (query: ProjectTimelineQuery): ProjectActivityEvent[] => {
    return queryProjectTimeline(projectActivities, query);
  };

  const createProject = (
    name: string,
    description?: string,
    systemContext?: string,
    color?: string
  ): ProjectItem => {
    const newProj: ProjectItem = {
      id: 'proj-' + Date.now(),
      name: name.trim() || 'Untitled Project',
      description: description?.trim() || 'Personal project workspace',
      systemContext: systemContext?.trim() || '',
      color: color || '#ffffff',
      icon: 'folder',
      isDefault: false,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectIdState(newProj.id);
    recordProjectActivity({
      projectId: newProj.id,
      type: 'project_created',
      title: `Project Created: ${newProj.name}`,
      summary: newProj.description || 'Project workspace created.',
    });
    showToast(`Project "${newProj.name}" created`);
    return newProj;
  };

  const updateProject = (id: string, updates: Partial<ProjectItem>) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString().split('T')[0] } : p
      )
    );
    showToast('Project updated');
  };

  const deleteProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    if (target.isDefault) {
      showToast('Default workspace cannot be deleted');
      return;
    }

    requestConfirmation({
      title: 'Delete Project',
      message: `Are you sure you want to delete "${target.name}"? Notes and messages in this project will be transferred to the General Workspace.`,
      confirmLabel: 'Delete Project',
      danger: true,
      onConfirm: () => {
        setNotes((prev) =>
          prev.map((n) => (n.projectId === id ? { ...n, projectId: 'proj-general' } : n))
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.projectId === id
              ? { ...m, projectId: 'proj-general', hasBuildRunResult: false, isResultUnavailable: true }
              : m
          )
        );
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (activeProjectId === id) {
          setActiveProjectIdState('proj-general');
        }
        closeConfirmation();
        showToast(`Project "${target.name}" deleted`);
      },
    });
  };

  // Global Confirmation
  const [confirmationConfig, setConfirmationConfig] = useState<ConfirmationConfig>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: () => {},
  });

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // Save to localStorage whenever data changes
  useEffect(() => {
    try {
      const dataToSave: AppStateData = {
        settings: {
          theme,
          icons,
          notificationsEnabled,
          soundEnabled,
          aiAccounts,
          activeModelId,
          codeSkillLevel,
          activeProjectId,
          storageBudget,
          generalSettings,
        },
        projects,
        projectActivities,
        messages,
        notes,
        assetManifest,
        userContent: {
          customFiles: [],
          savedScripts,
          automationRules,
          runCodeEntries,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn('Failed to persist to localStorage', e);
    }
  }, [
    theme,
    icons,
    projects,
    projectActivities,
    activeProjectId,
    messages,
    notes,
    assetManifest,
    storageBudget,
    notificationsEnabled,
    soundEnabled,
    aiAccounts,
    activeModelId,
    codeSkillLevel,
    savedScripts,
    automationRules,
    runCodeEntries,
    generalSettings,
  ]);

  // Central Navigation & History Handlers
  const navigateTo = (
    screen: ScreenId,
    options?: {
      panel?: string | null;
      payload?: any;
      preserveMenu?: boolean;
      screenState?: Record<string, any>;
    }
  ) => {
    if (screen === 'code') {
      setWorkspaceActiveTab('code');
    }

    const currentScrolls = captureScreenScroll(currentScreen);
    clearLiveScrollPositions();

    setNavHistory((prev) => {
      const top = prev[prev.length - 1];
      const targetScreen: ScreenId = screen === 'code' ? 'axon' : screen;
      const targetPaneView: PaneViewState =
        screen === 'code'
          ? 'workspace-only'
          : screen === 'axon'
          ? 'chat-only'
          : top
          ? top.paneViewState
          : 'chat-only';
      const targetSplitRatio =
        screen === 'code'
          ? 0
          : screen === 'axon'
          ? 100
          : top
          ? top.splitRatio
          : 100;

      // If user is already on that exact screen with matching menu & panel, avoid duplicate entry
      if (
        top &&
        top.screen === targetScreen &&
        top.paneViewState === targetPaneView &&
        top.isMenuOpen === !!options?.preserveMenu &&
        top.activePanel === (options?.panel || null)
      ) {
        return prev;
      }

      let updatedPrev = [...prev];

      // Update the prior screen entry with its captured scroll positions, preserving isMenuOpen and activePanel exactly as they were
      if (updatedPrev.length > 0) {
        const lastIdx = updatedPrev.length - 1;
        updatedPrev[lastIdx] = {
          ...updatedPrev[lastIdx],
          scrollPositions: { ...(updatedPrev[lastIdx].scrollPositions || {}), ...currentScrolls },
        };
      }

      const newEntry: NavHistoryEntry = {
        id: `nav-${targetScreen}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        screen: targetScreen,
        isMenuOpen: !!options?.preserveMenu,
        paneViewState: targetPaneView,
        splitRatio: targetSplitRatio,
        activePanel: options?.panel || null,
        panelPayload: options?.payload ?? null,
        scrollPositions: {},
        screenState: options?.screenState ?? {},
      };

      try {
        if (typeof window !== 'undefined') {
          window.history.pushState({ axonNav: true, id: newEntry.id, screen }, '');
        }
      } catch (e) {}

      return [...updatedPrev, newEntry];
    });
    setDrawerGestureOffset(null);
  };

  const goBack = () => {
    setNavHistory((prev) => {
      if (prev.length > 1) {
        const nextStack = prev.slice(0, -1);
        const restoredTop = nextStack[nextStack.length - 1];
        if (restoredTop) {
          clearLiveScrollPositions();
          restoreScreenScroll(restoredTop.scrollPositions, restoredTop.screen);
        }
        return nextStack;
      }
      // At root: remain on current state! NEVER fall back to hardcoded default.
      return prev;
    });
    setDrawerGestureOffset(null);
  };

  const openPanel = (panelId: string, payload?: any) => {
    const currentScrolls = captureScreenScroll(currentScreen);

    setNavHistory((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.activePanel === panelId) return prev;

      let updatedPrev = [...prev];
      if (updatedPrev.length > 0) {
        const lastIdx = updatedPrev.length - 1;
        updatedPrev[lastIdx] = {
          ...updatedPrev[lastIdx],
          scrollPositions: { ...(updatedPrev[lastIdx].scrollPositions || {}), ...currentScrolls },
        };
      }

      const newEntry: NavHistoryEntry = {
        ...(top || {
          screen: 'axon',
          isMenuOpen: false,
          paneViewState: 'chat-only',
          splitRatio: 100,
        }),
        id: `panel-${panelId}-${Date.now()}`,
        activePanel: panelId,
        panelPayload: payload ?? null,
        scrollPositions: currentScrolls,
      };

      try {
        if (typeof window !== 'undefined') {
          window.history.pushState({ axonNav: true, id: newEntry.id, panel: panelId }, '');
        }
      } catch (e) {}

      return [...updatedPrev, newEntry];
    });
  };

  const closePanel = (panelId?: string) => {
    let shouldSyncBrowserHistory = false;
    setNavHistory((prev) => {
      const top = prev[prev.length - 1];
      if (!top || !top.activePanel) return prev;
      if (panelId && top.activePanel !== panelId) return prev;

      if (prev.length > 1 && top.id.startsWith('panel-')) {
        shouldSyncBrowserHistory = true;
        const nextStack = prev.slice(0, -1);
        const restoredTop = nextStack[nextStack.length - 1];
        if (restoredTop) {
          clearLiveScrollPositions();
          restoreScreenScroll(restoredTop.scrollPositions, restoredTop.screen);
        }
        return nextStack;
      }
      return [{ ...top, activePanel: null, panelPayload: null }];
    });

    if (shouldSyncBrowserHistory) {
      try {
        if (typeof window !== 'undefined' && window.history.state?.panel) {
          window.history.back();
        }
      } catch (e) {}
    }
  };

  const isPanelOpen = (panelId: string) => {
    return activePanel === panelId;
  };

  const pushNavState = (stateUpdate: Partial<NavHistoryEntry>) => {
    const currentScrolls = captureScreenScroll(currentScreen);
    setNavHistory((prev) => {
      const top = prev[prev.length - 1];
      if (!top) return prev;

      let updatedPrev = [...prev];
      if (updatedPrev.length > 0) {
        const lastIdx = updatedPrev.length - 1;
        updatedPrev[lastIdx] = {
          ...updatedPrev[lastIdx],
          scrollPositions: { ...(updatedPrev[lastIdx].scrollPositions || {}), ...currentScrolls },
        };
      }

      const newEntry: NavHistoryEntry = {
        ...top,
        ...stateUpdate,
        id: `state-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        scrollPositions: currentScrolls,
      };

      try {
        if (typeof window !== 'undefined') {
          window.history.pushState({ axonNav: true, id: newEntry.id }, '');
        }
      } catch (e) {}

      return [...updatedPrev, newEntry];
    });
  };

  // Confirmation trigger
  const requestConfirmation = (config: Omit<ConfirmationConfig, 'isOpen'>) => {
    setConfirmationConfig({
      ...config,
      isOpen: true,
    });
  };

  const closeConfirmation = () => {
    setConfirmationConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // AI Account Actions
  const addAIAccount = (newAccData: Omit<AIAccount, 'id' | 'createdAt'>) => {
    const newAcc: AIAccount = {
      ...newAccData,
      id: `acc-${newAccData.provider}-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setAiAccounts((prev) => {
      if (newAcc.isActive) {
        return [
          ...prev.map((a) => (a.provider === newAcc.provider ? { ...a, isActive: false } : a)),
          newAcc,
        ];
      }
      return [...prev, newAcc];
    });
    showToast(`Added ${newAcc.label}`);
  };

  const updateAIAccount = (id: string, updates: Partial<AIAccount>) => {
    setAiAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        return { ...a, ...updates };
      })
    );
    showToast('Account updated');
  };

  const deleteAIAccount = (id: string) => {
    const acc = aiAccounts.find((a) => a.id === id);
    if (!acc) return;
    requestConfirmation({
      title: 'Delete AI Account',
      message: `Are you sure you want to delete "${acc.label}" (${acc.provider.toUpperCase()})? Stored credentials will be removed.`,
      confirmLabel: 'Delete Account',
      danger: true,
      onConfirm: () => {
        setAiAccounts((prev) => {
          const filtered = prev.filter((a) => a.id !== id);
          const sameProviderRemaining = filtered.filter((a) => a.provider === acc.provider);
          if (acc.isActive && sameProviderRemaining.length > 0) {
            sameProviderRemaining[0].isActive = true;
          }
          return filtered;
        });
        closeConfirmation();
        showToast(`Deleted ${acc.label}`);
      },
    });
  };

  const clearCooldown = (accountId: string) => {
    setAiAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== accountId) return a;
        return { ...a, isRateLimited: false, cooldownUntil: undefined, lastError: undefined };
      })
    );
    showToast('Cooldown cleared');
  };

  // Manual Account Switching with Context Summary Handoff
  const switchAccount = async (
    query: string,
    preferredProvider?: AIProvider
  ): Promise<{ success: boolean; message: string }> => {
    const target = findAccountByLabel(aiAccounts, query, preferredProvider || activeModel.provider);
    if (!target) {
      const available = aiAccounts
        .filter((a) => a.provider === (preferredProvider || activeModel.provider))
        .map((a) => `"${a.label}"`)
        .join(', ');
      const msg = `Account "${query}" was not found. Available accounts: ${available || 'None'}`;
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-switch-fail`,
          sender: 'axon',
          text: msg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return { success: false, message: msg };
    }

    if (target.isActive) {
      const msg = `Account "${target.label}" is already active for ${target.provider.toUpperCase()}.`;
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-switch-same`,
          sender: 'axon',
          text: msg,
          projectId: activeProjectId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return { success: false, message: msg };
    }

    // Generate conversation summary so context is handed off to the new session
    let updatedSummary = conversationSummary;
    const projMessages = messages.filter((m) => (m.projectId || 'proj-general') === activeProjectId);
    try {
      const sumRes = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: projMessages.slice(-30).map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        if (sumData.summary) updatedSummary = sumData.summary;
      }
    } catch (e) {
      const userTopics = projMessages
        .filter((m) => m.sender === 'user')
        .slice(-5)
        .map((m) => m.text)
        .join('; ');
      updatedSummary = `Recent discussion: ${userTopics || 'General session'}.`;
    }
    setConversationSummary(updatedSummary);

    // Apply manual switch
    setAiAccounts((prev) =>
      prev.map((a) => {
        if (a.provider !== target.provider) return a;
        return {
          ...a,
          isActive: a.id === target.id,
        };
      })
    );

    const inCooldown = isAccountInCooldown(target);
    const cooldownNotice = inCooldown ? ` [Note: Cooldown is active: ${getRemainingCooldownString(target)}]` : '';

    const switchText = `Switched to ${target.label} (${target.provider.toUpperCase()}).${cooldownNotice} Conversation context has been summarized and handed off to this new session.`;

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-switch-ok`,
        sender: 'axon',
        text: switchText,
        projectId: activeProjectId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        accountUsed: target.label,
      },
    ]);

    showToast(`Switched to ${target.label}`);
    return { success: true, message: switchText };
  };

  // Task Queue Processing & Cancellation (Phase 2)
  const processNextQueuedTaskRef = useRef<() => void>(() => {});

  const cancelCurrentTask = useCallback(() => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {
        console.warn('Error aborting active task', e);
      }
      abortControllerRef.current = null;
    }
    setIsGeneratingResponse(false);
    isGeneratingResponseRef.current = false;
    setLiveThinkingStatus(null);
    showToast('Task stopped');
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-cancelled`,
        sender: 'axon',
        text: '⏹️ Task stopped by user.',
        projectId: activeProjectId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'AXON Core',
      },
    ]);

    // Check if there are queued tasks to process next after a brief delay
    if (taskQueueRef.current.length > 0) {
      setTimeout(() => {
        if (!isGeneratingResponseRef.current && taskQueueRef.current.length > 0) {
          processNextQueuedTaskRef.current();
        }
      }, 500);
    }
  }, [activeProjectId]);

  const clearTaskQueue = useCallback(() => {
    setTaskQueue([]);
    taskQueueRef.current = [];
    showToast('Task queue cleared');
  }, []);

  const removeQueuedTask = useCallback((taskId: string) => {
    setTaskQueue((prev) => prev.filter((t) => t.id !== taskId));
    taskQueueRef.current = taskQueueRef.current.filter((t) => t.id !== taskId);
    showToast('Removed from queue');
  }, []);

  // Messages / AI Dispatch
  const addMessage = async (
    textOrOptions: string | { text: string; sender?: 'user' | 'axon'; attachment?: ChatAttachment; attachments?: ChatAttachment[] },
    attachmentParam?: ChatAttachment | ChatAttachment[]
  ) => {
    let rawText = '';
    let attachmentsList: ChatAttachment[] = [];

    if (typeof textOrOptions === 'string') {
      rawText = textOrOptions;
      if (Array.isArray(attachmentParam)) {
        attachmentsList = attachmentParam;
      } else if (attachmentParam) {
        attachmentsList = [attachmentParam];
      }
    } else if (textOrOptions && typeof textOrOptions === 'object') {
      rawText = typeof textOrOptions.text === 'string' ? textOrOptions.text : String(textOrOptions.text || '');
      if (Array.isArray(textOrOptions.attachments) && textOrOptions.attachments.length > 0) {
        attachmentsList = textOrOptions.attachments;
      } else if (textOrOptions.attachment) {
        attachmentsList = [textOrOptions.attachment];
      }
      if (attachmentsList.length === 0 && attachmentParam) {
        if (Array.isArray(attachmentParam)) {
          attachmentsList = attachmentParam;
        } else {
          attachmentsList = [attachmentParam];
        }
      }
    } else if (textOrOptions != null) {
      rawText = String(textOrOptions);
    }

    const text = rawText;
    const primaryAttachment = attachmentsList[0] || undefined;

    // Minimal Task Queue: If an AI task is currently active, queue this request
    if (isGeneratingResponseRef.current) {
      const queuedItem: QueuedTask = {
        id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        text,
        attachment: primaryAttachment,
        attachments: attachmentsList.length > 0 ? attachmentsList : undefined,
        projectId: activeProjectId,
        createdAt: new Date().toISOString(),
      };
      setTaskQueue((prev) => {
        const next = [...prev, queuedItem];
        taskQueueRef.current = next;
        return next;
      });
      showToast(`Request queued (${taskQueueRef.current.length} in queue)`);
      return;
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: 'user',
      text,
      projectId: activeProjectId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment: primaryAttachment,
      attachments: attachmentsList.length > 0 ? attachmentsList : undefined,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    // Register user file attachments into the core asset manifest
    if (attachmentsList.length > 0) {
      const processedLocs = new Set<string>();
      attachmentsList.forEach((att, idx) => {
        if (att && att.name) {
          const loc = `/user/attachments/${att.name}`;
          if (processedLocs.has(loc)) return;
          processedLocs.add(loc);
          const already = assetManifest.some((a) => a.storageLocation === loc || a.name === att.name);
          if (!already) {
            const rawSize = typeof att.size === 'number' ? att.size : typeof att.size === 'string' ? parseInt(att.size, 10) || 1048576 : 1048576;
            const uniqueId = `asset-user_file-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
            registerAssetInManifest({
              id: uniqueId,
              name: att.name,
              category: 'user_file',
              storageLocation: loc,
              mimeType: att.type || 'application/octet-stream',
              originalSizeBytes: rawSize,
              storedSizeBytes: rawSize,
              saveMode: 'archive',
              isOriginalPreserved: true,
              qualityState: 'original',
              knowledgeStatus: 'not_applicable',
              isCore: false,
              isEnabled: true,
              description: `User attachment in chat: ${att.name}`,
            });
          }
        }
      });
    }

    // Filter project-specific messages for conversational history
    const activeProjectHistory = nextMessages.filter(
      (m) => (m.projectId || 'proj-general') === activeProjectId
    );

    // AXON Brain Core — Central intelligence processing pipeline
    let brainResult: BrainProcessResult | null = null;
    try {
      brainResult = await axonBrain.processRequest({
        id: userMsg.id,
        text,
        projectId: activeProjectId,
        attachment: primaryAttachment,
        attachments: attachmentsList,
        context: {
          conversationHistory: activeProjectHistory,
          projectNotes: activeProjectNotes,
          systemContext: activeProject?.systemContext || '',
          timelineEvents: projectActivities,
          capabilityRegistry,
        },
      });

      // Record activity in project timeline
      if (brainResult?.activityEvent) {
        setProjectActivities((prev) => [brainResult!.activityEvent!, ...prev]);
      }

      // Direct response handled by AXON internal intelligence (e.g. meta-plan query, project timeline query, file intelligence search)
      if (brainResult?.handledLocally && brainResult.localResponse) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-brain`,
            sender: 'axon',
            text: brainResult!.localResponse!,
            projectId: activeProjectId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelUsed: brainResult!.modelLabel,
          },
        ]);
        return;
      }
    } catch (brainErr) {
      console.warn('AXON Brain processing error (gracefully proceeding to standard chat dispatch):', brainErr);
    }

    // 0. Check for custom command Run Code entries (e.g. /status)
    const trimmedInput = (typeof text === 'string' ? text : '').trim();
    const activeCommand = runCodeEntries.find(
      (e) => e.enabled && e.hookPoint === 'custom_command' && e.commandKeyword && trimmedInput.startsWith(e.commandKeyword)
    );

    if (activeCommand) {
      try {
        const cmdArgs = trimmedInput.substring(activeCommand.commandKeyword!.length).trim();
        const execResult = await executeRunCodeScript(activeCommand, cmdArgs, {
          activeRulesCount: automationRules.filter((r) => r.enabled).length,
          activeRunCodeCount: runCodeEntries.filter((e) => e.enabled).length,
          userModel: activeModel.name,
        });

        // Update run code execution telemetry
        setRunCodeEntries((prev) =>
          prev.map((e) =>
            e.id === activeCommand.id
              ? {
                  ...e,
                  executionCount: e.executionCount + 1,
                  lastExecuted: new Date().toISOString(),
                  lastOutput: execResult.output,
                }
              : e
          )
        );

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-cmd`,
            sender: 'axon',
            text: execResult.success ? execResult.output : `Run Code error: ${execResult.error}`,
            projectId: activeProjectId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelUsed: `AXON Run Code (${activeCommand.title})`,
          },
        ]);
        return;
      } catch (err: any) {
        console.warn('Run code command execution failed', err);
      }
    }

    // 1. Check for fast-path offline arithmetic calculation (e.g. "what is 1+1", "50 * 4", "15% of 80")
    const mathResult = tryEvaluateMathExpression(text);
    if (mathResult) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-calc`,
          sender: 'axon',
          text: mathResult,
          projectId: activeProjectId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'AXON Offline Calculator Engine',
        },
      ]);
      return;
    }

    // 2. Check for conversational storage queries & reallocation / pack commands
    const storageCmdResult = handleStorageChatCommand(
      text,
      assetManifest,
      reallocateAssetSpace,
      addDownloadablePack
    );
    if (storageCmdResult) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-storage`,
          sender: 'axon',
          text: storageCmdResult,
          projectId: activeProjectId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'AXON Storage Engine',
        },
      ]);
      return;
    }

    // 2.5. Check for chat-driven settings commands with Grounded Capability Manifest verification
    const settingsEvaluation = evaluateSettingsCommand(text, {
      theme,
      setThemeMode,
      setAccentColor,
      setFunctionColor,
      resetThemeToDefault,
      icons,
      setAppIconPreset,
      setAvatarPreset,
      setAppNameTextCase,
      codeSkillLevel,
      setCodeSkillLevel,
      workspaceCodeLoadMode,
      setWorkspaceCodeLoadMode,
      soundEnabled,
      setSoundEnabled,
      notificationsEnabled,
      setNotificationsEnabled,
    });

    if (settingsEvaluation.handled) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-settings`,
          sender: 'axon',
          text: settingsEvaluation.response,
          projectId: activeProjectId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: settingsEvaluation.executed
            ? 'AXON Settings Controller'
            : 'AXON Capability Manifest',
        },
      ]);
      return;
    }

    // 2.6. Check for Interface Capture chat commands (e.g. "Capture this interface", "Capture Settings", "Capture all interfaces", "Make a PDF of all interfaces")
    const captureEvaluation = await evaluateInterfaceCaptureChatCommand(text, {
      currentScreen,
      previousScreen,
    });
    if (captureEvaluation.handled) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-capture`,
          sender: 'axon',
          text: captureEvaluation.response,
          projectId: activeProjectId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'AXON Interface Capture Engine',
          attachments: captureEvaluation.attachments,
        },
      ]);
      return;
    }

    // 3. Check for manual account switch command (e.g. "log into account B", "switch to account B")
    const switchCheck = detectAccountSwitchCommand(text);
    if (switchCheck.isSwitchCommand && switchCheck.targetAccountLabel) {
      await switchAccount(switchCheck.targetAccountLabel, activeModel.provider);
      return;
    }

    // 4. Check for AXON self-knowledge query (e.g. "who are you", "what can you do", "describe yourself")
    const selfCheck = detectSelfKnowledgeQuery(text);
    if (selfCheck.matches) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-self`,
          sender: 'axon',
          text: selfCheck.response,
          projectId: activeProjectId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'AXON Self-Knowledge',
        },
      ]);
      return;
    }

    // Apply active pre_prompt Run Code entries
    let promptForDispatch = text;
    for (const hook of runCodeEntries.filter((e) => e.enabled && e.hookPoint === 'pre_prompt')) {
      try {
        const hookResult = await executeRunCodeScript(hook, promptForDispatch, {
          activeRulesCount: automationRules.filter((r) => r.enabled).length,
          activeRunCodeCount: runCodeEntries.filter((e) => e.enabled).length,
          userModel: activeModel.name,
        });
        if (hookResult.success && hookResult.output) {
          promptForDispatch = hookResult.output;
          setRunCodeEntries((prev) =>
            prev.map((e) =>
              e.id === hook.id
                ? {
                    ...e,
                    executionCount: e.executionCount + 1,
                    lastExecuted: new Date().toISOString(),
                    lastOutput: 'Pre-prompt hook modified input.',
                  }
                : e
            )
          );
        }
      } catch (e) {
        console.warn('Pre-prompt hook failed', e);
      }
    }

    // Check Automation Rules for keyword formatting
    const codeRule = automationRules.find(
      (r) => r.enabled && r.triggerType === 'keyword_match' && r.actionType === 'auto_format_code'
    );
    if (codeRule && /(?:code|function|javascript|python|script|algorithm)/i.test(text)) {
      promptForDispatch += '\n\n[Rule Applied: Format answer with syntax highlighting and clear mobile code blocks]';
      setAutomationRules((prev) =>
        prev.map((r) =>
          r.id === codeRule.id
            ? {
                ...r,
                triggerCount: r.triggerCount + 1,
                lastTriggered: new Date().toISOString(),
                lastExecutionLog: 'Applied syntax highlighting rule to prompt.',
              }
            : r
        )
      );
    }

    // 3. Multi-AI model API dispatch
    const currentAccount =
      aiAccounts.find((a) => a.provider === activeModel.provider && a.isActive) ||
      aiAccounts.find((a) => a.provider === activeModel.provider);

    // Usage-limit awareness: Stop if account is in cooldown (Strict rule: DO NOT auto-switch)
    // AXON's local core is strictly excluded from usage limits and cooldown tracking
    if (currentAccount && currentAccount.provider !== 'axon' && isAccountInCooldown(currentAccount)) {
      const remaining = getRemainingCooldownString(currentAccount);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-cooldown`,
          sender: 'axon',
          text: `Account "${currentAccount.label}" (${activeModel.providerName}) reached its usage limit and is in cooldown (${remaining}).\n\nPer safety protocol, AXON does not automatically switch accounts. You can manually switch accounts by typing e.g. "switch to account B" or selecting another account in Settings.`,
          projectId: activeProjectId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: activeModel.name,
          accountUsed: currentAccount.label,
          isRateLimitedNotice: true,
        },
      ]);
      return;
    }

    // 5. AXON execution: Blend local reasoning core and connected online capabilities
    const hasVisualAttachment = attachmentsList.some(
      (a) => a?.type?.startsWith('image/') || (typeof a?.dataUrl === 'string' && a.dataUrl.startsWith('data:image/'))
    );

    const isAxonModel =
      activeModel.provider === 'axon' ||
      activeModel.id === 'axon-offline-core' ||
      activeModel.id?.includes('axon') ||
      activeModel.name?.toLowerCase().includes('axon');

    const isDeviceOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // If device is strictly offline, run local core without waiting for network timeout
    if (isDeviceOffline) {
      setIsGeneratingResponse(true);
      isGeneratingResponseRef.current = true;
      setLiveThinkingStatus('Processing on-device...');
      try {
        const localReply = axonBrain.generateOfflineResponse(
          {
            id: userMsg.id,
            text,
            projectId: activeProjectId,
            attachment: primaryAttachment,
            attachments: attachmentsList,
            context: {
              conversationHistory: activeProjectHistory,
              projectNotes: activeProjectNotes,
              systemContext: activeProject?.systemContext || '',
              timelineEvents: projectActivities,
              capabilityRegistry,
            },
          },
          brainResult
        );

        // Process code and conversational text formatting
        const codeResult = formatChatCodeResponse(localReply, text);
        if (codeResult.detectedCode) {
          const firstLine = codeResult.detectedCode.split('\n')[0].replace(/^\/\/\s*|^<!--\s*|^#\s*/, '').trim();
          const snippetTitle = firstLine && firstLine.length < 50 ? firstLine : `Generated ${codeResult.detectedLang.toUpperCase()}`;
          setWorkspaceCode(codeResult.detectedCode);
          setWorkspaceMode(codeResult.detectedLang);
          setWorkspaceActiveTab('code');
          setWorkspaceExecutionError(null);
          addWorkspaceSnippetHistory({
            title: snippetTitle,
            code: codeResult.detectedCode,
            language: codeResult.detectedLang,
            source: 'chat_auto',
          });
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-axon-local`,
            sender: 'axon',
            text: codeResult.displayText,
            projectId: activeProjectId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelUsed: 'AXON Local Core',
            hasBuildRunResult: codeResult.hasBuildRunResult,
            showFullCodeInChat: codeResult.showFullCodeInChat,
          },
        ]);
      } catch (localErr) {
        console.warn('AXON Local Core generation fallback', localErr);
        const fallbackReply = axonBrain.generateOfflineResponse({
          id: userMsg.id,
          text,
          projectId: activeProjectId,
          attachment: primaryAttachment,
          attachments: attachmentsList,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-axon-local`,
            sender: 'axon',
            text: fallbackReply,
            projectId: activeProjectId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelUsed: 'AXON Local Core',
          },
        ]);
      } finally {
        setIsGeneratingResponse(false);
        isGeneratingResponseRef.current = false;
        setLiveThinkingStatus(null);
        setTimeout(() => {
          if (processNextQueuedTaskRef.current) {
            processNextQueuedTaskRef.current();
          }
        }, 300);
      }
      return;
    }

    setIsGeneratingResponse(true);
    isGeneratingResponseRef.current = true;
    const currentAbortController = new AbortController();
    abortControllerRef.current = currentAbortController;

    // Compute concise activity status label
    let currentStatusLabel = 'Thinking...';
    if (attachmentsList.some((a) => a?.type?.startsWith('application/pdf')) || text.toLowerCase().includes('.pdf')) {
      currentStatusLabel = 'Analyzing PDF';
    } else if (hasVisualAttachment || text.toLowerCase().includes('image')) {
      currentStatusLabel = 'Analyzing image...';
    } else if (attachmentsList.length > 0) {
      currentStatusLabel = 'Inspecting files...';
    } else if (activeProjectNotes.length > 0 || activeProject.systemContext) {
      currentStatusLabel = 'Recalling project context';
    } else if (/(?:code|function|script|component|build|implement)/i.test(text)) {
      currentStatusLabel = 'Drafting code';
    }
    setLiveThinkingStatus(currentStatusLabel);

    try {
      // Auto-retry rule evaluation on connection issue / network failure
      const retryRule = automationRules.find(
        (r) => r.enabled && r.triggerType === 'connection_error' && r.actionType === 'retry_automatically'
      );
      const maxRetries = retryRule ? (retryRule.actionConfig.maxRetries || 2) : 1;
      let attempt = 0;
      let response: Response | null = null;
      let data: any = null;

      // When AXON model has images or online capability blending, route delegation to Gemini Flash with AXON persona
      const effectiveProvider = (isAxonModel && hasVisualAttachment) ? 'gemini' : (isAxonModel ? 'axon' : activeModel.provider);
      const effectiveModelId = (isAxonModel && hasVisualAttachment) ? 'gemini-3.8-flash' : (isAxonModel ? 'gemini-3.8-flash' : activeModel.id);

      while (attempt < maxRetries) {
        attempt++;
        try {
          response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: currentAbortController.signal,
            body: JSON.stringify({
              provider: effectiveProvider,
              model: effectiveModelId,
              messages: activeProjectHistory
                .filter((m) => {
                  if (m.isRateLimitedNotice) return false;
                  if (typeof m.id === 'string') {
                    if (m.id.includes('-limited') || m.id.includes('-cooldown') || m.id.includes('-nokey')) return false;
                    if (m.id.includes('-switch-') && m.sender === 'axon') return false;
                  }
                  return true;
                })
                .map((m, idx, arr) => {
                  const itemAttachments = m.attachments || (m.attachment ? [m.attachment] : undefined);
                  const isCurrentTurn = m.id === userMsg.id || idx >= arr.length - 2;
                  const sanitizedAttachments = itemAttachments?.map((att) => {
                    if (isCurrentTurn) return att;
                    // For older history turns, retain name and type info but strip heavy dataUrl to prevent payload overflow
                    return {
                      name: att.name,
                      type: att.type,
                      size: att.size,
                    };
                  });
                  return {
                    sender: m.sender,
                    text: m.id === userMsg.id ? promptForDispatch : m.text,
                    attachments: sanitizedAttachments,
                    attachment: sanitizedAttachments && sanitizedAttachments[0],
                  };
                }),
              apiKey: currentAccount?.apiKey || '',
              accountLabel: currentAccount?.label || 'Primary',
              conversationSummary,
              projectContext: activeProject
                ? {
                    name: activeProject.name,
                    description: activeProject.description,
                    systemContext: activeProject.systemContext,
                    relevantNotes: activeProjectNotes
                      .map((n) => `[${n.title}]: ${n.content}`)
                      .slice(0, 5)
                      .join('\n\n'),
                  }
                : undefined,
            }),
          });
          data = await response.json();
          if (response.ok && data.success) {
            if (attempt > 1 && retryRule) {
              setAutomationRules((prev) =>
                prev.map((r) =>
                  r.id === retryRule.id
                    ? {
                        ...r,
                        triggerCount: r.triggerCount + 1,
                        lastTriggered: new Date().toISOString(),
                        lastExecutionLog: `Auto-retry succeeded on attempt ${attempt}.`,
                      }
                    : r
                )
              );
            }
            break;
          }
        } catch (fetchErr: any) {
          if (fetchErr?.name === 'AbortError' || fetchErr?.message?.includes('aborted')) {
            console.log('Task aborted by user');
            return;
          }
          if (attempt < maxRetries && retryRule) {
            showToast(`Connection issue — auto-retrying via rule (${attempt}/${maxRetries})...`);
            setAutomationRules((prev) =>
              prev.map((r) =>
                r.id === retryRule.id
                  ? {
                      ...r,
                      triggerCount: r.triggerCount + 1,
                      lastTriggered: new Date().toISOString(),
                      lastExecutionLog: `Connection failed. Auto-retried attempt ${attempt}/${maxRetries}.`,
                    }
                  : r
              )
            );
            await new Promise((res) => setTimeout(res, 800));
            continue;
          }
          throw fetchErr;
        }
      }

      if (!response || !data || !response.ok || !data.success) {
        // Usage-limit detection: record cooldown timer (up to 24 hours) in memory
        // Only applies to external AI tool accounts (Gemini, Claude, ChatGPT), NEVER to AXON's local core
        if (
          (response?.status === 429 || data?.errorType === 'RATE_LIMIT') &&
          currentAccount &&
          currentAccount.provider !== 'axon'
        ) {
          const cooldownUntil = Date.now() + 24 * 60 * 60 * 1000;
          if (currentAccount) {
            setAiAccounts((prev) =>
              prev.map((a) =>
                a.id === currentAccount.id
                  ? {
                      ...a,
                      isRateLimited: true,
                      cooldownUntil,
                      lastError: 'Usage limit reached (HTTP 429)',
                    }
                  : a
              )
            );
          }

          // Trigger rate limit notice rule if enabled
          const rateRule = automationRules.find(
            (r) => r.enabled && r.triggerType === 'rate_limit'
          );
          if (rateRule) {
            setAutomationRules((prev) =>
              prev.map((r) =>
                r.id === rateRule.id
                  ? {
                      ...r,
                      triggerCount: r.triggerCount + 1,
                      lastTriggered: new Date().toISOString(),
                      lastExecutionLog: 'Rate limit recognized. Diagnostic notice displayed.',
                    }
                  : r
              )
            );
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-limited`,
              sender: 'axon',
              text: `Account "${currentAccount?.label || 'Active'}" has reached its usage limit. A 24-hour cooldown timer has been recorded in memory.\n\nAXON has stopped using this account and will NOT switch accounts automatically. You can manually switch to another account whenever ready by typing e.g. "switch to account B" or managing accounts in Settings.`,
              projectId: activeProjectId,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              modelUsed: activeModel.name,
              accountUsed: currentAccount?.label,
              isRateLimitedNotice: true,
            },
          ]);
          setIsGeneratingResponse(false);
          return;
        }

        if (data?.errorType === 'MISSING_KEY') {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-nokey`,
              sender: 'axon',
              text: `${data.message}\n\nYou can enter and manage your official API key in AXON Settings > AI Accounts, or select Gemini to use workspace credentials.`,
              projectId: activeProjectId,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              modelUsed: activeModel.name,
              accountUsed: currentAccount?.label,
            },
          ]);
          setIsGeneratingResponse(false);
          return;
        }

        // Other API error
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-err`,
            sender: 'axon',
            text: `Notice from ${activeModel.name}: ${data?.message || 'Unable to process request.'}`,
            projectId: activeProjectId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelUsed: activeModel.name,
          },
        ]);
        setIsGeneratingResponse(false);
        return;
      }

      // Success - apply active post_response Run Code modifiers
      let finalResponseText = data.text || 'Response received.';
      for (const hook of runCodeEntries.filter((e) => e.enabled && e.hookPoint === 'post_response')) {
        try {
          const postResult = await executeRunCodeScript(hook, finalResponseText, {
            activeRulesCount: automationRules.filter((r) => r.enabled).length,
            activeRunCodeCount: runCodeEntries.filter((e) => e.enabled).length,
            userModel: activeModel.name,
          });
          if (postResult.success && postResult.output) {
            finalResponseText = postResult.output;
            setRunCodeEntries((prev) =>
              prev.map((e) =>
                e.id === hook.id
                  ? {
                      ...e,
                      executionCount: e.executionCount + 1,
                      lastExecuted: new Date().toISOString(),
                      lastOutput: 'Post-response modifier executed.',
                    }
                  : e
              )
            );
          }
        } catch (e) {
          console.warn('Post-response hook failed', e);
        }
      }

      // Process code and conversational text formatting
      const codeResult = formatChatCodeResponse(finalResponseText, text);
      if (codeResult.detectedCode) {
        const firstLine = codeResult.detectedCode.split('\n')[0].replace(/^\/\/\s*|^<!--\s*|^#\s*/, '').trim();
        const snippetTitle = firstLine && firstLine.length < 50 ? firstLine : `Generated ${codeResult.detectedLang.toUpperCase()}`;
        setWorkspaceCode(codeResult.detectedCode);
        setWorkspaceMode(codeResult.detectedLang);
        setWorkspaceActiveTab('code');
        setWorkspaceExecutionError(null);
        addWorkspaceSnippetHistory({
          title: snippetTitle,
          code: codeResult.detectedCode,
          language: codeResult.detectedLang,
          source: 'chat_auto',
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-reply`,
          sender: 'axon',
          text: codeResult.displayText,
          projectId: activeProjectId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: activeModel.name,
          accountUsed: currentAccount?.label,
          hasBuildRunResult: codeResult.hasBuildRunResult,
          showFullCodeInChat: codeResult.showFullCodeInChat,
        },
      ]);
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        console.log('Task was stopped by user');
        return;
      }
      // Offline fallback: Use AXON local reasoning core to process the user's actual message
      try {
        const offlineReply = axonBrain.generateOfflineResponse(
          {
            id: userMsg.id,
            text,
            projectId: activeProjectId,
            attachment: primaryAttachment,
            attachments: attachmentsList,
            context: {
              conversationHistory: activeProjectHistory,
              projectNotes: activeProjectNotes,
              systemContext: activeProject?.systemContext || '',
              timelineEvents: projectActivities,
              capabilityRegistry,
            },
          },
          brainResult
        );

        // Process code and conversational text formatting
        const offlineCodeResult = formatChatCodeResponse(offlineReply, text);
        if (offlineCodeResult.detectedCode) {
          const firstLine = offlineCodeResult.detectedCode.split('\n')[0].replace(/^\/\/\s*|^<!--\s*|^#\s*/, '').trim();
          const snippetTitle = firstLine && firstLine.length < 50 ? firstLine : `Generated ${offlineCodeResult.detectedLang.toUpperCase()}`;
          setWorkspaceCode(offlineCodeResult.detectedCode);
          setWorkspaceMode(offlineCodeResult.detectedLang);
          setWorkspaceActiveTab('code');
          setWorkspaceExecutionError(null);
          addWorkspaceSnippetHistory({
            title: snippetTitle,
            code: offlineCodeResult.detectedCode,
            language: offlineCodeResult.detectedLang,
            source: 'chat_auto',
          });
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-local-core`,
            sender: 'axon',
            text: offlineCodeResult.displayText,
            projectId: activeProjectId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelUsed: 'AXON Local Core',
            hasBuildRunResult: offlineCodeResult.hasBuildRunResult,
            showFullCodeInChat: offlineCodeResult.showFullCodeInChat,
          },
        ]);
      } catch (localErr) {
        console.warn('AXON offline response fallback', localErr);
        const fallbackOfflineReply = axonBrain.generateOfflineResponse({
          id: userMsg.id,
          text,
          projectId: activeProjectId,
          attachment: primaryAttachment,
          attachments: attachmentsList,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-local-core`,
            sender: 'axon',
            text: fallbackOfflineReply,
            projectId: activeProjectId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelUsed: 'AXON Local Core',
          },
        ]);
      }
    } finally {
      setIsGeneratingResponse(false);
      isGeneratingResponseRef.current = false;
      setLiveThinkingStatus(null);
      abortControllerRef.current = null;
      setTimeout(() => {
        if (processNextQueuedTaskRef.current) {
          processNextQueuedTaskRef.current();
        }
      }, 300);
    }
  };

  const deleteMessage = (messageId: string) => {
    requestConfirmation({
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message?',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        closeConfirmation();
        showToast('Message deleted');
      },
    });
  };

  const clearMessages = () => {
    requestConfirmation({
      title: 'Clear Project Conversation',
      message: `Are you sure you want to delete conversation history for "${activeProject.name}"? Other projects will remain intact.`,
      confirmLabel: 'Clear Chat',
      danger: true,
      onConfirm: () => {
        setMessages((prev) => prev.filter((m) => (m.projectId || 'proj-general') !== activeProjectId));
        closeConfirmation();
        showToast(`Cleared conversation for "${activeProject.name}"`);
      },
    });
  };

  // Notes & Memory (Part 6)
  const addNote = (
    title: string,
    content: string,
    projectId?: string,
    tags?: string[],
    category?: NoteCategory
  ): NoteItem => {
    const targetProjId = projectId || activeProjectId;
    const targetProj = projects.find((p) => p.id === targetProjId) || activeProject;
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      title: title.trim() || 'Untitled Note',
      content,
      projectId: targetProjId,
      tags: tags || [],
      isPinned: false,
      category: category || 'general',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setNotes((prev) => [newNote, ...prev]);
    recordProjectActivity({
      projectId: targetProjId,
      type: 'note_created',
      title: `Note Created: ${newNote.title}`,
      summary: newNote.content.slice(0, 80),
      metadata: { noteId: newNote.id, category: newNote.category, tags: newNote.tags },
    });
    showToast(`Note saved to "${targetProj.name}"`);
    return newNote;
  };

  const updateNote = (id: string, updates: Partial<NoteItem>) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, ...updates, updatedAt: new Date().toISOString().split('T')[0] }
          : n
      )
    );
    showToast('Note updated');
  };

  const togglePinNote = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n))
    );
  };

  const deleteNote = (id: string) => {
    requestConfirmation({
      title: 'Delete Note',
      message: 'Are you sure you want to delete this note? This action cannot be undone.',
      confirmLabel: 'Delete Note',
      danger: true,
      onConfirm: () => {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        closeConfirmation();
        showToast('Note deleted');
      },
    });
  };

  // Conversation Data Extraction (Part 6)
  const extractConversationToNote = async (options?: {
    title?: string;
    mode?: 'summary' | 'raw';
    targetProjectId?: string;
  }): Promise<NoteItem> => {
    const targetProjId = options?.targetProjectId || activeProjectId;
    const targetProj = projects.find((p) => p.id === targetProjId) || activeProject;
    const projectMsgs = messages.filter((m) => (m.projectId || 'proj-general') === activeProjectId);
    const mode = options?.mode || 'summary';

    if (projectMsgs.length === 0) {
      showToast('No messages in current project to extract');
      throw new Error('No messages to extract');
    }

    let title = options?.title;
    let content = '';

    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: projectMsgs.map((m) => ({ sender: m.sender, text: m.text })),
          projectName: targetProj.name,
          mode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.content) {
          content = data.content;
          if (!title) title = data.title;
        }
      }
    } catch (e) {
      console.warn('API extract failed, falling back to local synthesis', e);
    }

    if (!content) {
      if (mode === 'raw') {
        content = formatConversationAsMarkdown(projectMsgs, targetProj.name, targetProj.description);
        if (!title) title = `Transcript: ${targetProj.name} (${new Date().toLocaleDateString()})`;
      } else {
        content = synthesizeExecutiveSummary(projectMsgs, targetProj.name, targetProj.description);
        if (!title) title = `Summary: ${targetProj.name} (${new Date().toLocaleDateString()})`;
      }
    }

    const createdNote = addNote(
      title || `Extract: ${targetProj.name}`,
      content,
      targetProjId,
      ['chat-extract', mode],
      'extracted_chat'
    );

    showToast(`Conversation extracted into note for "${targetProj.name}"`);
    return createdNote;
  };

  const extractSingleMessageToNote = (message: ChatMessage, targetProjectId?: string): NoteItem => {
    const targetProjId = targetProjectId || activeProjectId;
    const targetProj = projects.find((p) => p.id === targetProjId) || activeProject;
    const senderName = message.sender === 'user' ? 'User Question' : `AXON (${message.modelUsed || 'AI'})`;
    const textStr = typeof message.text === 'string' ? message.text : String(message.text || '');
    const preview = textStr.substring(0, 35).replace(/\n/g, ' ');
    const title = `Insight: ${preview}...`;
    const content = `# Message Extract: ${targetProj.name}\n**Source:** ${senderName} · **Timestamp:** ${message.timestamp}\n\n${textStr}`;

    const createdNote = addNote(
      title,
      content,
      targetProjId,
      ['chat-extract', 'snippet'],
      'extracted_chat'
    );
    showToast(`Saved message to "${targetProj.name}" notes`);
    return createdNote;
  };

  const exportConversationToFile = async (
    format: 'markdown' | 'text' | 'json' | 'pdf' | 'image-pdf',
    sourceElement?: HTMLElement | null
  ) => {
    const projectMsgs = messages.filter((m) => (m.projectId || 'proj-general') === activeProjectId);
    if (projectMsgs.length === 0) {
      showToast('No messages in active project to export');
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const safeName = activeProject.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (format === 'markdown') {
      const md = formatConversationAsMarkdown(projectMsgs, activeProject.name, activeProject.description);
      triggerFileDownload(`${safeName}-chat-${dateStr}.md`, md, 'text/markdown');
      showToast('Exported Markdown transcript');
    } else if (format === 'text') {
      const txt = formatConversationAsPlainText(projectMsgs, activeProject.name);
      triggerFileDownload(`${safeName}-chat-${dateStr}.txt`, txt, 'text/plain');
      showToast('Exported Text file');
    } else if (format === 'json') {
      const json = formatConversationAsJson(projectMsgs, activeProject.name, activeProject.id);
      triggerFileDownload(`${safeName}-chat-${dateStr}.json`, json, 'application/json');
      showToast('Exported JSON data file');
    } else if (format === 'pdf') {
      exportChatToPdf(projectMsgs, activeProject.name, activeProject.description);
      showToast('Exported Text PDF transcript');
    } else if (format === 'image-pdf') {
      showToast('Generating Image PDF...');
      try {
        await exportChatToImagePdf(projectMsgs, activeProject.name, activeProject.description, sourceElement);
        showToast('Exported Image PDF');
      } catch (err) {
        console.error('Failed to export image PDF:', err);
        showToast('Failed to generate Image PDF');
      }
    }
  };

  // Theme
  const setThemeMode = (mode: 'dark' | 'light') => {
    setTheme((prev) => ({ ...prev, mode }));
  };

  const setAccentColor = (color: string) => {
    setTheme((prev) => ({ ...prev, accentColor: color }));
  };

  const setFunctionColor = (element: keyof FunctionColors, color: string) => {
    setTheme((prev) => ({
      ...prev,
      functionColors: {
        ...(prev.functionColors || DEFAULT_FUNCTION_COLORS),
        [element]: color,
      },
    }));
    showToast(`Updated appearance for ${String(element)}`);
  };

  const resetThemeToDefault = () => {
    setTheme(DEFAULT_THEME);
    showToast('Appearance reset to default monochrome theme');
  };

  // Icon / Avatar management
  const setAppIconPreset = (preset: IconPreset) => {
    setIcons((prev) => {
      const next = {
        ...prev,
        appIconType: 'preset' as const,
        appIconPreset: preset,
      };
      if (prev.syncAppIconAndAvatar) {
        next.avatarType = 'preset';
        next.avatarPreset = preset;
      }
      return next;
    });
    showToast('App icon updated');
  };

  const setAppIconCustom = (dataUrl: string) => {
    setIcons((prev) => {
      const next = {
        ...prev,
        appIconType: 'custom' as const,
        appIconCustomUrl: dataUrl,
      };
      if (prev.syncAppIconAndAvatar) {
        next.avatarType = 'custom';
        next.avatarCustomUrl = dataUrl;
      }
      return next;
    });
    showToast('Custom app icon applied');
  };

  const setAvatarPreset = (preset: IconPreset) => {
    setIcons((prev) => {
      const next = {
        ...prev,
        avatarType: 'preset' as const,
        avatarPreset: preset,
      };
      if (prev.syncAppIconAndAvatar) {
        next.appIconType = 'preset';
        next.appIconPreset = preset;
      }
      return next;
    });
    showToast('Avatar updated');
  };

  const setAvatarCustom = (dataUrl: string) => {
    setIcons((prev) => {
      const next = {
        ...prev,
        avatarType: 'custom' as const,
        avatarCustomUrl: dataUrl,
        previousAvatarCustomUrl: dataUrl,
      };
      if (prev.syncAppIconAndAvatar) {
        next.appIconType = 'custom';
        next.appIconCustomUrl = dataUrl;
      }
      return next;
    });
    showToast('Custom avatar applied');
  };

  const removeAvatar = () => {
    setIcons((prev) => ({
      ...prev,
      // preserve previous custom url so it can be restored
      previousAvatarCustomUrl: prev.avatarCustomUrl || prev.previousAvatarCustomUrl,
      avatarType: 'preset',
      avatarPreset: 'axon-orb',
      avatarCustomUrl: undefined,
    }));
    showToast('Avatar reverted to default');
  };

  const restoreAvatar = () => {
    if (!icons.previousAvatarCustomUrl) {
      showToast('No previous custom avatar to restore');
      return;
    }
    setIcons((prev) => ({
      ...prev,
      avatarType: 'custom',
      avatarCustomUrl: prev.previousAvatarCustomUrl,
    }));
    showToast('Custom avatar restored');
  };

  const setSyncAppIconAndAvatar = (sync: boolean) => {
    setIcons((prev) => {
      const next = { ...prev, syncAppIconAndAvatar: sync };
      if (sync) {
        // synchronize avatar with app icon
        next.avatarType = prev.appIconType;
        next.avatarPreset = prev.appIconPreset;
        next.avatarCustomUrl = prev.appIconCustomUrl;
      }
      return next;
    });
    showToast(sync ? 'App icon & Avatar synced' : 'App icon & Avatar independent');
  };

  const setAppNameTextCase = (textCase: AppNameTextCase) => {
    setIcons((prev) => ({
      ...prev,
      appNameTextCase: textCase,
    }));
  };

  // State Export / Import
  const exportStateJson = (): string => {
    const data: AppStateData = {
      settings: {
        theme,
        icons,
        notificationsEnabled,
        soundEnabled,
        aiAccounts,
        activeModelId,
        codeSkillLevel,
        activeProjectId,
        storageBudget,
      },
      projects,
      projectActivities,
      messages,
      notes,
      assetManifest,
      userContent: {
        customFiles: [],
        savedScripts,
        automationRules,
        runCodeEntries,
      },
    };
    return JSON.stringify(data, null, 2);
  };

  const importStateJson = (jsonString: string): boolean => {
    try {
      const parsed: AppStateData = JSON.parse(jsonString);
      if (parsed.settings) {
        if (parsed.settings.theme) setTheme(parsed.settings.theme);
        if (parsed.settings.icons) setIcons(parsed.settings.icons);
        if (parsed.settings.notificationsEnabled !== undefined) {
          setNotificationsEnabled(parsed.settings.notificationsEnabled);
        }
        if (Array.isArray(parsed.settings.aiAccounts)) {
          setAiAccounts(parsed.settings.aiAccounts);
        }
        if (parsed.settings.activeModelId) {
          const mid = parsed.settings.activeModelId;
          setActiveModelId(
            mid === 'gemini-3.6-flash' || mid === 'gemini-2.5-flash' || mid === 'gemini-2.5-pro' || !mid
              ? 'gemini-3.8-flash'
              : mid
          );
        }
        if (parsed.settings.generalSettings) {
          setGeneralSettings({ ...DEFAULT_GENERAL_SETTINGS, ...parsed.settings.generalSettings });
        }
        if (parsed.settings.codeSkillLevel) {
          setCodeSkillLevel(parsed.settings.codeSkillLevel);
        }
        if (parsed.settings.activeProjectId) {
          setActiveProjectIdState(parsed.settings.activeProjectId);
        }
        if (parsed.settings.storageBudget) {
          setStorageBudget(parsed.settings.storageBudget);
        }
      }
      if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        setProjects(parsed.projects);
      }
      if (Array.isArray(parsed.projectActivities) && parsed.projectActivities.length > 0) {
        setProjectActivities(parsed.projectActivities);
      }
      if (Array.isArray(parsed.messages)) setMessages(sanitizeMessages(parsed.messages));
      if (Array.isArray(parsed.notes)) setNotes(parsed.notes);
      if (Array.isArray(parsed.assetManifest)) {
        const seenIds = new Set<string>();
        const seenLocations = new Set<string>();
        const deduped: AssetManifestItem[] = [];
        for (let i = 0; i < parsed.assetManifest.length; i++) {
          const item = parsed.assetManifest[i];
          if (!item) continue;
          const loc = item.storageLocation || item.name;
          if (loc && seenLocations.has(loc)) continue;
          if (loc) seenLocations.add(loc);

          let safeId = item.id;
          if (!safeId || seenIds.has(safeId)) {
            safeId = `asset-${item.category || 'user_file'}-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 8)}`;
          }
          seenIds.add(safeId);
          deduped.push({ ...item, id: safeId });
        }
        setAssetManifest(deduped);
      }
      if (parsed.userContent?.savedScripts && Array.isArray(parsed.userContent.savedScripts)) {
        setSavedScripts(parsed.userContent.savedScripts);
      }
      if (parsed.userContent?.automationRules && Array.isArray(parsed.userContent.automationRules)) {
        setAutomationRules(parsed.userContent.automationRules);
      }
      if (parsed.userContent?.runCodeEntries && Array.isArray(parsed.userContent.runCodeEntries)) {
        setRunCodeEntries(parsed.userContent.runCodeEntries);
      }
      showToast('Workspace data successfully restored');
      return true;
    } catch (e) {
      showToast('Failed to parse workspace backup file');
      return false;
    }
  };

  const resetAllData = () => {
    requestConfirmation({
      title: 'Reset All Data',
      message: 'Are you sure you want to delete all local data and reset AXON to factory defaults?',
      confirmLabel: 'Reset Everything',
      danger: true,
      onConfirm: () => {
        localStorage.removeItem(STORAGE_KEY);
        setProjects(DEFAULT_PROJECTS);
        setProjectActivities(DEFAULT_PROJECT_ACTIVITIES);
        setActiveProjectIdState('proj-general');
        setMessages(DEFAULT_MESSAGES);
        setNotes(DEFAULT_NOTES);
        setIcons(DEFAULT_ICONS);
        setTheme(DEFAULT_THEME);
        setAiAccounts(DEFAULT_AI_ACCOUNTS);
        setActiveModelId('gemini-3.8-flash');
        setCodeSkillLevel('guided');
        setSavedScripts(DEFAULT_SAVED_SCRIPTS);
        setAutomationRules(DEFAULT_AUTOMATION_RULES);
        setRunCodeEntries(DEFAULT_RUN_CODE_ENTRIES);
        setAssetManifest(DEFAULT_ASSET_MANIFEST);
        setStorageBudget(DEFAULT_STORAGE_BUDGET_CONFIG);
        setGeneralSettings(DEFAULT_GENERAL_SETTINGS);
        closeConfirmation();
        showToast('AXON reset to factory defaults');
      },
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        previousScreen,
        canGoBack,
        navHistory,
        navigateTo,
        goBack,
        activePanel,
        activePanelPayload,
        openPanel,
        closePanel,
        isPanelOpen,
        pushNavState,
        paneViewState,
        setPaneViewState: updatePaneViewState,
        splitRatio,
        setSplitRatio: updateSplitRatio,
        projects,
        activeProjectId,
        activeProject,
        setActiveProjectId,
        createProject,
        updateProject,
        deleteProject,
        messages,
        activeProjectMessages,
        addMessage,
        deleteMessage,
        clearMessages,
        availableModels,
        activeModelId,
        activeModel,
        setActiveModelId,
        aiAccounts,
        activeAccount,
        addAIAccount,
        updateAIAccount,
        deleteAIAccount,
        switchAccount,
        clearCooldown,
        isGeneratingResponse,
        conversationSummary,
        taskQueue,
        cancelCurrentTask,
        clearTaskQueue,
        removeQueuedTask,
        codeSkillLevel,
        setCodeSkillLevel,
        savedScripts,
        saveScript,
        deleteScript,
        workspaceCodeLoadMode,
        setWorkspaceCodeLoadMode,
        workspaceSnippetHistory,
        addWorkspaceSnippetHistory,
        deleteWorkspaceSnippetHistoryItem,
        clearWorkspaceSnippetHistory,
        workspaceCode,
        setWorkspaceCode,
        workspaceMode,
        setWorkspaceMode,
        workspaceActiveTab,
        setWorkspaceActiveTab,
        workspaceExecutionError,
        setWorkspaceExecutionError,
        addChatNotification,
        automationRules,
        saveRule,
        deleteRule,
        toggleRule,
        testRule,
        runCodeEntries,
        saveRunCodeEntry,
        deleteRunCodeEntry,
        toggleRunCodeEntry,
        testRunCodeEntry,
        capabilityRegistry,
        projectActivities,
        recordProjectActivity,
        queryTimeline,
        notes,
        activeProjectNotes,
        addNote,
        updateNote,
        togglePinNote,
        deleteNote,
        extractConversationToNote,
        extractSingleMessageToNote,
        exportConversationToFile,
        assetManifest,
        storageBudget,
        storageBreakdown,
        deviceStorageEstimate,
        registerAssetInManifest,
        updateAssetManifestItem,
        deleteAssetFromManifest,
        setAssetSaveMode,
        revertOrEnhanceAssetItem,
        updateStorageBudget,
        trimStorageWithPlan,
        refreshStaleKnowledgeAsset,
        theme,
        setThemeMode,
        setAccentColor,
        setFunctionColor,
        resetThemeToDefault,
        icons,
        setAppIconPreset,
        setAppIconCustom,
        setAvatarPreset,
        setAvatarCustom,
        removeAvatar,
        restoreAvatar,
        setSyncAppIconAndAvatar,
        setAppNameTextCase,
        notificationsEnabled,
        setNotificationsEnabled,
        soundEnabled,
        setSoundEnabled,
        requestConfirmation,
        confirmationConfig,
        closeConfirmation,
        exportStateJson,
        importStateJson,
        resetAllData,
        generalSettings,
        updateGeneralSettings,
        toastMessage,
        showToast,
        isMenuOpen,
        setIsMenuOpen,
        openMenu,
        closeMenu,
        drawerGestureOffset,
        setDrawerGestureOffset,
        toggleAssetEnabled,
        reallocateAssetSpace,
        addDownloadablePack,
        removeDownloadablePack,
        setStorageBudgetBytes,
        hasCompletedStorageOnboarding,
        setHasCompletedStorageOnboarding,
        liveThinkingStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
