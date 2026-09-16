/**
 * AXON Time Slicer & Cooperative Scheduler
 * 
 * Protects 60fps UI responsiveness during heavy background computations
 * by yielding execution slices back to the browser event loop.
 */

// Detect scheduler.yield if supported (Chrome/Edge 115+)
interface NativeScheduler {
  yield?: () => Promise<void>;
}

declare const scheduler: NativeScheduler | undefined;

/**
 * Perform a macrotask yield using MessageChannel for minimum latency (sub-millisecond)
 * compared to setTimeout(0) which enforces 4ms clamping.
 */
function createMessageChannelYield(): () => Promise<void> {
  if (typeof MessageChannel !== 'undefined') {
    const channel = new MessageChannel();
    let resolveFn: (() => void) | null = null;

    channel.port1.onmessage = () => {
      if (resolveFn) {
        const fn = resolveFn;
        resolveFn = null;
        fn();
      }
    };

    return () => {
      return new Promise<void>((resolve) => {
        resolveFn = resolve;
        channel.port2.postMessage(null);
      });
    };
  }

  // Fallback for non-MessageChannel environments
  return () => new Promise<void>((resolve) => setTimeout(resolve, 0));
}

const messageChannelYield = createMessageChannelYield();

/**
 * Yield execution to the browser event loop so pending user inputs,
 * scrolling events, layout passes, and paints can run uninterrupted.
 */
export async function yieldToMain(): Promise<void> {
  // Use native scheduler.yield if available
  if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
    try {
      await scheduler.yield();
      return;
    } catch {
      // Fallback on error
    }
  }

  await messageChannelYield();
}

/**
 * Helper class for tight loops to avoid yielding on every single iteration.
 * Yields only when the allotted execution quantum (default 12ms) has elapsed.
 */
export class TimeSlicer {
  private lastYieldTime: number;
  private readonly quantumMs: number;

  constructor(quantumMs: number = 12) {
    this.quantumMs = quantumMs;
    this.lastYieldTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /**
   * Check if the current time quantum has expired
   */
  shouldYield(): boolean {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return now - this.lastYieldTime >= this.quantumMs;
  }

  /**
   * Yield to the event loop and reset quantum timer
   */
  async yield(): Promise<void> {
    await yieldToMain();
    this.lastYieldTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /**
   * Yield only if the quantum has expired
   */
  async yieldIfNeeded(): Promise<boolean> {
    if (this.shouldYield()) {
      await this.yield();
      return true;
    }
    return false;
  }
}
