/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ScreenId } from './types';
import { Header } from './components/Header';
import { HamburgerMenu } from './components/HamburgerMenu';
import { DualPaneContainer } from './components/DualPaneContainer';
import { ToolsMenuScreen } from './screens/ToolsMenuScreen';
import { VideoEditorScreen } from './screens/VideoEditorScreen';
import { AxonCodeScreen } from './screens/AxonCodeScreen';
import { CodebaseScreen } from './screens/CodebaseScreen';
import { AutomationScreen } from './screens/AutomationScreen';
import { NotesScreen } from './screens/NotesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AccountScreen } from './screens/AccountScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { TextToolsScreen } from './screens/tools/TextToolsScreen';
import { CalculationToolsScreen } from './screens/tools/CalculationToolsScreen';
import { ColorToolsScreen } from './screens/tools/ColorToolsScreen';
import { ImageToolsScreen } from './screens/tools/ImageToolsScreen';
import { FileConversionToolsScreen } from './screens/tools/FileConversionToolsScreen';
import { StorageDiagnosticsScreen } from './screens/StorageDiagnosticsScreen';
import { SpeechRateAnalysisScreen } from './screens/tools/SpeechRateAnalysisScreen';
import { OfflineBibleScreen } from './screens/tools/OfflineBibleScreen';
import { InterfaceCaptureScreen } from './screens/tools/InterfaceCaptureScreen';
import { InterfaceCaptureOffscreenStage } from './components/InterfaceCaptureOffscreenStage';
import { ConfirmationModal } from './components/ConfirmationModal';
import { StorageOnboardingModal } from './components/storage/StorageOnboardingModal';

const AppContent: React.FC = () => {
  const {
    currentScreen,
    confirmationConfig,
    closeConfirmation,
    toastMessage,
    theme,
    isMenuOpen,
    setIsMenuOpen,
    openMenu,
    hasCompletedStorageOnboarding,
    setHasCompletedStorageOnboarding,
  } = useApp();

  const [visitedScreens, setVisitedScreens] = useState<ScreenId[]>(() =>
    Array.from(new Set<ScreenId>(['axon', currentScreen]))
  );

  useEffect(() => {
    setVisitedScreens((prev) => {
      if (!prev.includes(currentScreen)) {
        return [...prev, currentScreen];
      }
      return prev;
    });
  }, [currentScreen]);

  return (
    <div
      id="axon-app-root"
      className={`fixed inset-0 h-full w-full flex flex-col font-sans transition-colors duration-200 overflow-hidden select-none ${
        theme.mode === 'dark' ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-900'
      }`}
      style={{
        // Set accent color variable for dynamic theme styling
        ['--axon-accent' as any]: theme.accentColor,
      }}
    >
      {/* Mobile-optimized viewport wrapper with max width for desktop / tablet friendliness */}
      <div className="w-full max-w-5xl mx-auto flex-1 min-h-0 flex flex-col h-full overflow-hidden shadow-2xl relative">
        {/* Top Header (Fixed/Pinned at top of shell - never moves, scrolls, or repositions) */}
        <Header onOpenMenu={openMenu} />

        {/* Dynamic Screen Viewport (Contained middle region - flex-1 min-h-0 overflow-hidden) */}
        <main id="app-main-viewport" className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          {/* Keep all visited screens mounted in DOM to preserve scroll positions, inputs, and state */}
          {visitedScreens.map((screenId) => {
            const isVisible = currentScreen === screenId;
            return (
              <div
                key={screenId}
                id={`screen-container-${screenId}`}
                style={{
                  position: isVisible ? 'relative' : 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  visibility: isVisible ? 'visible' : 'hidden',
                  pointerEvents: isVisible ? 'auto' : 'none',
                  zIndex: isVisible ? 10 : -10,
                  opacity: isVisible ? 1 : 0,
                }}
                className="flex-1 min-h-0 flex flex-col overflow-hidden"
                aria-hidden={!isVisible}
              >
                {screenId === 'axon' && <DualPaneContainer />}
                {screenId === 'tools' && <ToolsMenuScreen />}
                {screenId === 'code' && <AxonCodeScreen />}
                {screenId === 'codebase' && <CodebaseScreen />}
                {screenId === 'automation' && <AutomationScreen />}
                {screenId === 'video_editor' && <VideoEditorScreen />}
                {screenId === 'notes' && <NotesScreen />}
                {screenId === 'settings' && <SettingsScreen />}
                {screenId === 'account' && <AccountScreen />}
                {screenId === 'notifications' && <NotificationsScreen />}
                {screenId === 'tool_text' && <TextToolsScreen />}
                {screenId === 'tool_calc' && <CalculationToolsScreen />}
                {screenId === 'tool_units' && <CalculationToolsScreen />}
                {screenId === 'tool_colors' && <ColorToolsScreen />}
                {screenId === 'tool_images' && <ImageToolsScreen />}
                {screenId === 'tool_files' && <FileConversionToolsScreen />}
                {screenId === 'tool_speech_rate' && <SpeechRateAnalysisScreen />}
                {screenId === 'tool_bible' && <OfflineBibleScreen />}
                {screenId === 'storage' && <StorageDiagnosticsScreen />}
                {screenId === 'tool_interface_capture' && <InterfaceCaptureScreen />}
              </div>
            );
          })}
        </main>

        {/* Global Offscreen Staging Container for Background Interface Captures (Never disrupts user UI) */}
        <InterfaceCaptureOffscreenStage />

        {/* Global Slide-out Hamburger Menu */}
        <HamburgerMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
        />

        {/* Storage Onboarding Modal on fresh start / first launch */}
        <StorageOnboardingModal
          isOpen={!hasCompletedStorageOnboarding}
          onClose={() => setHasCompletedStorageOnboarding(true)}
          canDismiss={true}
        />

        {/* Global Confirmation Prompt (Strict Rule: Delete operations always require confirmation prompt) */}
        <ConfirmationModal
          isOpen={confirmationConfig.isOpen}
          title={confirmationConfig.title}
          message={confirmationConfig.message}
          confirmLabel={confirmationConfig.confirmLabel}
          danger={confirmationConfig.danger}
          onConfirm={confirmationConfig.onConfirm}
          onCancel={closeConfirmation}
        />

        {/* Global Toast Pill Notification */}
        {toastMessage && (
          <div
            id="global-toast-notification"
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-neutral-900/95 text-white text-xs font-medium border border-neutral-700/80 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center gap-2 pointer-events-none"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
