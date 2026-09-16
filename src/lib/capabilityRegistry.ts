import { AIAccount, AIProvider } from '../types';
import { isAccountInCooldown, getRemainingCooldownString } from './aiConfig';

export type CapabilityFeature =
  | 'reasoning'
  | 'vision_multimodal'
  | 'code_generation'
  | 'fast_turnaround'
  | 'offline_execution'
  | 'document_analysis'
  | 'math_tools'
  | 'storage_manifest'
  | 'file_search';

export interface ExternalToolCapability {
  id: string;
  name: string;
  provider: AIProvider;
  accountId: string;
  accountLabel: string;
  isAvailable: boolean;
  reasonUnavailable?: string;
  supportedFeatures: CapabilityFeature[];
  rateLimitStatus: {
    isRateLimited: boolean;
    cooldownUntil?: number;
    remainingCooldownFormatted?: string;
  };
  priorityTier: number; // 1 = preferred, 2 = secondary, 3 = fallback
}

export interface CapabilityRegistry {
  lastChecked: string;
  capabilities: ExternalToolCapability[];
  hasFeature: (feature: CapabilityFeature) => boolean;
  getAvailableCapabilities: () => ExternalToolCapability[];
  getCapabilitiesForFeature: (feature: CapabilityFeature) => ExternalToolCapability[];
  getCapabilityByProvider: (provider: string) => ExternalToolCapability | undefined;
  getBestDelegateFor: (task: {
    feature: CapabilityFeature;
    requiresVision?: boolean;
    requiresOffline?: boolean;
  }) => ExternalToolCapability | null;
  getRegistrySummary: () => {
    totalConfigured: number;
    availableCount: number;
    activeProviders: string[];
    supportedFeatures: CapabilityFeature[];
  };
}

/**
 * Builds an internal capability registry from the user's configured AI accounts.
 * This evaluates access credentials, cooldown timers, and feature availability
 * so AXON knows what external tools it can safely delegate tasks to.
 */
export function buildCapabilityRegistry(accounts: AIAccount[]): CapabilityRegistry {
  const capabilities: ExternalToolCapability[] = [];

  for (const account of accounts) {
    // AXON local core is internal intelligence, not an external delegated tool
    if (account.provider === 'axon') continue;

    const inCooldown = isAccountInCooldown(account);
    const cooldownStr = getRemainingCooldownString(account);

    switch (account.provider) {
      case 'gemini': {
        // Gemini: Fast multimodal, code generation, reasoning
        const hasKeyOrServer = Boolean(account.apiKey && account.apiKey.trim().length > 0) || true; // Server-side fallback supported
        const isAvail = account.isActive && !inCooldown && hasKeyOrServer;
        let reason: string | undefined;
        if (!account.isActive) reason = 'Account disabled by user';
        else if (inCooldown) reason = `Account in cooldown (${cooldownStr || 'rate limited'})`;

        capabilities.push({
          id: `cap-${account.id}`,
          name: `Gemini API (${account.label})`,
          provider: 'gemini',
          accountId: account.id,
          accountLabel: account.label,
          isAvailable: isAvail,
          reasonUnavailable: reason,
          supportedFeatures: [
            'vision_multimodal',
            'code_generation',
            'reasoning',
            'fast_turnaround',
            'document_analysis',
          ],
          rateLimitStatus: {
            isRateLimited: Boolean(inCooldown || account.isRateLimited),
            cooldownUntil: account.cooldownUntil,
            remainingCooldownFormatted: cooldownStr || undefined,
          },
          priorityTier: 1,
        });
        break;
      }

      case 'claude': {
        // Claude: Deep reasoning, architecture, code synthesis
        const hasKey = Boolean(account.apiKey && account.apiKey.trim().length > 0);
        const isAvail = account.isActive && !inCooldown && hasKey;
        let reason: string | undefined;
        if (!account.isActive) reason = 'Account disabled by user';
        else if (!hasKey) reason = 'API key not configured in AI Accounts';
        else if (inCooldown) reason = `Account in cooldown (${cooldownStr || 'rate limited'})`;

        capabilities.push({
          id: `cap-${account.id}`,
          name: `Claude API (${account.label})`,
          provider: 'claude',
          accountId: account.id,
          accountLabel: account.label,
          isAvailable: isAvail,
          reasonUnavailable: reason,
          supportedFeatures: [
            'reasoning',
            'code_generation',
            'document_analysis',
            'vision_multimodal',
          ],
          rateLimitStatus: {
            isRateLimited: Boolean(inCooldown || account.isRateLimited),
            cooldownUntil: account.cooldownUntil,
            remainingCooldownFormatted: cooldownStr || undefined,
          },
          priorityTier: 2,
        });
        break;
      }

      case 'chatgpt': {
        // ChatGPT / OpenAI: General synthesis, code generation, reasoning
        const hasKey = Boolean(account.apiKey && account.apiKey.trim().length > 0);
        const isAvail = account.isActive && !inCooldown && hasKey;
        let reason: string | undefined;
        if (!account.isActive) reason = 'Account disabled by user';
        else if (!hasKey) reason = 'API key not configured in AI Accounts';
        else if (inCooldown) reason = `Account in cooldown (${cooldownStr || 'rate limited'})`;

        capabilities.push({
          id: `cap-${account.id}`,
          name: `ChatGPT API (${account.label})`,
          provider: 'chatgpt',
          accountId: account.id,
          accountLabel: account.label,
          isAvailable: isAvail,
          reasonUnavailable: reason,
          supportedFeatures: [
            'reasoning',
            'code_generation',
            'document_analysis',
            'vision_multimodal',
          ],
          rateLimitStatus: {
            isRateLimited: Boolean(inCooldown || account.isRateLimited),
            cooldownUntil: account.cooldownUntil,
            remainingCooldownFormatted: cooldownStr || undefined,
          },
          priorityTier: 2,
        });
        break;
      }

      default: {
        const hasKey = Boolean(account.apiKey && account.apiKey.trim().length > 0);
        const isAvail = account.isActive && !inCooldown && hasKey;
        capabilities.push({
          id: `cap-${account.id}`,
          name: `${account.label} (${account.provider})`,
          provider: account.provider,
          accountId: account.id,
          accountLabel: account.label,
          isAvailable: isAvail,
          reasonUnavailable: !isAvail ? 'Credentials missing or account paused' : undefined,
          supportedFeatures: ['reasoning', 'code_generation'],
          rateLimitStatus: {
            isRateLimited: Boolean(inCooldown || account.isRateLimited),
            cooldownUntil: account.cooldownUntil,
            remainingCooldownFormatted: cooldownStr || undefined,
          },
          priorityTier: 3,
        });
        break;
      }
    }
  }

  const getAvailableCapabilities = () => capabilities.filter((c) => c.isAvailable);

  const hasFeature = (feature: CapabilityFeature): boolean => {
    return capabilities.some((c) => c.isAvailable && c.supportedFeatures.includes(feature));
  };

  const getCapabilitiesForFeature = (feature: CapabilityFeature): ExternalToolCapability[] => {
    return capabilities.filter((c) => c.isAvailable && c.supportedFeatures.includes(feature));
  };

  const getCapabilityByProvider = (provider: string): ExternalToolCapability | undefined => {
    return capabilities.find((c) => c.provider.toLowerCase() === provider.toLowerCase());
  };

  const getBestDelegateFor = (task: {
    feature: CapabilityFeature;
    requiresVision?: boolean;
    requiresOffline?: boolean;
  }): ExternalToolCapability | null => {
    let pool = getAvailableCapabilities();

    if (task.requiresOffline) {
      pool = pool.filter((c) => c.supportedFeatures.includes('offline_execution'));
    }

    if (task.requiresVision) {
      pool = pool.filter((c) => c.supportedFeatures.includes('vision_multimodal'));
    }

    pool = pool.filter((c) => c.supportedFeatures.includes(task.feature));

    if (pool.length === 0) return null;

    // Sort by priority tier ascending
    pool.sort((a, b) => a.priorityTier - b.priorityTier);
    return pool[0] || null;
  };

  const getRegistrySummary = () => {
    const available = getAvailableCapabilities();
    const activeProviders = Array.from(new Set(available.map((c) => c.provider)));
    const allFeatures = Array.from(
      new Set(available.flatMap((c) => c.supportedFeatures))
    );
    return {
      totalConfigured: capabilities.length,
      availableCount: available.length,
      activeProviders,
      supportedFeatures: allFeatures,
    };
  };

  return {
    lastChecked: new Date().toISOString(),
    capabilities,
    hasFeature,
    getAvailableCapabilities,
    getCapabilitiesForFeature,
    getCapabilityByProvider,
    getBestDelegateFor,
    getRegistrySummary,
  };
}
