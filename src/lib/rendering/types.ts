/**
 * AXON Rendering & Animation Foundation — Type Definitions
 * 
 * Reusable type system for viewer animations, background animations,
 * frame-based scheduling, easing, dynamic performance adaptation, and diagnostics.
 */

export enum AnimationPriority {
  /**
   * Top-priority interactive visual work (viewer transforms, pan/zoom, layer transitions).
   * Unthrottled during user interaction to maintain pristine 60fps responsiveness.
   */
  INTERACTIVE_VIEWER = 100,

  /**
   * Lower-priority background / ambient animations (pulses, particles, background canvas).
   * Dynamically throttled during user interaction to preserve frame budget for gestures.
   */
  BACKGROUND = 50,

  /**
   * Non-urgent visual transitions (subtle opacity fades, housekeeping visual decay).
   */
  PASSIVE = 25,
}

export type AnimationState = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface FramePayload {
  /** High-resolution timestamp of current frame (from performance.now()) */
  timestamp: number;
  /** Clamped delta time since last frame in milliseconds */
  deltaTime: number;
  /** Total elapsed time of animation in milliseconds */
  elapsed: number;
  /** Normalized progress fraction (0.0 to 1.0) */
  progress: number;
}

export type EasingFunction = (t: number) => number;

export interface Vector2D {
  x: number;
  y: number;
}

export interface Transform2D {
  x: number;
  y: number;
  scale: number;
  rotation?: number;
  opacity?: number;
}

export interface ViewerAnimationConfig<T = number | Vector2D | Transform2D> {
  /** Optional custom identifier */
  id?: string;
  /** Descriptive name for performance tracking */
  name?: string;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Easing curve function (defaults to easeInOutQuad) */
  easing?: EasingFunction;
  /** Initial starting value */
  from: T;
  /** Target final value */
  to: T;
  /** Frame callback receiving interpolated value and frame metadata */
  onUpdate: (value: T, frame: FramePayload) => void;
  /** Callback fired upon completion */
  onComplete?: (value: T) => void;
  /** Callback fired if animation is cancelled */
  onCancel?: (reason?: string) => void;
}

export interface BackgroundAnimationConfig {
  /** Optional custom identifier */
  id?: string;
  /** Descriptive name for performance tracking */
  name?: string;
  /** Target nominal frame rate (defaults to 60fps, capped by platform) */
  targetFps?: number;
  /** Target frame rate when user is actively interacting (defaults to 20fps) */
  throttledFps?: number;
  /** Automatically pause when document is hidden (defaults to true) */
  pauseWhenHidden?: boolean;
  /** Automatically pause during active user interaction instead of throttling (defaults to false) */
  pauseOnInteraction?: boolean;
  /** Frame callback executed for each active background tick */
  onTick: (frame: FramePayload) => void;
}

export interface AnimationHandle<T = any> {
  id: string;
  name: string;
  priority: AnimationPriority;
  status: AnimationState;
  progress: number;
  /** Pause the animation */
  pause: () => void;
  /** Resume from paused state */
  resume: () => void;
  /** Cancel the animation cleanly */
  cancel: (reason?: string) => void;
  /** Immediately finish and snap to target value */
  complete: () => void;
  /** Observable promise resolving on completion or rejecting on cancellation */
  promise: Promise<T>;
}

export interface RenderingDiagnostics {
  timestamp: number;
  isRafActive: boolean;
  activeViewerAnimations: number;
  activeBackgroundAnimations: number;
  totalActiveAnimations: number;
  currentFps: number;
  frameDrops: number;
  pressureLevel: 'nominal' | 'elevated' | 'throttled';
  isBackgroundThrottled: boolean;
  isUserInteracting: boolean;
  isAppVisible: boolean;
  isViewerAnimationEnabled?: boolean;
  isBackgroundAnimationEnabled?: boolean;
}
