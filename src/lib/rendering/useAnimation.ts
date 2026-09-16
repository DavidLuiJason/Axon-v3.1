/**
 * AXON Rendering & Animation Foundation — React Integration Hooks
 * 
 * Provides lifecycle-aware hooks that automatically cancel animations
 * on component unmount and observe real-time rendering performance metrics.
 */

import { useState, useEffect, useRef, useCallback, RefObject } from 'react';
import {
  AnimationHandle,
  BackgroundAnimationConfig,
  RenderingDiagnostics,
  ViewerAnimationConfig,
} from './types';
import { animationCoordinator } from './animationCoordinator';
import { animateViewer } from './viewerAnimation';
import { createBackgroundAnimation, BackgroundAnimationHandle } from './backgroundAnimation';

/**
 * Hook for executing viewer animations with automatic lifecycle cleanup on unmount.
 */
export function useViewerAnimation() {
  const activeHandlesRef = useRef<Set<AnimationHandle<any>>>(new Set());

  // Cleanup on component unmount: cancel all pending/running animations
  useEffect(() => {
    const handles = activeHandlesRef.current;
    return () => {
      for (const h of handles) {
        h.cancel('Component unmounted');
      }
      handles.clear();
    };
  }, []);

  const animate = useCallback(
    <T = any>(config: ViewerAnimationConfig<T>): AnimationHandle<T> => {
      const handle = animateViewer(config);
      activeHandlesRef.current.add(handle);

      handle.promise.finally(() => {
        activeHandlesRef.current.delete(handle);
      });

      return handle;
    },
    []
  );

  const cancelAll = useCallback((reason = 'Cancelled by hook') => {
    for (const h of activeHandlesRef.current) {
      h.cancel(reason);
    }
    activeHandlesRef.current.clear();
  }, []);

  return {
    animate,
    cancelAll,
    activeCount: activeHandlesRef.current.size,
  };
}

/**
 * Hook for mounting a continuous, low-priority background visual process.
 * Automatically handles unmount cleanup and optional IntersectionObserver element tracking.
 */
export function useBackgroundAnimation(
  config: BackgroundAnimationConfig,
  elementRef?: RefObject<HTMLElement | null>,
  enabled: boolean = true
) {
  const handleRef = useRef<BackgroundAnimationHandle | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (handleRef.current) {
        handleRef.current.cancel('Disabled');
        handleRef.current = null;
      }
      return;
    }

    const handle = createBackgroundAnimation(config);
    handleRef.current = handle;

    if (elementRef && elementRef.current) {
      handle.attachElement(elementRef.current);
    }

    return () => {
      handle.cancel('Component unmounted or animation disabled');
      handleRef.current = null;
    };
  }, [enabled]);

  return handleRef;
}

/**
 * Reactive hook for live rendering diagnostics (FPS, active animations, throttle state).
 */
export function useRenderingDiagnostics(): RenderingDiagnostics {
  const [diagnostics, setDiagnostics] = useState<RenderingDiagnostics>(() =>
    animationCoordinator.getDiagnostics()
  );

  useEffect(() => {
    const unsubscribe = animationCoordinator.subscribe((diag) => {
      setDiagnostics(diag);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return diagnostics;
}
