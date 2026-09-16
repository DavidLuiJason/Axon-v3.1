export interface SettingsCommandHandlers {
  theme?: any;
  setThemeMode?: (mode: 'dark' | 'light') => void;
  setAccentColor?: (color: string) => void;
  setFunctionColor?: (key: string, color: string) => void;
  resetThemeToDefault?: () => void;
  icons?: any;
  setAppIconPreset?: (preset: string) => void;
  setAvatarPreset?: (preset: string) => void;
  setAppNameTextCase?: (val: any) => void;
  codeSkillLevel?: string;
  setCodeSkillLevel?: (level: any) => void;
  workspaceCodeLoadMode?: string;
  setWorkspaceCodeLoadMode?: (mode: any) => void;
  soundEnabled?: boolean;
  setSoundEnabled?: (enabled: boolean) => void;
  notificationsEnabled?: boolean;
  setNotificationsEnabled?: (enabled: boolean) => void;
}

export interface SettingsEvaluationResult {
  handled: boolean;
  executed?: boolean;
  response: string;
}

/**
 * Evaluates natural language commands in chat that control application settings.
 */
export function evaluateSettingsCommand(
  text: string,
  handlers: SettingsCommandHandlers
): SettingsEvaluationResult {
  const lower = text.trim().toLowerCase();

  // Dark / Light Theme Mode
  if (
    lower.includes('switch to dark') ||
    lower.includes('set theme to dark') ||
    lower.includes('enable dark mode') ||
    lower.includes('dark theme')
  ) {
    if (handlers.setThemeMode) {
      handlers.setThemeMode('dark');
      return {
        handled: true,
        executed: true,
        response: 'Theme switched to Dark Mode.',
      };
    }
  }

  if (
    lower.includes('switch to light') ||
    lower.includes('set theme to light') ||
    lower.includes('enable light mode') ||
    lower.includes('light theme')
  ) {
    if (handlers.setThemeMode) {
      handlers.setThemeMode('light');
      return {
        handled: true,
        executed: true,
        response: 'Theme switched to Light Mode.',
      };
    }
  }

  // Reset Theme
  if (lower.includes('reset theme') || lower.includes('default theme')) {
    if (handlers.resetThemeToDefault) {
      handlers.resetThemeToDefault();
      return {
        handled: true,
        executed: true,
        response: 'Theme and accent colors have been reset to factory defaults.',
      };
    }
  }

  // Accent Colors
  const colorMatch = lower.match(/(?:set|change|switch)\s+(?:accent|theme)\s+color\s+to\s+([a-zA-Z#0-9]+)/i);
  if (colorMatch && handlers.setAccentColor) {
    const rawColor = colorMatch[1].toLowerCase();
    const colorMap: Record<string, string> = {
      blue: '#3b82f6',
      emerald: '#10b981',
      green: '#10b981',
      purple: '#8b5cf6',
      violet: '#8b5cf6',
      amber: '#f59e0b',
      orange: '#f97316',
      red: '#ef4444',
      rose: '#f43f5e',
      cyan: '#06b6d4',
      monochrome: '#737373',
      white: '#ffffff',
    };
    const targetHex = colorMap[rawColor] || (rawColor.startsWith('#') ? rawColor : null);
    if (targetHex) {
      handlers.setAccentColor(targetHex);
      return {
        handled: true,
        executed: true,
        response: `Accent color updated to ${rawColor} (${targetHex}).`,
      };
    }
  }

  // Sound toggle
  if (lower.includes('mute sound') || lower.includes('disable sound') || lower.includes('turn off sound')) {
    if (handlers.setSoundEnabled) {
      handlers.setSoundEnabled(false);
      return {
        handled: true,
        executed: true,
        response: 'Application sound effects disabled.',
      };
    }
  }
  if (lower.includes('enable sound') || lower.includes('unmute sound') || lower.includes('turn on sound')) {
    if (handlers.setSoundEnabled) {
      handlers.setSoundEnabled(true);
      return {
        handled: true,
        executed: true,
        response: 'Application sound effects enabled.',
      };
    }
  }

  // Code skill level
  if (lower.includes('set code level') || lower.includes('set skill level')) {
    if (lower.includes('beginner') && handlers.setCodeSkillLevel) {
      handlers.setCodeSkillLevel('beginner');
      return { handled: true, executed: true, response: 'Code skill level updated to Beginner.' };
    }
    if (lower.includes('guided') && handlers.setCodeSkillLevel) {
      handlers.setCodeSkillLevel('guided');
      return { handled: true, executed: true, response: 'Code skill level updated to Guided.' };
    }
    if (lower.includes('advanced') && handlers.setCodeSkillLevel) {
      handlers.setCodeSkillLevel('advanced');
      return { handled: true, executed: true, response: 'Code skill level updated to Advanced.' };
    }
  }

  return {
    handled: false,
    response: '',
  };
}
