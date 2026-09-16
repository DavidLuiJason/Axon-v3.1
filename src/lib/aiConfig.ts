import { AIAccount, AIModelOption, AIProvider } from '../types';
import { usageQuotaEngine } from './usageQuotaEngine';

export const AVAILABLE_AI_MODELS: AIModelOption[] = [
  {
    id: 'axon-offline-core',
    name: 'AXON Neural Engine',
    provider: 'axon',
    providerName: 'AXON Local Core',
    badge: 'On-Device',
    description: 'Instant zero-latency on-device workspace intelligence without external API limits.',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    providerName: 'Google Gemini',
    badge: 'Recommended',
    description: 'Ultra-fast multimodal reasoning, coding analysis, and low token latency.',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    providerName: 'Google Gemini',
    badge: 'Deep Reasoning',
    description: 'Complex architectural code generation, multi-file synthesis, and extended reasoning.',
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'claude',
    providerName: 'Anthropic',
    badge: 'Hybrid Coding',
    description: 'Sophisticated code architecture, refactoring, and logical consistency.',
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'claude',
    providerName: 'Anthropic',
    badge: 'Fast Coding',
    description: 'High-speed code execution, script generation, and concise outputs.',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'chatgpt',
    providerName: 'OpenAI',
    badge: 'Multimodal Flagship',
    description: 'Versatile intelligence, code generation, and function automation.',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'chatgpt',
    providerName: 'OpenAI',
    badge: 'Lightweight',
    description: 'Fast, cost-effective processing for routine programming tasks.',
  },
];

export const EXTERNAL_AI_CATALOG: AIModelOption[] = AVAILABLE_AI_MODELS.filter(
  (m) => m.provider !== 'axon' && m.id !== 'axon-offline-core'
);

export const DEFAULT_AI_ACCOUNTS: AIAccount[] = [
  {
    id: 'acc-axon-internal',
    provider: 'axon',
    label: 'AXON Core (Offline)',
    apiKey: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-gemini-primary',
    provider: 'gemini',
    label: 'Gemini Primary (Default)',
    apiKey: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-gemini-backup',
    provider: 'gemini',
    label: 'Gemini Secondary / Backup',
    apiKey: '',
    isActive: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-claude-primary',
    provider: 'claude',
    label: 'Claude Personal Tier',
    apiKey: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-openai-primary',
    provider: 'chatgpt',
    label: 'OpenAI Standard API',
    apiKey: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

/**
 * Checks if a given account or account ID is currently in rate-limit cooldown.
 */
export function isAccountInCooldown(account?: AIAccount | string): boolean {
  if (!account) return false;
  return usageQuotaEngine.isAccountInCooldown(account);
}

/**
 * Returns human-readable remaining cooldown time (e.g. "14m 32s" or "Expired").
 */
export function getRemainingCooldownString(account?: AIAccount | number | string): string {
  if (!account) return '';
  return usageQuotaEngine.getRemainingCooldownString(account);
}

/**
 * Finds an account matching the query label (case-insensitive fuzzy/exact match).
 */
export function findAccountByLabel(
  accounts: AIAccount[],
  query: string,
  preferredProvider?: AIProvider
): AIAccount | undefined {
  const clean = query.trim().toLowerCase();
  if (!clean) return undefined;

  // 1. Exact match
  const exact = accounts.find(
    (a) => a.label.toLowerCase() === clean && (!preferredProvider || a.provider === preferredProvider)
  );
  if (exact) return exact;

  // 2. Includes match with preferred provider
  if (preferredProvider) {
    const providerMatches = accounts.filter((a) => a.provider === preferredProvider);
    const subMatch = providerMatches.find((a) => a.label.toLowerCase().includes(clean));
    if (subMatch) return subMatch;
  }

  // 3. Any includes match
  return accounts.find((a) => a.label.toLowerCase().includes(clean));
}
