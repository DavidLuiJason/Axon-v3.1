export type ScreenId =
  | 'axon'
  | 'tools'
  | 'code'
  | 'codebase'
  | 'automation'
  | 'video_editor'
  | 'notes'
  | 'settings'
  | 'account'
  | 'notifications'
  | 'tool_text'
  | 'tool_calc'
  | 'tool_units'
  | 'tool_colors'
  | 'tool_images'
  | 'tool_files'
  | 'tool_speech_rate'
  | 'tool_bible'
  | 'storage'
  | 'tool_interface_capture';

export type PaneViewState = 'chat-only' | 'split' | 'workspace-only';

export interface ScrollPositionMap {
  [elementSelector: string]: { top: number; left: number };
}

export interface NavHistoryEntry {
  id: string;
  screen: ScreenId;
  isMenuOpen: boolean;
  paneViewState: PaneViewState;
  splitRatio: number;
  activePanel: string | null;
  panelPayload?: any;
  scrollPositions?: ScrollPositionMap;
  screenState?: Record<string, any>;
}

export interface ChatAttachment {
  name: string;
  type: string;
  size?: string;
  dataUrl?: string;
}

export type WorkspaceCodeLoadMode = 'manual' | 'auto';

export type WorkspaceMode = 'javascript' | 'html' | 'json';

export interface FormattedTraceback {
  errorName: string;
  errorMessage: string;
  lineNumber: number | null;
  columnNumber: number | null;
  fileName: string;
  codeSnippet: string;
  fullTraceback: string;
}

export interface WorkspaceSnippetHistoryItem {
  id: string;
  title: string;
  code: string;
  language: string;
  timestamp: string;
  source?: 'chat_auto' | 'chat_manual' | 'editor_run' | 'editor_save' | 'custom';
  lineCount?: number;
  byteSize?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'axon';
  text: string;
  timestamp: string;
  projectId?: string;
  modelUsed?: string;
  accountUsed?: string;
  isRateLimitedNotice?: boolean;
  workspaceArtifactId?: string;
  workspaceArtifactTitle?: string;
  hasBuildRunResult?: boolean;
  isResultUnavailable?: boolean;
  showFullCodeInChat?: boolean;
  attachment?: ChatAttachment;
  attachments?: ChatAttachment[];
}

export interface QueuedTask {
  id: string;
  text: string;
  attachment?: ChatAttachment;
  attachments?: ChatAttachment[];
  projectId?: string;
  createdAt: string;
}

export type NoteCategory = 'general' | 'extracted_chat' | 'code' | 'prompt' | 'spec' | string;

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  projectId?: string;
  category: NoteCategory;
  tags: string[];
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  systemContext?: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
  activityCount?: number;
  lastActivityAt?: string;
}

export type ProjectActivityType =
  | 'message_sent'
  | 'note_created'
  | 'note_updated'
  | 'code_executed'
  | 'file_uploaded'
  | 'tool_used'
  | 'project_created'
  | 'project_milestone'
  | 'plan_created'
  | 'task_completed';

export interface ProjectActivityEvent {
  id: string;
  projectId: string;
  timestamp: string; // ISO-8601 string e.g. "2026-09-11T04:49:10.000Z"
  dateString: string; // YYYY-MM-DD for fast date-based index
  timeString: string; // HH:MM
  type: ProjectActivityType;
  title: string;
  summary: string;
  metadata?: Record<string, any>;
}

export interface ProjectTimelineQuery {
  projectId?: string;
  date?: string; // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  types?: ProjectActivityType[];
  searchTerm?: string;
  limit?: number;
}

export type FileIntelligenceType = 'document' | 'image' | 'video' | 'audio' | 'code';

export interface FileIndexEntry {
  id: string;
  name: string;
  fileType: FileIntelligenceType;
  mimeType: string;
  sizeBytes: number;
  pathOrLocation?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    pageCount?: number;
    dimensions?: { width: number; height: number };
    durationSeconds?: number;
    language?: string;
    linesOfCode?: number;
    encoding?: string;
  };
  extractedSummary?: string;
  keywords?: string[];
  tags?: string[];
}

export interface FileSearchQuery {
  naturalLanguageQuery: string;
  fileTypes?: FileIntelligenceType[];
  projectId?: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
  minScore?: number;
  limit?: number;
}

export interface FileSearchResult {
  entry: FileIndexEntry;
  matchScore: number;
  matchedReasons: string[];
  excerpt?: string;
}

export type IconPreset = 'axon-orb' | 'axon-minimal' | 'axon-neural' | 'axon-cyber';

export type AppNameTextCase = 'lowercase' | 'uppercase' | 'first-letter';

export const formatAppNameCase = (textCase?: AppNameTextCase, baseName: string = 'AXON'): string => {
  if (textCase === 'lowercase') {
    return baseName.toLowerCase();
  }
  if (textCase === 'first-letter') {
    return baseName.charAt(0).toUpperCase() + baseName.slice(1).toLowerCase();
  }
  return baseName.toUpperCase();
};

export interface IconAvatarSettings {
  appIconType: 'preset' | 'custom';
  appIconPreset: IconPreset;
  appIconCustomUrl?: string;
  avatarType: 'preset' | 'custom';
  avatarPreset: IconPreset;
  avatarCustomUrl?: string;
  syncAppIconAndAvatar: boolean;
  showChatAvatar: boolean;
  appNameTextCase?: AppNameTextCase;
  previousAppIconCustomUrl?: string;
  previousAvatarCustomUrl?: string;
}

export interface FunctionColors {
  aiChatBubbleBg: string;
  aiChatBubbleText: string;
  userChatBubbleBg: string;
  userChatBubbleText: string;
  userBubbleColor?: string;
  axonBubbleColor?: string;
  sendButtonColor: string;
  chatInputBg: string;
  userMsgBtnColor: string;
  axonMsgBtnColor: string;
  messageButtonAutoContrast: boolean;
  micRecordingColor?: string;
  toolText: string;
  toolCalc: string;
  toolColors: string;
  toolImages: string;
  toolFiles: string;
  toolBible: string;
  toolSpeech: string;
  videoEditor: string;
  codeWorkspace: string;
  notesLibrary: string;
  storageManifest: string;
}

export interface ThemeSettings {
  mode: 'dark' | 'light';
  accentColor: string;
  palette: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    activeHighlight: string;
    avatarGlow: string;
  };
  functionColors: FunctionColors;
}

export type AIProvider = 'gemini' | 'claude' | 'chatgpt' | 'axon' | string;

export interface AIAccount {
  id: string;
  provider: AIProvider;
  label: string;
  apiKey: string;
  isActive: boolean;
  isRateLimited?: boolean;
  cooldownUntil?: number;
  rateLimitHits?: number;
  createdAt: string;
}

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  providerName: string;
  badge?: string;
  description: string;
}

export type CodeSkillLevel = 'beginner' | 'guided' | 'advanced';

export interface SavedScript {
  id: string;
  title: string;
  code: string;
  language: string;
  skillLevel?: CodeSkillLevel;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export type RuleTriggerType =
  | 'connection_error'
  | 'rate_limit'
  | 'keyword_match'
  | 'project_switched'
  | 'file_attached'
  | 'storage_limit_near'
  | string;

export type RuleActionType =
  | 'retry_automatically'
  | 'notify_user'
  | 'auto_format_code'
  | 'switch_account'
  | 'run_script'
  | 'trim_storage'
  | string;

export interface AutomationRule {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  triggerType: RuleTriggerType;
  triggerLabel: string;
  triggerCondition: string;
  actionType: RuleActionType;
  actionLabel: string;
  actionConfig: Record<string, any>;
  plainLanguagePrompt?: string;
  creationMode?: 'plain_language' | 'custom' | 'guided_form';
  createdAt: string;
  updatedAt: string;
  triggerCount: number;
}

export interface RunCodeEntry {
  id: string;
  title: string;
  description: string;
  commandKeyword?: string;
  category: 'prompt_filter' | 'response_transform' | 'utility' | string;
  hookPoint: 'pre_prompt' | 'post_response' | 'standalone' | string;
  code: string;
  language: string;
  enabled: boolean;
  author: string;
  version: string;
  executionCount: number;
  createdAt: string;
  updatedAt: string;
}

export type AssetCategory =
  | 'model'
  | 'knowledge_pack'
  | 'user_file'
  | 'chat_history'
  | 'cache'
  | 'system';

export type SaveMode = 'archive' | 'space_saver';

export type QualityState =
  | 'lossless'
  | 'original'
  | 'downsampled'
  | 'enhanced'
  | 'approximated'
  | string;

export type KnowledgeStatus = 'current' | 'stale' | 'not_applicable' | string;

export type TrimCategoryPriority =
  | 'cache'
  | 'chat_history'
  | 'user_file'
  | 'knowledge_pack'
  | 'model';

export interface StorageBudgetConfig {
  budgetBytes: number;
  customLimitBytes?: number;
  warningThresholdPercent: number;
  hasCompletedOnboarding: boolean;
  trimPriority: TrimCategoryPriority[];
  autoTrimEnabled?: boolean;
}

export interface AssetManifestItem {
  id: string;
  name: string;
  category: AssetCategory;
  storageLocation: string;
  mimeType: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  allocatedSizeBytes?: number;
  saveMode: SaveMode;
  isOriginalPreserved: boolean;
  qualityState: QualityState;
  knowledgeStatus: KnowledgeStatus;
  staleReason?: string;
  isEnabled?: boolean;
  isCore?: boolean;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
}

export interface GeneralSettings {
  deleteConfirmationWaitTimerSeconds: number;
  deleteConfirmationTimerEnabled: boolean;
  userReadingSpeedWpm: number;
  aiCallMode: 'single' | 'multi' | string;
  viewerAnimationEnabled?: boolean;
  backgroundAnimationEnabled?: boolean;
}

export interface AppStateData {
  settings?: {
    theme?: ThemeSettings;
    icons?: IconAvatarSettings;
    notificationsEnabled?: boolean;
    soundEnabled?: boolean;
    aiAccounts?: AIAccount[];
    activeModelId?: string;
    codeSkillLevel?: CodeSkillLevel;
    activeProjectId?: string;
    storageBudget?: StorageBudgetConfig;
    generalSettings?: GeneralSettings;
    viewerAnimationEnabled?: boolean;
    backgroundAnimationEnabled?: boolean;
  };
  projects?: ProjectItem[];
  projectActivities?: ProjectActivityEvent[];
  messages?: ChatMessage[];
  notes?: NoteItem[];
  assetManifest?: AssetManifestItem[];
  userContent?: {
    customFiles?: any[];
    savedScripts?: SavedScript[];
    automationRules?: AutomationRule[];
    runCodeEntries?: RunCodeEntry[];
  };
}

export * from './lib/media/types';
