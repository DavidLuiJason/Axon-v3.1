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

  // Subsystem ON/OFF state flags and suspension registries
  private viewerAnimationEnabled = true;
  private backgroundAnimationEnabled = true;
  private viewerSuspendedIds = new Set<string>();
  private bgSuspendedIds = new Set<string>();

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
   * Determine whether any animations are currently running and permitted to tick.
   */
  private hasActiveRunningWork(): boolean {
    for (const anim of this.animations.values()) {
      if (anim.status === 'running') {
        if (anim.priority === AnimationPriority.INTERACTIVE_VIEWER && !this.viewerAnimationEnabled) {
          continue;
        }
        if (anim.priority === AnimationPriority.BACKGROUND && !this.backgroundAnimationEnabled) {
          continue;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Check if Viewer Animation system is enabled.
   */
  isViewerAnimationEnabled(): boolean {
    return this.viewerAnimationEnabled;
  }

  /**
   * Check if Background Animation system is enabled.
   */
  isBackgroundAnimationEnabled(): boolean {
    return this.backgroundAnimationEnabled;
  }

  /**
   * Control the Viewer Animation system workload and lifecycle.
   * When OFF, viewer animation work stops/suspends cleanly and releases unnecessary animation resources (stopping RAF).
   * When ON, viewer animations safely resume without creating duplicate loops.
   */
  setViewerAnimationEnabled(enabled: boolean): void {
    if (this.viewerAnimationEnabled === enabled) return;
    this.viewerAnimationEnabled = enabled;

    if (!enabled) {
      // Suspend all active running viewer animations
      for (const [id, anim] of this.animations) {
        if (anim.priority === AnimationPriority.INTERACTIVE_VIEWER && anim.status === 'running') {
          this.viewerSuspendedIds.add(id);
          anim.pause();
        }
      }
      // If no running animations remain across any priority, sleep the RAF heartbeat immediately
      if (!this.hasActiveRunningWork() && this.isRafActive) {
        this.stopHeartbeat();
      }
    } else {
      // Safely resume previously suspended viewer animations
      for (const id of this.viewerSuspendedIds) {
        const anim = this.animations.get(id);
        if (anim && anim.status === 'paused') {
          anim.resume();
        }
      }
      this.viewerSuspendedIds.clear();

      // Start heartbeat if active running work exists (guaranteed non-duplicate by startHeartbeat())
      if (this.hasActiveRunningWork() && !this.isRafActive) {
        this.startHeartbeat();
      }
    }

    this.notifyDiagnostics();
  }

  /**
   * Control the Background Animation system workload and lifecycle.
   * When OFF, background animation work stops/suspends cleanly and releases unnecessary animation resources (stopping RAF).
   * When ON, background animations safely resume without creating duplicate loops.
   */
  setBackgroundAnimationEnabled(enabled: boolean): void {
    if (this.backgroundAnimationEnabled === enabled) return;
    this.backgroundAnimationEnabled = enabled;

    if (!enabled) {
      // Suspend all active running background animations
      for (const [id, anim] of this.animations) {
        if (anim.priority === AnimationPriority.BACKGROUND && anim.status === 'running') {
          this.bgSuspendedIds.add(id);
          anim.pause();
        }
      }
      // If no running animations remain across any priority, sleep the RAF heartbeat immediately
      if (!this.hasActiveRunningWork() && this.isRafActive) {
        this.stopHeartbeat();
      }
    } else {
      // Safely resume previously suspended background animations
      for (const id of this.bgSuspendedIds) {
        const anim = this.animations.get(id);
        if (anim && anim.status === 'paused') {
          anim.resume();
        }
      }
      this.bgSuspendedIds.clear();

      // Start heartbeat if active running work exists
      if (this.hasActiveRunningWork() && !this.isRafActive) {
        this.startHeartbeat();
      }
    }

    this.notifyDiagnostics();
  }

  /**
   * Register a new animation into the central coordinator.
   * If the subsystem for this priority is currently disabled, suspends it immediately.
   * If the RAF loop is currently dormant and active work exists, wakes it up.
   */
  register(anim: RegisteredAnimation): void {
    if (this.isDestroyed) {
      console.warn('[AnimationCoordinator] Cannot register animation on destroyed coordinator');
      return;
    }

    // If corresponding animation subsystem is currently OFF, suspend it on registration
    if (anim.priority === AnimationPriority.INTERACTIVE_VIEWER && !this.viewerAnimationEnabled) {
      anim.pause();
      this.viewerSuspendedIds.add(anim.id);
    } else if (anim.priority === AnimationPriority.BACKGROUND && !this.backgroundAnimationEnabled) {
      anim.pause();
      this.bgSuspendedIds.add(anim.id);
    }

    this.animations.set(anim.id, anim);

    // Wake up RAF loop if dormant and active running work exists
    if (!this.isRafActive && this.hasActiveRunningWork()) {
      this.startHeartbeat();
    }

    this.notifyDiagnostics();
  }

  /**
   * Unregister an animation.
   * If no active running animations remain, the RAF loop immediately goes to sleep (zero CPU usage).
   */
  unregister(id: string): boolean {
    this.viewerSuspendedIds.delete(id);
    this.bgSuspendedIds.delete(id);
    const removed = this.animations.delete(id);

    if (!this.hasActiveRunningWork() && this.isRafActive) {
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

      // Check system-level toggle switches: if subsystem is disabled, skip frame execution
      if (anim.priority === AnimationPriority.INTERACTIVE_VIEWER && !this.viewerAnimationEnabled) {
        continue;
      }
      if (anim.priority === AnimationPriority.BACKGROUND && !this.backgroundAnimationEnabled) {
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

    // If all animations completed or no active running work remains, put heartbeat to sleep
    if (!this.hasActiveRunningWork()) {
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
        if (anim.priority === AnimationPriority.INTERACTIVE_VIEWER && this.viewerAnimationEnabled) {
          viewerCount++;
        } else if (anim.priority === AnimationPriority.BACKGROUND && this.backgroundAnimationEnabled) {
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
      isViewerAnimationEnabled: this.viewerAnimationEnabled,
      isBackgroundAnimationEnabled: this.backgroundAnimationEnabled,
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
