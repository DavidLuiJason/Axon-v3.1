/**
 * AXON Central Animation Coordinator & Frame Scheduler
 * 
 * Central coordinator providing:
 * - A single shared requestAnimationFrame heartbeat (sleeps with 0% CPU when idle)
 * - Controlled execution of viewer and background animation workloads
 * - Dynamic frame rate throttling under user interaction pressure (cooperating with ResourceMonitor)
 * - Tab visibility lifecycle management (pausing background visual work when hidden)
 * - Frame delta clamping to prevent tab-switch physics explosions
 * - Telemetry and diagnostic tracking
 */

import { workloadManager } from '../runtime/workloadManager';
import { ResourceMonitor, ResourceState } from '../runtime/resourceMonitor';
import {
  AnimationPriority,
  AnimationState,
  FramePayload,
  RenderingDiagnostics,
} from './types';

export interface RegisteredAnimation {
  id: string;
  name: string;
  priority: AnimationPriority;
  status: AnimationState;
  startTime: number;
  lastTickTime: number;
  targetIntervalMs: number;
  throttledIntervalMs: number;
  pauseWhenHidden: boolean;
  pauseOnInteraction: boolean;
  /** Internal frame step handler */
  tick: (frame: FramePayload) => boolean; // return true if finished
  /** Internal pause/resume hooks */
  pause: () => void;
  resume: () => void;
  cancel: (reason?: string) => void;
  complete: () => void;
}

export type AnimationDiagnosticsListener = (diagnostics: RenderingDiagnostics) => void;

// Cross-environment frame scheduling fallback (native RAF in browser, timer fallback in Node/testing)
const requestFrame: (callback: (timestamp: number) => void) => number =
  typeof window !== 'undefined' && typeof window.requestAnimationFrame !== 'undefined'
    ? window.requestAnimationFrame.bind(window)
    : typeof requestAnimationFrame !== 'undefined'
    ? requestAnimationFrame
    : (cb: (time: number) => void) =>
        setTimeout(() => cb(typeof performance !== 'undefined' ? performance.now() : Date.now()), 16) as unknown as number;

const cancelFrame: (id: number) => void =
  typeof window !== 'undefined' && typeof window.cancelAnimationFrame !== 'undefined'
    ? window.cancelAnimationFrame.bind(window)
    : typeof cancelAnimationFrame !== 'undefined'
    ? cancelAnimationFrame
    : (id: number) => clearTimeout(id as unknown as any);

export class AnimationCoordinator {
  private animations = new Map<string, RegisteredAnimation>();
  private rafId: number | null = null;
  private isRafActive = false;
  private lastFrameTimestamp = 0;
  private frameCount = 0;
  private lastFpsCalculationTime = 0;
  private currentFps = 60;
  private totalFrameDrops = 0;

  private resourceMonitor: ResourceMonitor;
  private unsubscribeResourceMonitor: () => void;
  private resourceState: ResourceState;

  private diagnosticListeners = new Set<AnimationDiagnosticsListener>();
  private isDestroyed = false;

  // Reusable frame payload to eliminate GC allocations during 60fps ticking
  private framePayloadCache: FramePayload = {
    timestamp: 0,
    deltaTime: 0,
    elapsed: 0,
    progress: 0,
  };

  constructor() {
    // Reuse existing ResourceMonitor from AXON Central Workload Manager
    this.resourceMonitor = workloadManager.getResourceMonitor();
    this.resourceState = this.resourceMonitor.getState();

    this.unsubscribeResourceMonitor = this.resourceMonitor.subscribe((state) => {
      this.handleResourceStateChange(state);
    });

    this.lastFpsCalculationTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /**
   * Register a new animation into the central coordinator.
   * If the RAF loop is currently dormant, automatically wakes it up.
   */
  register(anim: RegisteredAnimation): void {
    if (this.isDestroyed) {
      console.warn('[AnimationCoordinator] Cannot register animation on destroyed coordinator');
      return;
    }

    this.animations.set(anim.id, anim);

    // Wake up RAF loop if dormant
    if (!this.isRafActive && this.animations.size > 0) {
      this.startHeartbeat();
    }

    this.notifyDiagnostics();
  }

  /**
   * Unregister an animation.
   * If no animations remain, the RAF loop immediately goes to sleep (zero CPU usage).
   */
  unregister(id: string): boolean {
    const removed = this.animations.delete(id);

    if (this.animations.size === 0 && this.isRafActive) {
      this.stopHeartbeat();
    }

    if (removed) {
      this.notifyDiagnostics();
    }

    return removed;
  }

  /**
   * Start the single shared requestAnimationFrame loop.
   */
  private startHeartbeat(): void {
    if (this.isRafActive) return;

    this.isRafActive = true;
    this.lastFrameTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.rafId = requestFrame(this.onFrame);
  }

  /**
   * Stop the shared requestAnimationFrame loop and sleep.
   */
  private stopHeartbeat(): void {
    if (!this.isRafActive) return;

    if (this.rafId !== null) {
      cancelFrame(this.rafId);
      this.rafId = null;
    }

    this.isRafActive = false;
    this.lastFrameTimestamp = 0;
  }

  /**
   * Main 60fps tick callback executed by requestAnimationFrame.
   */
  private onFrame = (timestamp: number): void => {
    if (!this.isRafActive || this.isDestroyed) return;

    // Calculate clamped delta time (max 100ms to protect against tab suspend jumps)
    let rawDelta = timestamp - (this.lastFrameTimestamp || timestamp);
    if (rawDelta <= 0) rawDelta = 16.67;
    const deltaTime = Math.min(rawDelta, 100);
    this.lastFrameTimestamp = timestamp;

    // Frame drop detection (a frame taking longer than 34ms indicates a dropped 60fps frame)
    if (rawDelta > 34) {
      this.totalFrameDrops++;
    }

    // Update FPS metric once per second
    this.frameCount++;
    if (timestamp - this.lastFpsCalculationTime >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsCalculationTime));
      this.frameCount = 0;
      this.lastFpsCalculationTime = timestamp;
      this.notifyDiagnostics();
    }

    const isAppVisible = this.resourceState.isAppVisible;
    const isUserInteracting = this.resourceState.isUserInteracting;
    const pressureLevel = this.resourceState.pressureLevel;

    // Iterate through active animations
    const finishedIds: string[] = [];

    for (const [id, anim] of this.animations) {
      if (anim.status !== 'running') {
        continue;
      }

      // 1. Application Visibility Check
      if (!isAppVisible && anim.pauseWhenHidden) {
        // App is in background: skip visual tick to conserve battery and CPU
        continue;
      }

      // 2. Interaction & Pressure Throttling
      if (anim.priority === AnimationPriority.BACKGROUND) {
        // If configured to pause during user gesture, pause
        if (isUserInteracting && anim.pauseOnInteraction) {
          continue;
        }

        // Throttle background frame rate when user is interacting or pressure is elevated
        const interval = isUserInteracting || pressureLevel === 'elevated'
          ? anim.throttledIntervalMs
          : anim.targetIntervalMs;

        const timeSinceLastTick = timestamp - anim.lastTickTime;
        if (timeSinceLastTick < interval) {
          // Skip frame: throttle interval has not yet elapsed
          continue;
        }
      }

      // Update last tick time
      anim.lastTickTime = timestamp;

      // 3. Assemble frame payload using cached object
      const elapsed = timestamp - anim.startTime;
      this.framePayloadCache.timestamp = timestamp;
      this.framePayloadCache.deltaTime = deltaTime;
      this.framePayloadCache.elapsed = elapsed;

      try {
        const isDone = anim.tick(this.framePayloadCache);
        if (isDone) {
          finishedIds.push(id);
        }
      } catch (err) {
        console.error(`[AnimationCoordinator] Error ticking animation "${anim.name}" (${id}):`, err);
        finishedIds.push(id);
      }
    }

    // Clean up finished animations
    for (const id of finishedIds) {
      this.animations.delete(id);
    }

    // If all animations completed or cancelled, put heartbeat to sleep
    if (this.animations.size === 0) {
      this.stopHeartbeat();
      this.notifyDiagnostics();
      return;
    }

    // Schedule next frame
    this.rafId = requestFrame(this.onFrame);
  };

  /**
   * Handle shifts in system pressure or user interaction from ResourceMonitor.
   */
  private handleResourceStateChange(state: ResourceState): void {
    this.resourceState = state;

    // If app became hidden, we don't need to spin RAF aggressively if only background animations exist
    if (!state.isAppVisible) {
      // Backgrounded
    } else {
      // App became visible again; reset timestamp so we don't get a huge delta jump
      this.lastFrameTimestamp = performance.now();
    }

    this.notifyDiagnostics();
  }

  /**
   * Retrieve active animation by ID
   */
  get(id: string): RegisteredAnimation | undefined {
    return this.animations.get(id);
  }

  /**
   * Pause all active animations matching an optional priority
   */
  pauseAll(priority?: AnimationPriority): void {
    for (const anim of this.animations.values()) {
      if (priority === undefined || anim.priority === priority) {
        anim.pause();
      }
    }
  }

  /**
   * Resume all paused animations matching an optional priority
   */
  resumeAll(priority?: AnimationPriority): void {
    for (const anim of this.animations.values()) {
      if (priority === undefined || anim.priority === priority) {
        anim.resume();
      }
    }
  }

  /**
   * Cancel all animations cleanly
   */
  cancelAll(reason: string = 'Batch cancellation'): void {
    const all = Array.from(this.animations.values());
    for (const anim of all) {
      anim.cancel(reason);
    }
    this.animations.clear();
    this.stopHeartbeat();
    this.notifyDiagnostics();
  }

  /**
   * Returns current real-time diagnostics
   */
  getDiagnostics(): RenderingDiagnostics {
    let viewerCount = 0;
    let bgCount = 0;

    for (const anim of this.animations.values()) {
      if (anim.status === 'running') {
        if (anim.priority === AnimationPriority.INTERACTIVE_VIEWER) {
          viewerCount++;
        } else {
          bgCount++;
        }
      }
    }

    return {
      timestamp: Date.now(),
      isRafActive: this.isRafActive,
      activeViewerAnimations: viewerCount,
      activeBackgroundAnimations: bgCount,
      totalActiveAnimations: viewerCount + bgCount,
      currentFps: this.currentFps,
      frameDrops: this.totalFrameDrops,
      pressureLevel: this.resourceState.pressureLevel,
      isBackgroundThrottled: this.resourceState.isUserInteracting || this.resourceState.pressureLevel === 'elevated',
      isUserInteracting: this.resourceState.isUserInteracting,
      isAppVisible: this.resourceState.isAppVisible,
    };
  }

  /**
   * Subscribe to diagnostics updates
   */
  subscribe(listener: AnimationDiagnosticsListener): () => void {
    this.diagnosticListeners.add(listener);
    listener(this.getDiagnostics());
    return () => {
      this.diagnosticListeners.delete(listener);
    };
  }

  private notifyDiagnostics(): void {
    if (this.diagnosticListeners.size === 0) return;
    const diag = this.getDiagnostics();
    for (const listener of this.diagnosticListeners) {
      try {
        listener(diag);
      } catch (err) {
        console.error('[AnimationCoordinator] Diagnostic listener error:', err);
      }
    }
  }

  /**
   * Clean up and destroy the coordinator
   */
  destroy(): void {
    this.isDestroyed = true;
    this.cancelAll('Coordinator destroyed');
    this.unsubscribeResourceMonitor();
    this.diagnosticListeners.clear();
  }
}

/**
 * Singleton instance of the AXON Central Animation Coordinator
 */
export const animationCoordinator = new AnimationCoordinator();
