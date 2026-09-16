import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare,
  Wrench,
  Code2,
  Zap,
  Video,
  FileText,
  Settings,
  X,
  ChevronRight,
  ChevronDown,
  Plus,
  HardDrive,
  Check,
  FolderTree,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AxonLogo } from './AxonLogo';
import { ScreenId, formatAppNameCase } from '../types';
import { ProjectSwitcherModal } from './ProjectSwitcherModal';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ isOpen, onClose, inline = false }) => {
  const {
    currentScreen,
    navigateTo,
    icons,
    activeProject,
    projects,
    setActiveProjectId,
    drawerGestureOffset,
    openPanel,
    closePanel,
    isPanelOpen,
  } = useApp();

  const isProjectModalOpen = isPanelOpen('project-switcher');
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [isRenderedVisible, setIsRenderedVisible] = useState(isOpen);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [isStagedOffscreen, setIsStagedOffscreen] = useState(false);

  useEffect(() => {
    if (containerRef.current?.closest('#axon-offscreen-capture-stage, [data-capture-stage="true"]')) {
      setIsStagedOffscreen(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsRenderedVisible(true);
    } else {
      const timer = window.setTimeout(() => {
        setIsRenderedVisible(false);
      }, 250);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  // Real-time gesture drag tracking for drawer (iOS / ChatGPT style)
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const isHorizontalGestureRef = useRef<boolean | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const latestEffectiveXRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (drawerRef.current) {
        const comp = window.getComputedStyle(drawerRef.current);
        if (comp.transform && comp.transform !== 'none') {
          try {
            const matrix = new DOMMatrixReadOnly(comp.transform);
            drawerRef.current.style.transition = 'none';
            drawerRef.current.style.transform = `translate3d(${matrix.m41}px, 0, 0)`;
          } catch {
            drawerRef.current.style.transition = 'none';
          }
        } else {
          drawerRef.current.style.transition = 'none';
        }
      }
      if (overlayRef.current) {
        overlayRef.current.style.transition = 'none';
      }
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchStartTimeRef.current = Date.now();
      isHorizontalGestureRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    if (isHorizontalGestureRef.current === null) {
      if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 8) {
        isHorizontalGestureRef.current = false; // vertical scroll inside drawer
        return;
      }
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
        isHorizontalGestureRef.current = true; // horizontal drawer drag
      }
    }

    if (isHorizontalGestureRef.current) {
      if (e.cancelable) e.preventDefault();
      // Drawer can only be dragged left to close
      const effectiveX = diffX <= 0 ? diffX : diffX * 0.15;
      latestEffectiveXRef.current = effectiveX;

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (drawerRef.current && overlayRef.current) {
            drawerRef.current.style.transform = `translate3d(${latestEffectiveXRef.current}px, 0, 0)`;
            drawerRef.current.style.opacity = '1';
            overlayRef.current.style.opacity = `${Math.max(0, Math.min(1, 1 + latestEffectiveXRef.current / 300))}`;
          }
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (touchStartXRef.current === null) return;
    const currentX = e.changedTouches[0].clientX;
    const diffX = currentX - touchStartXRef.current;
    const dt = Date.now() - touchStartTimeRef.current;
    const velocity = diffX / Math.max(1, dt);

    // Completion threshold: dragged left > 60px or fast swipe
    const shouldClose = diffX < -60 || (velocity < -0.35 && diffX < -25);

    if (shouldClose) {
      if (drawerRef.current && overlayRef.current) {
        drawerRef.current.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
        drawerRef.current.style.transform = 'translate3d(-320px, 0, 0)';
        drawerRef.current.style.opacity = '1';
        overlayRef.current.style.transition = 'opacity 0.24s ease-out';
        overlayRef.current.style.opacity = '0';
      }
      setTimeout(() => {
        onClose();
      }, 210);
    } else {
      // Springs back smoothly to origin
      if (drawerRef.current && overlayRef.current) {
        drawerRef.current.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
        drawerRef.current.style.transform = 'translate3d(0px, 0, 0)';
        drawerRef.current.style.opacity = '1';
        overlayRef.current.style.transition = 'opacity 0.24s ease-out';
        overlayRef.current.style.opacity = '1';
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalGestureRef.current = null;
  };

  const otherNavItems: Array<{
    id: ScreenId;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'tools',
      label: 'Tools Menu',
      description: 'Calculator, color mixer, bible & conversions',
      icon: Wrench,
    },
    {
      id: 'code',
      label: 'Workspace Code',
      description: 'Code editor & live sandbox preview',
      icon: Code2,
    },
    {
      id: 'codebase',
      label: 'AXON Source',
      description: 'Read-only repository file tree & internal source code',
      icon: FolderTree,
    },
    {
      id: 'automation',
      label: 'Automation & Run Code',
      description: 'Conditional triggers & live script layer',
      icon: Zap,
    },
    {
      id: 'notes',
      label: 'Library',
      description: 'Context notes, chat extracts & documents',
      icon: FileText,
    },
    {
      id: 'video_editor',
      label: 'Video Editor',
      description: 'Timeline editor & waveform synthesizer',
      icon: Video,
    },
    {
      id: 'storage',
      label: 'Storage & Manifest',
      description: 'Budget allocation, manifest & space management',
      icon: HardDrive,
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Theme customization, AI accounts & workspace data',
      icon: Settings,
    },
  ];

  const handleSelect = (id: ScreenId) => {
    navigateTo(id);
    onClose();
  };

  const effectiveTranslateX = isOpen
    ? 0
    : -320 + Math.min(320, Math.max(0, drawerGestureOffset || 0));

  const backdropOpacity = isOpen
    ? 1
    : Math.max(0, Math.min(1, (drawerGestureOffset || 0) / 320));

  const isInteractivelyDragging = drawerGestureOffset !== null;
  const isPortalVisible = isOpen || isInteractivelyDragging || isRenderedVisible || effectiveTranslateX > -320;

  if (typeof document === 'undefined') return null;

  const drawerContent = (
    <div
      ref={drawerRef}
      id="hamburger-drawer"
      onTouchStart={(e) => {
        e.stopPropagation();
        handleTouchStart(e);
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStartXRef.current = null;
        if (drawerRef.current && overlayRef.current) {
          drawerRef.current.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
          drawerRef.current.style.transform = 'translate3d(0px, 0, 0)';
          drawerRef.current.style.opacity = '1';
          overlayRef.current.style.transition = 'opacity 0.24s ease-out';
          overlayRef.current.style.opacity = '1';
        }
      }}
      style={{
        transform: inline || isStagedOffscreen ? 'none' : `translate3d(${effectiveTranslateX}px, 0, 0)`,
        opacity: 1, // ALWAYS 100% dense/opaque - no fade-in effect at any point
        transition: isInteractivelyDragging
          ? 'none'
          : 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        WebkitTransformStyle: 'flat',
        transformStyle: 'flat',
        isolation: 'isolate',
        contain: 'layout paint',
        backgroundColor: '#0a0a0a',
        position: 'relative',
        zIndex: 10,
        pointerEvents: 'auto',
      }}
      className={`w-80 max-w-[85vw] ${inline || isStagedOffscreen ? 'h-[932px]' : 'h-full'} bg-neutral-950 border-r border-neutral-800 flex flex-col shadow-2xl text-white select-none cursor-default`}
      onClick={(e) => e.stopPropagation()}
    >
        {/* Header with App Branding and active App Icon */}
        <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AxonLogo
              size={32}
              preset={icons.appIconType === 'preset' ? icons.appIconPreset : undefined}
              customUrl={icons.appIconType === 'custom' ? icons.appIconCustomUrl : undefined}
            />
            <div>
              <span className="font-bold tracking-wider text-base text-white">
                {formatAppNameCase(icons.appNameTextCase)}
              </span>
              <p className="text-[11px] text-neutral-400">Personal AI Workspace</p>
            </div>
          </div>
          <button
            id="hamburger-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation items container */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-neutral-400">
            Workspace & Navigation
          </div>

          {/* AXON WORKSPACE ITEM (Restructured with downward arrow and in-place expansion) */}
          <div className="rounded-xl overflow-hidden border border-neutral-800/60 bg-neutral-950/40">
            <div
              className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors group ${
                currentScreen === 'axon'
                  ? 'bg-neutral-900 text-white font-medium'
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-white'
              }`}
            >
              {/* Tapping the label itself jumps straight to whichever project/chat was last worked on */}
              <button
                id="hamburger-nav-axon"
                type="button"
                onClick={() => handleSelect('axon')}
                className="flex-1 flex items-center gap-3 min-w-0 text-left active:opacity-80"
              >
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    currentScreen === 'axon'
                      ? 'bg-white text-black'
                      : 'bg-neutral-900 text-neutral-400 group-hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                    <span>AXON Workspace</span>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: activeProject.color || '#ffffff' }}
                      title={`Active: ${activeProject.name}`}
                    />
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {activeProject.name} • Dual-pane AI chat
                  </p>
                </div>
              </button>

              {/* Tapping downward arrow expands projects list in place */}
              <button
                id="hamburger-axon-expand-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsWorkspaceExpanded((prev) => !prev);
                }}
                aria-label={isWorkspaceExpanded ? 'Collapse projects list' : 'Expand projects list'}
                title={isWorkspaceExpanded ? 'Collapse projects' : 'View projects'}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all ml-1 shrink-0"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isWorkspaceExpanded ? 'rotate-180 text-white' : 'text-neutral-400'
                  }`}
                />
              </button>
            </div>

            {/* In-place expanded project list */}
            {isWorkspaceExpanded && (
              <div
                id="hamburger-axon-expanded-projects"
                className="p-2 border-t border-neutral-800 bg-neutral-900/50 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="px-2 py-1 flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-neutral-400">
                  <span>Projects ({projects.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      openPanel('project-switcher');
                    }}
                    className="text-white hover:text-neutral-300 transition-colors flex items-center gap-1 font-medium capitalize text-[11px]"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Project</span>
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-0.5 no-scrollbar">
                  {projects.map((proj) => {
                    const isCurrent = proj.id === activeProject.id;
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => {
                          setActiveProjectId(proj.id);
                          navigateTo('axon');
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all text-left ${
                          isCurrent
                            ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
                            : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: proj.color || '#ffffff' }}
                          />
                          <span className="truncate">{proj.name}</span>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1.5" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-neutral-800/80 flex items-center justify-end px-1">
                  <button
                    type="button"
                    onClick={() => openPanel('project-switcher')}
                    className="text-[11px] text-neutral-400 hover:text-white transition-colors"
                  >
                    Manage All Projects →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Other Navigation Items */}
          {otherNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                id={`hamburger-nav-${item.id}`}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors group ${
                  isActive
                    ? 'bg-neutral-800 text-white font-medium'
                    : 'text-neutral-300 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    isActive ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 group-hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">
                    {item.label}
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">{item.description}</p>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-neutral-600 group-hover:text-neutral-400'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-neutral-800/80 bg-neutral-950 flex items-center justify-between text-xs text-neutral-400">
          <span>AXON v0.1</span>
          <span className="text-[11px]">Swipe left to close</span>
        </div>
      </div>
  );

  if (inline || isStagedOffscreen) {
    return (
      <>
        <span ref={containerRef} style={{ display: 'none' }} />
        {drawerContent}
      </>
    );
  }

  return (
    <>
      <span ref={containerRef} style={{ display: 'none' }} />
      {createPortal(
        <div
          id="hamburger-portal-container"
          data-no-swipe="true"
          className="fixed inset-0 z-50 overflow-hidden select-none isolate"
          style={{
            pointerEvents: isOpen || isInteractivelyDragging ? 'auto' : 'none',
            visibility: isPortalVisible ? 'visible' : 'hidden',
          }}
        >
          {/* Dim backdrop overlay (fades in as drawer opens) */}
          <div
            ref={overlayRef}
            id="hamburger-overlay"
            className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-150 cursor-pointer"
            style={{
              opacity: backdropOpacity,
              pointerEvents: isOpen ? 'auto' : 'none',
            }}
            onClick={onClose}
            onTouchEnd={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                onClose();
              }
            }}
          />

          {drawerContent}

          {/* Project Switcher Modal */}
          <ProjectSwitcherModal
            isOpen={isProjectModalOpen}
            onClose={() => closePanel('project-switcher')}
          />
        </div>,
        document.body
      )}
    </>
  );
};
