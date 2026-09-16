/**
 * AXON Resource & Lifecycle Monitor
 * 
 * Dynamically tracks platform-supported environmental metrics and application
 * lifecycle states (visibility, user interaction pressure, hardware concurrency)
 * without fabricating unsupported hardware readings.
 */

export interface ResourceState {
  baseConcurrency: number;
  currentConcurrencyLimit: number;
  isUserInteracting: boolean;
  isAppVisible: boolean;
  pressureLevel: 'nominal' | 'elevated' | 'throttled';
}

export type ResourceStateListener = (state: ResourceState) => void;

export class ResourceMonitor {
  private baseConcurrency: number;
  private isUserInteracting = false;
  private isAppVisible = true;
  private interactionTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<ResourceStateListener>();
  private boundListeners: Array<{ target: EventTarget; event: string; handler: EventListenerOrEventListenerObject }> = [];
  private isDestroyed = false;

  constructor() {
    this.baseConcurrency = this.calculateBaseConcurrency();
    this.isAppVisible = typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true;
    this.initEventListeners();
  }

  /**
   * Determine safe baseline concurrency using strictly platform-supported properties.
   * Never fakes or guesses metrics.
   */
  private calculateBaseConcurrency(): number {
    if (typeof navigator === 'undefined') return 2;

    let concurrency = 2;

    // Use navigator.hardwareConcurrency if officially supported by host browser
    if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0) {
      const cores = navigator.hardwareConcurrency;
      if (cores >= 8) {
        concurrency = 4;
      } else if (cores >= 4) {
        concurrency = 3;
      } else if (cores >= 2) {
        concurrency = 2;
      } else {
        concurrency = 1;
      }
    }

    // Use navigator.deviceMemory if available (Chrome / Edge)
    const navAny = navigator as any;
    if (typeof navAny.deviceMemory === 'number' && navAny.deviceMemory > 0) {
      if (navAny.deviceMemory <= 2) {
        concurrency = Math.min(concurrency, 2);
      }
    }

    return Math.max(1, concurrency);
  }

  private initEventListeners(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // 1. Application Visibility Lifecycle
    const handleVisibilityChange = () => {
      if (this.isDestroyed) return;
      const visible = document.visibilityState !== 'hidden';
      if (this.isAppVisible !== visible) {
        this.isAppVisible = visible;
        this.notifyChange();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.boundListeners.push({ target: document, event: 'visibilitychange', handler: handleVisibilityChange });

    // 2. User Interaction Tracking (touch, scroll, key, click)
    const handleUserInteraction = () => {
      if (this.isDestroyed) return;

      const wasInteracting = this.isUserInteracting;
      this.isUserInteracting = true;

      if (this.interactionTimeout) {
        clearTimeout(this.interactionTimeout);
      }

      // Keep userInteracting active for 1400ms after last gesture
      this.interactionTimeout = setTimeout(() => {
        if (this.isDestroyed) return;
        this.isUserInteracting = false;
        this.interactionTimeout = null;
        this.notifyChange();
      }, 1400);

      if (!wasInteracting) {
        this.notifyChange();
      }
    };

    const interactionEvents = ['pointerdown', 'touchstart', 'touchmove', 'wheel', 'keydown'];
    interactionEvents.forEach((evt) => {
      const listenerOptions: AddEventListenerOptions = { passive: true, capture: true };
      window.addEventListener(evt, handleUserInteraction, listenerOptions);
      this.boundListeners.push({
        target: window,
        event: evt,
        handler: handleUserInteraction,
      });
    });

    // 3. Page Hide / Unload Lifecycle
    const handlePageHide = () => {
      if (this.isDestroyed) return;
      this.isAppVisible = false;
      this.notifyChange();
    };

    window.addEventListener('pagehide', handlePageHide);
    this.boundListeners.push({ target: window, event: 'pagehide', handler: handlePageHide });
  }

  /**
   * Dynamically calculate current concurrency limit based on active conditions:
   * - If app is backgrounded (hidden): throttle to 1 worker to preserve device resources.
   * - If user is actively interacting (touch/scroll/input): scale down to 1 worker so
   *   the UI thread has full budget for frame animations.
   * - Otherwise: run at nominal base concurrency.
   */
  getCurrentConcurrencyLimit(): number {
    if (!this.isAppVisible) {
      return 1; // Throttled in background
    }

    if (this.isUserInteracting) {
      return 1; // Reduced during active user touch/scroll/key interaction
    }

    return this.baseConcurrency;
  }

  getPressureLevel(): 'nominal' | 'elevated' | 'throttled' {
    if (!this.isAppVisible) return 'throttled';
    if (this.isUserInteracting) return 'elevated';
    return 'nominal';
  }

  getState(): ResourceState {
    return {
      baseConcurrency: this.baseConcurrency,
      currentConcurrencyLimit: this.getCurrentConcurrencyLimit(),
      isUserInteracting: this.isUserInteracting,
      isAppVisible: this.isAppVisible,
      pressureLevel: this.getPressureLevel(),
    };
  }

  subscribe(listener: ResourceStateListener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyChange(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[ResourceMonitor] Error in listener callback:', err);
      }
    }
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.interactionTimeout) {
      clearTimeout(this.interactionTimeout);
      this.interactionTimeout = null;
    }
    for (const { target, event, handler } of this.boundListeners) {
      target.removeEventListener(event, handler as any);
    }
    this.boundListeners = [];
    this.listeners.clear();
  }
}
