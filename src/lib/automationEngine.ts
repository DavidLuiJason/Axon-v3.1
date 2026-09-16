import { AutomationRule, RunCodeEntry, RuleTriggerType, RuleActionType } from '../types';

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'rule-auto-retry',
    title: 'Auto-Retry on Connection Loss',
    description: 'Automatically re-dispatches the last prompt if a network drops or times out.',
    enabled: true,
    triggerType: 'connection_error',
    triggerLabel: 'Connection Issue or Network Failure',
    triggerCondition: 'Connection drops or request times out',
    actionType: 'retry_automatically',
    actionLabel: 'Retry Request Automatically (Max 3)',
    actionConfig: { maxRetries: 3 },
    creationMode: 'plain_language',
    plainLanguagePrompt: 'if connection drops, retry automatically',
    triggerCount: 2,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'rule-rate-limit',
    title: 'Quota Diagnostic Alert',
    description: 'Displays a diagnostic notification card when an API returns HTTP 429.',
    enabled: true,
    triggerType: 'rate_limit',
    triggerLabel: 'Usage Limit Reached (HTTP 429)',
    triggerCondition: 'Active account returns 429 Too Many Requests',
    actionType: 'notify_user',
    actionLabel: 'Show Rate Limit Diagnostics Banner',
    actionConfig: { customMessage: 'Provider rate limit reached. AXON local fallback active.' },
    creationMode: 'plain_language',
    plainLanguagePrompt: 'if an account hits usage limit, show diagnostic notice',
    triggerCount: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

export const DEFAULT_RUN_CODE_ENTRIES: RunCodeEntry[] = [
  {
    id: 'entry-status-cmd',
    title: 'System Status Command',
    description: 'Responds to /status with workspace telemetry and memory health.',
    commandKeyword: '/status',
    category: 'utility',
    hookPoint: 'custom_command',
    code: `// Custom slash command handler for /status
return {
  status: "nominal",
  engine: "AXON Core v2.4",
  timestamp: new Date().toISOString(),
  activeRules: context.activeRulesCount,
  activeExtensions: context.activeRunCodeCount,
  selectedModel: context.userModel,
  memory: "Protected Local Sandbox"
};`,
    language: 'javascript',
    enabled: true,
    author: 'AXON System',
    version: '1.0.0',
    executionCount: 5,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'entry-timestamp-preprompt',
    title: 'Pre-Prompt Context Enricher',
    description: 'Prepends local time context to messages when requested.',
    commandKeyword: '',
    category: 'prompt_filter',
    hookPoint: 'pre_prompt',
    code: `// Pre-prompt hook
// Return input directly or modify it
return input;`,
    language: 'javascript',
    enabled: false,
    author: 'User',
    version: '0.9.0',
    executionCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

/**
 * Executes a Run Code script safely in client-side scope.
 */
export async function executeRunCodeScript(
  entry: RunCodeEntry,
  input: string,
  context: Record<string, any> = {}
): Promise<{ success: boolean; output: string; executionTimeMs: number; error?: string }> {
  const startTime = performance.now();
  try {
    // eslint-disable-next-line no-new-func
    const runner = new Function('input', 'context', entry.code);
    const result = await runner(input, context);

    const executionTimeMs = Math.round(performance.now() - startTime);
    const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result ?? 'Done');

    return {
      success: true,
      output,
      executionTimeMs,
    };
  } catch (err: any) {
    const executionTimeMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      output: '',
      executionTimeMs,
      error: err?.message || 'Execution failed',
    };
  }
}

/**
 * Parses a plain-language prompt (e.g. "if connection fails, retry automatically")
 * into a structured AutomationRule draft.
 */
export function parsePlainLanguageRule(prompt: string): {
  title: string;
  description: string;
  triggerType: RuleTriggerType;
  triggerLabel: string;
  triggerCondition: string;
  actionType: RuleActionType;
  actionLabel: string;
  actionConfig: {
    maxRetries?: number;
    customMessage?: string;
    instructionPayload?: string;
  };
} {
  const lower = prompt.toLowerCase();

  let triggerType: RuleTriggerType = 'connection_error';
  let triggerLabel = 'Connection Issue or Network Failure';
  let triggerCondition = 'Connection drops or request times out';

  let actionType: RuleActionType = 'retry_automatically';
  let actionLabel = 'Retry Request Automatically (Max 3)';
  const actionConfig: { maxRetries?: number; customMessage?: string; instructionPayload?: string } = {
    maxRetries: 3,
  };

  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('usage limit')) {
    triggerType = 'rate_limit';
    triggerLabel = 'Usage Limit Reached (HTTP 429)';
    triggerCondition = 'Active account returns 429 Too Many Requests';
    actionType = 'notify_user';
    actionLabel = 'Show Diagnostic Notice Card';
    actionConfig.customMessage = 'Rate limit reached. AXON local fallback active.';
  } else if (lower.includes('code') || lower.includes('syntax') || lower.includes('format')) {
    triggerType = 'keyword_match';
    triggerLabel = 'Code Request Detected';
    triggerCondition = 'Prompt asks for code or algorithm';
    actionType = 'auto_format_code';
    actionLabel = 'Auto-Format with Syntax Highlighting';
  } else if (lower.includes('storage') || lower.includes('space') || lower.includes('budget')) {
    triggerType = 'storage_limit_near';
    triggerLabel = 'Storage Space Reaching Budget';
    triggerCondition = 'Storage usage exceeds 80% of budget';
    actionType = 'trim_storage';
    actionLabel = 'Generate Space-Saver Trim Plan';
  }

  const title = prompt.length > 40 ? `${prompt.slice(0, 37)}...` : prompt;

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description: `Rule generated from: "${prompt}"`,
    triggerType,
    triggerLabel,
    triggerCondition,
    actionType,
    actionLabel,
    actionConfig,
  };
}
