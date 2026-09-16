import React from 'react';
import {
  MessageSquare,
  Wrench,
  Code2,
  FileText,
  Settings,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ScreenId } from '../types';

export const BottomNavigationBar: React.FC = () => {
  const { currentScreen, navigateTo, paneViewState } = useApp();

  const isToolsActive =
    currentScreen === 'tools' ||
    currentScreen.startsWith('tool_');

  const isCodeActive =
    currentScreen === 'code' ||
    (currentScreen === 'axon' && paneViewState === 'workspace-only');

  const isChatActive =
    currentScreen === 'axon' && !isCodeActive;

  const navTabs: Array<{
    id: ScreenId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    isActive: boolean;
  }> = [
    {
      id: 'axon',
      label: 'Chat',
      icon: MessageSquare,
      isActive: isChatActive,
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: Wrench,
      isActive: isToolsActive,
    },
    {
      id: 'code',
      label: 'Code',
      icon: Code2,
      isActive: isCodeActive,
    },
    {
      id: 'notes',
      label: 'Library',
      icon: FileText,
      isActive: currentScreen === 'notes',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      isActive: currentScreen === 'settings',
    },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      aria-label="Main navigation"
      className="shrink-0 h-14 bg-neutral-950/95 backdrop-blur-md border-t border-neutral-800/90 px-2 flex items-center justify-around select-none z-30 relative"
    >
      {navTabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.isActive;

        return (
          <button
            key={tab.id}
            id={`bottom-nav-${tab.id}`}
            type="button"
            onClick={() => navigateTo(tab.id)}
            aria-label={`Navigate to ${tab.label}`}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150 active:scale-95 group ${
              active
                ? 'text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div
              className={`p-1 rounded-xl flex items-center justify-center transition-all ${
                active
                  ? 'bg-white text-black shadow-sm'
                  : 'group-hover:bg-neutral-900 text-neutral-400 group-hover:text-neutral-200'
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight font-medium ${
                active ? 'font-bold text-white' : 'text-neutral-400'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
