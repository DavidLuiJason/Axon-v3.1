import React, { useState } from 'react';
import {
  Menu,
  ArrowLeft,
  PanelLeft,
  PanelRight,
  Bell,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AxonLogo } from './AxonLogo';
import { ProjectSwitcherModal } from './ProjectSwitcherModal';
import { formatAppNameCase } from '../types';

interface HeaderProps {
  onOpenMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMenu }) => {
  const {
    currentScreen,
    goBack,
    navigateTo,
    openPanel,
    closePanel,
    isPanelOpen,
    paneViewState,
    setPaneViewState,
    icons,
    activeProject,
  } = useApp();

  const isProjectModalOpen = isPanelOpen('project-switcher');

  const isMainScreen = currentScreen === 'axon';

  const getScreenTitle = () => {
    switch (currentScreen) {
      case 'axon':
        if (paneViewState === 'workspace-only') {
          return 'Workspace';
        }
        return formatAppNameCase(icons.appNameTextCase);
      case 'tools':
        return 'Tools Menu';
      case 'code':
        return 'Workspace';
      case 'codebase':
        return 'AXON Source';
      case 'automation':
        return 'Automation & Run Code';
      case 'video_editor':
        return 'Video Editor';
      case 'notes':
        return 'Library';
      case 'storage':
        return 'Storage & Manifest';
      case 'settings':
        return 'Settings';
      case 'account':
        return 'Account';
      case 'notifications':
        return 'Notifications';
      case 'tool_text':
        return 'Text Tools';
      case 'tool_calc':
        return 'Calculator';
      case 'tool_units':
        return 'Unit Converter';
      case 'tool_colors':
        return 'Color Tools';
      case 'tool_images':
        return 'Image Tools';
      case 'tool_files':
        return 'File Conversions';
      case 'tool_speech_rate':
        return 'Speech-Rate Analysis';
      case 'tool_bible':
        return 'Offline Bible';
      case 'tool_interface_capture':
        return 'Interface Capture';
      default:
        return 'AXON';
    }
  };

  return (
    <header
      id="app-header"
      className="shrink-0 z-40 h-14 w-full bg-black/90 backdrop-blur-md border-b border-neutral-800/80 px-3 flex items-center justify-between select-none"
    >
      {/* Left side: Hamburger on main screen OR Back button on all other screens */}
      <div className="flex items-center gap-1.5">
        {isMainScreen ? (
          <button
            id="hamburger-trigger-btn"
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
        ) : (
          <button
            id="header-back-button"
            data-testid="global-back-btn"
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}

        {/* Title & Active Project Switcher */}
        <div className="flex items-center gap-2">
          {isMainScreen && (
            <AxonLogo
              size={24}
              preset={icons.appIconType === 'preset' ? icons.appIconPreset : undefined}
              customUrl={icons.appIconType === 'custom' ? icons.appIconCustomUrl : undefined}
              glow={false}
            />
          )}
          <h1
            id="header-screen-title"
            className="text-base font-semibold text-white tracking-wide leading-none"
          >
            {getScreenTitle()}
          </h1>

          {/* Active Project Pill */}
          <button
            id="header-project-selector-btn"
            type="button"
            onClick={() => openPanel('project-switcher')}
            title={`Active Project: ${activeProject.name} (Click to switch or manage projects)`}
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white hover:border-neutral-700 active:scale-95 transition-all max-w-[150px]"
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: activeProject.color || '#ffffff' }}
            />
            <span className="truncate font-medium">{activeProject.name}</span>
            <ChevronDown className="w-3 h-3 text-neutral-500 shrink-0" />
          </button>
        </div>
      </div>

      {/* Right side: View state switcher if on main screen, or notification button */}
      <div className="flex items-center gap-1.5">
        {/* Mobile-only Project button */}
        <button
          id="header-mobile-project-btn"
          type="button"
          onClick={() => openPanel('project-switcher')}
          title={`Project: ${activeProject.name}`}
          className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white active:scale-95 transition-all max-w-[100px]"
        >
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: activeProject.color || '#ffffff' }}
          />
          <span className="truncate font-medium">{activeProject.name}</span>
        </button>

        {isMainScreen && (
          <div
            id="pane-view-toggle-group"
            className="flex items-center bg-neutral-900/90 p-1 rounded-xl border border-neutral-800"
          >
            {/* Full Left (Chat Only) */}
            <button
              id="pane-view-chat-btn"
              type="button"
              onClick={() => setPaneViewState('chat-only')}
              title="Full Left: Chat Only"
              className={`p-1.5 rounded-lg transition-all ${
                paneViewState === 'chat-only'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>

            {/* Full Right (Workspace Only) */}
            <button
              id="pane-view-workspace-btn"
              type="button"
              onClick={() => setPaneViewState('workspace-only')}
              title="Workspace View"
              className={`p-1.5 rounded-lg transition-all ${
                paneViewState === 'workspace-only'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Notifications Icon Button */}
        <button
          id="header-notifications-btn"
          type="button"
          onClick={() => navigateTo('notifications')}
          aria-label="View notifications"
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all"
        >
          <Bell className="w-4 h-4" />
        </button>
      </div>

      {/* Project Switcher Modal */}
      <ProjectSwitcherModal
        isOpen={isProjectModalOpen}
        onClose={() => closePanel('project-switcher')}
      />
    </header>
  );
};
