/**
 * AXON Background Animation Foundation
 * 
 * Infrastructure for low-priority ambient and background visual processes:
 * - Treated as lower-priority visual work than active user interaction
 * - Dynamically throttled during user gestures or system pressure
 * - Pauses automatically when tab is hidden or element is scrolled off-screen
 * - Zero CPU consumption when stopped or idle
 * - Cleans up listeners, timers, and coordinator slots cleanly
 */

import {
  AnimationHandle,
  AnimationPriority,
  AnimationState,
  BackgroundAnimationConfig,
  FramePayload,
} from './types';
import { animationCoordinator, RegisteredAnimation } from './animationCoordinator';

let nextBgAnimId = 1;

export interface BackgroundAnimationHandle extends AnimationHandle<void> {
  /** Attach an element to observe offscreen visibility via IntersectionObserver */
  attachElement: (element: HTMLElement) => void;
  /** Detach observer */
  detachElement: () => void;
}

/**
 * Creates and registers a low-priority background visual process.
 */
export function createBackgroundAnimation(
  config: BackgroundAnimationConfig
): BackgroundAnimationHandle {
  const id = config.id || `bg_anim_${Date.now()}_${nextBgAnimId++}`;
  const name = config.name || id;

  const targetFps = config.targetFps || 60;
  const throttledFps = config.throttledFps || 20;

  const targetIntervalMs = 1000 / targetFps;
  const throttledIntervalMs = 1000 / throttledFps;
  const pauseWhenHidden = config.pauseWhenHidden !== false;
  const pauseOnInteraction = config.pauseOnInteraction === true;

  let status: AnimationState = 'running';
  let isElementVisible = true;
  let observer: IntersectionObserver | null = null;
  let startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  let resolvePromise!: () => void;
  let rejectPromise!: (reason: any) => void;

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const detachElement = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  const handle: BackgroundAnimationHandle = {
    id,
    name,
    priority: AnimationPriority.BACKGROUND,
    get status() {
      return status;
    },
    progress: 0,
    pause: () => {
      if (status !== 'running') return;
      status = 'paused';
    },
    resume: () => {
      if (status !== 'paused') return;
      status = 'running';
    },
    cancel: (reason: string = 'Background animation cancelled') => {
      if (status === 'completed' || status === 'cancelled') return;
      status = 'cancelled';
      detachElement();
      animationCoordinator.unregister(id);
      resolvePromise();
    },
    complete: () => {
      if (status === 'completed' || status === 'cancelled') return;
      status = 'completed';
      detachElement();
      animationCoordinator.unregister(id);
      resolvePromise();
    },
    attachElement: (element: HTMLElement) => {
      detachElement();
      if (typeof IntersectionObserver === 'undefined') return;

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            isElementVisible = entry.isIntersecting;
          }
        },
        { threshold: 0.05 }
      );

      observer.observe(element);
    },
    detachElement,
    promise,
  };

  const tick = (frame: FramePayload): boolean => {
    if (status !== 'running') return false;

    // Element-level viewport occlusion check
    if (!isElementVisible) {
      return false; // Skip execution when component is scrolled off-screen
    }

    try {
      config.onTick(frame);
    } catch (err) {
      console.error(`[BackgroundAnimation] Error in onTick for "${name}":`, err);
    }

    return false; // Background animations run indefinitely until stopped
  };

  const registered: RegisteredAnimation = {
    id,
    name,
    priority: AnimationPriority.BACKGROUND,
    get status() {
      return status;
    },
    startTime,
    lastTickTime: startTime,
    targetIntervalMs,
    throttledIntervalMs,
    pauseWhenHidden,
    pauseOnInteraction,
    tick,
    pause: handle.pause,
    resume: handle.resume,
    cancel: handle.cancel,
    complete: handle.complete,
  };

  animationCoordinator.register(registered);

  return handle;
}
