/**
 * AXON Viewer Animation Foundation
 * 
 * High-performance, lifecycle-controlled animation system for AXON viewers:
 * - Smooth viewport transitions (pan, zoom, layer fades, timeline scrubber)
 * - Controlled lifecycles (start, pause, resume, cancel, complete)
 * - Zero-allocation per-frame interpolation
 * - Integration with central AnimationCoordinator at INTERACTIVE_VIEWER priority
 */

import {
  AnimationHandle,
  AnimationPriority,
  AnimationState,
  FramePayload,
  ViewerAnimationConfig,
} from './types';
import { animationCoordinator, RegisteredAnimation } from './animationCoordinator';
import { easeInOutQuad, interpolateValue } from './easing';

let nextViewerAnimId = 1;

/**
 * Creates and runs a viewer animation on the central coordinator.
 */
export function animateViewer<T = any>(
  config: ViewerAnimationConfig<T>
): AnimationHandle<T> {
  const id = config.id || `viewer_anim_${Date.now()}_${nextViewerAnimId++}`;
  const name = config.name || id;
  const durationMs = Math.max(1, config.durationMs);
  const easing = config.easing || easeInOutQuad;

  let status: AnimationState = 'running';
  let progress = 0;
  let pauseStartTime = 0;
  let totalPausedDuration = 0;
  let startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  let resolvePromise!: (val: T) => void;
  let rejectPromise!: (reason: any) => void;

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  // Prevent unhandled rejection crashes when callers do not await handle.promise
  promise.catch(() => {});

  // Pre-allocated interpolation cache to eliminate GC allocations inside 60fps loop
  let outCache: any = undefined;
  if (typeof config.from === 'object' && config.from !== null) {
    outCache = Array.isArray(config.from) ? [] : { ...(config.from as any) };
  }

  // Handle assembly
  const handle: AnimationHandle<T> = {
    id,
    name,
    priority: AnimationPriority.INTERACTIVE_VIEWER,
    get status() {
      return status;
    },
    get progress() {
      return progress;
    },
    pause: () => {
      if (status !== 'running') return;
      status = 'paused';
      pauseStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    },
    resume: () => {
      if (status !== 'paused') return;
      status = 'running';
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      totalPausedDuration += now - pauseStartTime;
    },
    cancel: (reason: string = 'Viewer animation cancelled') => {
      if (status === 'completed' || status === 'cancelled') return;
      status = 'cancelled';
      animationCoordinator.unregister(id);
      if (config.onCancel) {
        config.onCancel(reason);
      }
      rejectPromise(new Error(reason));
    },
    complete: () => {
      if (status === 'completed' || status === 'cancelled') return;
      status = 'completed';
      progress = 1;
      animationCoordinator.unregister(id);

      // Snap to final target value
      const finalFrame: FramePayload = {
        timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        deltaTime: 0,
        elapsed: durationMs,
        progress: 1,
      };
      config.onUpdate(config.to, finalFrame);

      if (config.onComplete) {
        config.onComplete(config.to);
      }
      resolvePromise(config.to);
    },
    promise,
  };

  // Internal tick function invoked by AnimationCoordinator
  const tick = (frame: FramePayload): boolean => {
    if (status !== 'running') return false;

    // Effective elapsed time deducting any paused periods
    const effectiveElapsed = frame.timestamp - startTime - totalPausedDuration;
    const rawProgress = Math.min(1, Math.max(0, effectiveElapsed / durationMs));
    const easedProgress = easing(rawProgress);
    progress = rawProgress;

    // Compute interpolated value
    const currentValue = interpolateValue(config.from, config.to, easedProgress, outCache);

    // Frame payload
    frame.progress = rawProgress;
    config.onUpdate(currentValue, frame);

    // Completion check
    if (rawProgress >= 1) {
      status = 'completed';
      if (config.onComplete) {
        config.onComplete(config.to);
      }
      resolvePromise(config.to);
      return true; // Finished, coordinator will remove
    }

    return false;
  };

  const registered: RegisteredAnimation = {
    id,
    name,
    priority: AnimationPriority.INTERACTIVE_VIEWER,
    get status() {
      return status;
    },
    startTime,
    lastTickTime: startTime,
    targetIntervalMs: 0, // Unthrottled 60fps for interactive viewer
    throttledIntervalMs: 0, // Unthrottled during user interaction
    pauseWhenHidden: false, // Keep viewer animations alive unless system demands
    pauseOnInteraction: false, // Viewer animations are part of the interaction
    tick,
    pause: handle.pause,
    resume: handle.resume,
    cancel: handle.cancel,
    complete: handle.complete,
  };

  // Register with coordinator to start RAF loop
  animationCoordinator.register(registered);

  return handle;
}

/**
 * Helper to smoothly transition 2D coordinates (e.g. viewer pan offset).
 */
export function animateViewerPan(
  from: { x: number; y: number },
  to: { x: number; y: number },
  durationMs: number,
  onUpdate: (coords: { x: number; y: number }, frame: FramePayload) => void
): AnimationHandle<{ x: number; y: number }> {
  return animateViewer({
    name: 'viewer_pan',
    durationMs,
    from,
    to,
    onUpdate,
  });
}

/**
 * Helper to smoothly zoom viewer scale.
 */
export function animateViewerZoom(
  fromScale: number,
  toScale: number,
  durationMs: number,
  onUpdate: (scale: number, frame: FramePayload) => void
): AnimationHandle<number> {
  return animateViewer({
    name: 'viewer_zoom',
    durationMs,
    from: fromScale,
    to: toScale,
    onUpdate,
  });
}
