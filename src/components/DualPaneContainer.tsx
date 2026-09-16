import React, { useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { ChatPane } from './ChatPane';
import { WorkspacePane } from './WorkspacePane';

interface TouchSample {
  x: number;
  time: number;
}

export const DualPaneContainer: React.FC = () => {
  const {
    paneViewState,
    setPaneViewState,
    openMenu,
    setDrawerGestureOffset,
  } = useApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  // Stable refs for event handlers to prevent teardown / re-binding during gestures
  const paneViewStateRef = useRef(paneViewState);
  paneViewStateRef.current = paneViewState;

  const openMenuRef = useRef(openMenu);
  openMenuRef.current = openMenu;

  const setPaneViewStateRef = useRef(setPaneViewState);
  setPaneViewStateRef.current = setPaneViewState;

  const setDrawerGestureOffsetRef = useRef(setDrawerGestureOffset);
  setDrawerGestureOffsetRef.current = setDrawerGestureOffset;

  // Gesture tracking
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const samplesRef = useRef<TouchSample[]>([]);
  const gestureLockRef = useRef<'horizontal' | 'vertical' | null>(null);
  const isMouseActiveRef = useRef<boolean>(false);
  const isGesturingRef = useRef<boolean>(false);
  const isAnimatingRef = useRef<boolean>(false);
  const animationTimerRef = useRef<number | null>(null);
  const startOffsetPxRef = useRef<number>(0);

  // High-performance compositor state (prevents layout recalculation & micro-stutters)
  const containerWidthRef = useRef<number>(window.innerWidth || 400);
  const latestDiffXRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  const updateSwipeCompositor = (diffX: number) => {
    const containerWidth = containerWidthRef.current || 400;
    const currentPx = startOffsetPxRef.current + diffX;

    if (startOffsetPxRef.current >= -10 && diffX > 0) {
      // Swiping right from Chat: reveal navigation drawer
      if (trackRef.current) {
        trackRef.current.style.transform = 'translate3d(0px, 0, 0)';
      }
      const portal = document.getElementById('hamburger-portal-container');
      const drawer = document.getElementById('hamburger-drawer');
      const overlay = document.getElementById('hamburger-overlay');
      if (portal && portal.style.visibility !== 'visible') {
        portal.style.visibility = 'visible';
        portal.style.pointerEvents = 'auto';
      }
      const clamped = Math.min(320, Math.max(0, diffX));
      if (drawer) {
        drawer.style.transform = `translate3d(${-320 + clamped}px, 0, 0)`;
        drawer.style.opacity = '1';
      }
      if (overlay) {
        overlay.style.opacity = `${clamped / 320}`;
      }
    } else {
      // Moving between Chat (0px) and Workspace (-containerWidth px)
      let targetPx = currentPx;
      if (targetPx > 0) {
        targetPx = targetPx * 0.18; // Rubberband past chat to the right
      } else if (targetPx < -containerWidth) {
        targetPx = -containerWidth + (targetPx + containerWidth) * 0.18; // Rubberband past workspace to the left
      }
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${targetPx}px, 0, 0)`;
      }
    }
  };

  // Sync track position with state when not actively gesturing or completing an animation
  useEffect(() => {
    if (trackRef.current && !isGesturingRef.current && !isAnimatingRef.current) {
      const targetTransform =
        paneViewState === 'chat-only' ? 'translate3d(0%, 0, 0)' : 'translate3d(-50%, 0, 0)';
      if (trackRef.current.style.transform !== targetTransform) {
        trackRef.current.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
        trackRef.current.style.transform = targetTransform;
      }
    }
  }, [paneViewState]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const isIgnoredTarget = useCallback((target: HTMLElement | null): boolean => {
    if (!target) return false;

    // Return to chat gesture works from anywhere on workspace screen
    if (
      paneViewStateRef.current === 'workspace-only' ||
      Boolean(target.closest('#dual-pane-right, #workspace-pane'))
    ) {
      return false;
    }

    return Boolean(
      target.closest(
        'input, textarea, select, button, [contenteditable="true"], .no-swipe-gesture, #chat-input-bar, #chat-bottom-dock, #chat-bottom-shortcut-bar, #edit-shortcuts-modal, [data-no-swipe]'
      )
    );
  }, []);

  const finishGesture = useCallback((diffX: number) => {
    // Compute release flick velocity from recent samples (last ~120ms)
    const samples = samplesRef.current;
    let velocity = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last.time - first.time;
      if (dt > 10) {
        velocity = (last.x - first.x) / dt;
      }
    }

    const containerWidth = containerWidthRef.current || containerRef.current?.clientWidth || window.innerWidth || 400;

    if (gestureLockRef.current === 'horizontal') {
      if (startOffsetPxRef.current >= -10 && diffX > 0) {
        // Finishing drawer swipe open / cancel gesture
        const shouldOpenDrawer = diffX > 60 || (velocity > 0.28 && diffX > 20);
        const portal = document.getElementById('hamburger-portal-container');
        const drawer = document.getElementById('hamburger-drawer');
        const overlay = document.getElementById('hamburger-overlay');
        if (drawer && overlay) {
          drawer.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
          drawer.style.opacity = '1';
          overlay.style.transition = 'opacity 0.24s ease-out';
          if (shouldOpenDrawer) {
            drawer.style.transform = 'translate3d(0px, 0, 0)';
            overlay.style.opacity = '1';
            openMenuRef.current();
          } else {
            drawer.style.transform = 'translate3d(-320px, 0, 0)';
            overlay.style.opacity = '0';
            setTimeout(() => {
              if (portal) {
                portal.style.visibility = 'hidden';
                portal.style.pointerEvents = 'none';
              }
            }, 240);
          }
        } else if (shouldOpenDrawer) {
          openMenuRef.current();
        }
      } else {
        // Dual-pane track swipe between Chat (0px) and Workspace (-containerWidth px)
        const finalPx = startOffsetPxRef.current + diffX;
        const flickToWorkspace = velocity < -0.28;
        const flickToChat = velocity > 0.28;
        const isCloserToWorkspace = finalPx < -containerWidth * 0.38;

        let shouldGoToWorkspace: boolean;
        if (flickToWorkspace) {
          shouldGoToWorkspace = true;
        } else if (flickToChat) {
          shouldGoToWorkspace = false;
        } else {
          shouldGoToWorkspace = isCloserToWorkspace;
        }

        if (trackRef.current) {
          isAnimatingRef.current = true;
          trackRef.current.style.transition = 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)';
          trackRef.current.style.transform = shouldGoToWorkspace
            ? 'translate3d(-50%, 0, 0)'
            : 'translate3d(0%, 0, 0)';

          const onEnd = () => {
            if (animationTimerRef.current !== null) {
              window.clearTimeout(animationTimerRef.current);
              animationTimerRef.current = null;
            }
            isAnimatingRef.current = false;
            setPaneViewStateRef.current(shouldGoToWorkspace ? 'workspace-only' : 'chat-only');
          };

          trackRef.current.addEventListener('transitionend', onEnd, { once: true });
          if (animationTimerRef.current !== null) {
            window.clearTimeout(animationTimerRef.current);
          }
          animationTimerRef.current = window.setTimeout(onEnd, 280);
        } else {
          setPaneViewStateRef.current(shouldGoToWorkspace ? 'workspace-only' : 'chat-only');
        }
      }
    } else {
      if (trackRef.current) {
        trackRef.current.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
        trackRef.current.style.transform =
          paneViewStateRef.current === 'chat-only' ? 'translate3d(0%, 0, 0)' : 'translate3d(-50%, 0, 0)';
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    gestureLockRef.current = null;
    isGesturingRef.current = false;
  }, []);

  // NATIVE TOUCH LISTENERS: Attached with passive: false for touchmove to eliminate browser scroll delay
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (isIgnoredTarget(target)) return;

      const containerWidth = containerRef.current?.clientWidth || window.innerWidth || 400;
      containerWidthRef.current = containerWidth;

      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      isAnimatingRef.current = false;

      // In-flight gesture catch: freeze track at exact current interpolated position
      let currentX = paneViewStateRef.current === 'chat-only' ? 0 : -containerWidth;
      if (trackRef.current) {
        const compStyle = window.getComputedStyle(trackRef.current);
        if (compStyle.transform && compStyle.transform !== 'none') {
          try {
            const matrix = new DOMMatrixReadOnly(compStyle.transform);
            if (typeof matrix.m41 === 'number' && !isNaN(matrix.m41)) {
              currentX = matrix.m41;
            }
          } catch {
            // fallback
          }
        }
        trackRef.current.style.transition = 'none';
        trackRef.current.style.transform = `translate3d(${currentX}px, 0, 0)`;
      }
      startOffsetPxRef.current = currentX;

      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      touchStartXRef.current = clientX;
      touchStartYRef.current = clientY;
      samplesRef.current = [{ x: clientX, time: Date.now() }];
      gestureLockRef.current = null;
      isGesturingRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartXRef.current === null || touchStartYRef.current === null || e.touches.length !== 1) {
        return;
      }

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - touchStartXRef.current;
      const diffY = currentY - touchStartYRef.current;
      const now = Date.now();

      samplesRef.current.push({ x: currentX, time: now });
      const cutoff = now - 120;
      while (samplesRef.current.length > 2 && samplesRef.current[0].time < cutoff) {
        samplesRef.current.shift();
      }

      // Fast, decisive direction lock
      if (gestureLockRef.current === null) {
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);
        if (absY > absX && absY > 7) {
          gestureLockRef.current = 'vertical';
          return;
        }
        if (absX > absY && absX > 7) {
          gestureLockRef.current = 'horizontal';
          isGesturingRef.current = true;
          document.body.style.userSelect = 'none';
          document.body.style.webkitUserSelect = 'none';
        }
      }

      if (gestureLockRef.current === 'horizontal') {
        if (e.cancelable) {
          e.preventDefault();
        }

        latestDiffXRef.current = diffX;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            updateSwipeCompositor(latestDiffXRef.current);
          });
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (touchStartXRef.current === null) {
        isGesturingRef.current = false;
        return;
      }

      if (gestureLockRef.current === 'horizontal' && e.changedTouches.length > 0) {
        const currentX = e.changedTouches[0].clientX;
        const diffX = currentX - touchStartXRef.current;
        finishGesture(diffX);
      } else {
        isGesturingRef.current = false;
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        gestureLockRef.current = null;
        if (trackRef.current) {
          trackRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          trackRef.current.style.transform =
            paneViewStateRef.current === 'chat-only' ? 'translate3d(0%, 0, 0)' : 'translate3d(-50%, 0, 0)';
        }
      }
    };

    const onTouchCancel = () => {
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      isGesturingRef.current = false;
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      gestureLockRef.current = null;
      if (trackRef.current) {
        trackRef.current.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
        trackRef.current.style.transform =
          paneViewStateRef.current === 'chat-only' ? 'translate3d(0%, 0, 0)' : 'translate3d(-50%, 0, 0)';
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [finishGesture, isIgnoredTarget]);

  // Desktop Mouse fallbacks for mouse dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (isIgnoredTarget(e.target as HTMLElement | null)) return;

    const containerWidth = containerRef.current?.clientWidth || window.innerWidth || 400;
    containerWidthRef.current = containerWidth;

    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isAnimatingRef.current = false;

    let currentX = paneViewStateRef.current === 'chat-only' ? 0 : -containerWidth;
    if (trackRef.current) {
      const compStyle = window.getComputedStyle(trackRef.current);
      if (compStyle.transform && compStyle.transform !== 'none') {
        try {
          const matrix = new DOMMatrixReadOnly(compStyle.transform);
          if (typeof matrix.m41 === 'number' && !isNaN(matrix.m41)) {
            currentX = matrix.m41;
          }
        } catch {
          // fallback
        }
      }
      trackRef.current.style.transition = 'none';
      trackRef.current.style.transform = `translate3d(${currentX}px, 0, 0)`;
    }
    startOffsetPxRef.current = currentX;

    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
    samplesRef.current = [{ x: e.clientX, time: Date.now() }];
    gestureLockRef.current = null;
    isMouseActiveRef.current = true;
    isGesturingRef.current = false;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseActiveRef.current || touchStartXRef.current === null || touchStartYRef.current === null) {
        return;
      }

      const diffX = e.clientX - touchStartXRef.current;
      const diffY = e.clientY - touchStartYRef.current;
      const now = Date.now();

      samplesRef.current.push({ x: e.clientX, time: now });
      const cutoff = now - 120;
      while (samplesRef.current.length > 2 && samplesRef.current[0].time < cutoff) {
        samplesRef.current.shift();
      }

      if (gestureLockRef.current === null) {
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);
        if (absY > absX && absY > 7) {
          gestureLockRef.current = 'vertical';
          return;
        }
        if (absX > absY && absX > 7) {
          gestureLockRef.current = 'horizontal';
          isGesturingRef.current = true;
          document.body.style.userSelect = 'none';
        }
      }

      if (gestureLockRef.current === 'horizontal') {
        latestDiffXRef.current = diffX;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            updateSwipeCompositor(latestDiffXRef.current);
          });
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      document.body.style.userSelect = '';
      if (!isMouseActiveRef.current) return;
      isMouseActiveRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      if (touchStartXRef.current !== null && gestureLockRef.current === 'horizontal') {
        const diffX = e.clientX - touchStartXRef.current;
        finishGesture(diffX);
      } else {
        isGesturingRef.current = false;
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        gestureLockRef.current = null;
        if (trackRef.current) {
          trackRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          trackRef.current.style.transform =
            paneViewStateRef.current === 'chat-only' ? 'translate3d(0%, 0, 0)' : 'translate3d(-50%, 0, 0)';
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [finishGesture]);

  const initialTransform =
    paneViewState === 'chat-only'
      ? 'translate3d(0%, 0, 0)'
      : 'translate3d(-50%, 0, 0)';

  return (
    <div
      ref={containerRef}
      id="dual-pane-container"
      onMouseDown={handleMouseDown}
      className="relative flex-1 min-h-0 w-full overflow-hidden bg-black isolate"
      style={{ touchAction: 'pan-y' }}
    >
      {/* 2-Screen Hardware-Accelerated Swipeable Slider Track (200% width, 100% per screen) */}
      <div
        ref={trackRef}
        id="dual-pane-track"
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '200%',
          height: '100%',
          flexShrink: 0,
          transform: initialTransform,
          willChange: 'transform',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          WebkitTransformStyle: 'flat',
          transformStyle: 'flat',
          isolation: 'isolate',
          backgroundColor: '#000000',
        }}
        className="h-full min-h-0 overflow-hidden"
      >
        {/* Left Screen: Chat (Full Screen with GPU layer isolation) */}
        <div
          ref={leftPaneRef}
          id="dual-pane-left"
          style={{
            width: '50%',
            flexShrink: 0,
            position: 'relative',
            isolation: 'isolate',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
            contain: 'layout paint',
            backgroundColor: '#000000',
          }}
          className="h-full min-h-0 overflow-hidden flex flex-col shrink-0"
        >
          <ChatPane />
        </div>

        {/* Right Screen: Workspace / Code (Full Screen with GPU layer isolation) */}
        <div
          ref={rightPaneRef}
          id="dual-pane-right"
          style={{
            width: '50%',
            flexShrink: 0,
            position: 'relative',
            isolation: 'isolate',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
            contain: 'layout paint',
            backgroundColor: '#000000',
          }}
          className="h-full min-h-0 overflow-hidden flex flex-col shrink-0"
        >
          <WorkspacePane />
        </div>
      </div>
    </div>
  );
};
