/**
 * AXON Rendering & Animation Foundation — Easing & Interpolation Math
 * 
 * Mathematical primitives designed for zero-allocation per-frame execution.
 * Supports numbers, 2D vectors, and 2D spatial transforms.
 */

import { EasingFunction, Vector2D, Transform2D } from './types';

// ============================================================================
// Easing Curves
// ============================================================================

export const linear: EasingFunction = (t: number): number => t;

export const easeInQuad: EasingFunction = (t: number): number => t * t;

export const easeOutQuad: EasingFunction = (t: number): number => t * (2 - t);

export const easeInOutQuad: EasingFunction = (t: number): number =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export const easeInCubic: EasingFunction = (t: number): number => t * t * t;

export const easeOutCubic: EasingFunction = (t: number): number => {
  const p = t - 1;
  return p * p * p + 1;
};

export const easeInOutCubic: EasingFunction = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

export const easeOutBack: EasingFunction = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
};

export const easeInOutBack: EasingFunction = (t: number): number => {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
};

/**
 * Creates an analytical spring easing curve with specified damping and frequency.
 */
export function createSpringEasing(damping = 12, mass = 1, stiffness = 100): EasingFunction {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;

  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    if (zeta < 1) {
      // Underdamped
      const envelope = Math.exp(-zeta * w0 * t);
      return 1 - envelope * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    // Critically / overdamped fallback
    return 1 - (1 + w0 * t) * Math.exp(-w0 * t);
  };
}

export const spring = createSpringEasing();

export const EASING_PRESETS = {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeOutBack,
  easeInOutBack,
  spring,
} as const;

// ============================================================================
// Allocation-Free Interpolation Helpers
// ============================================================================

export function interpolateNumber(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Interpolates 2D vector coordinates. If `out` is provided, mutates it directly
 * to eliminate GC pressure inside 60fps animation loops.
 */
export function interpolateVector2D(
  from: Vector2D,
  to: Vector2D,
  t: number,
  out?: Vector2D
): Vector2D {
  const target = out || { x: 0, y: 0 };
  target.x = from.x + (to.x - from.x) * t;
  target.y = from.y + (to.y - from.y) * t;
  return target;
}

/**
 * Interpolates 2D transformation matrix properties (x, y, scale, rotation, opacity).
 * Mutates `out` directly if provided for zero-allocation rendering.
 */
export function interpolateTransform(
  from: Transform2D,
  to: Transform2D,
  t: number,
  out?: Transform2D
): Transform2D {
  const target = out || { x: 0, y: 0, scale: 1 };
  target.x = from.x + (to.x - from.x) * t;
  target.y = from.y + (to.y - from.y) * t;
  target.scale = from.scale + (to.scale - from.scale) * t;

  if (from.rotation !== undefined && to.rotation !== undefined) {
    target.rotation = from.rotation + (to.rotation - from.rotation) * t;
  }
  if (from.opacity !== undefined && to.opacity !== undefined) {
    target.opacity = from.opacity + (to.opacity - from.opacity) * t;
  }

  return target;
}

/**
 * Generic dispatcher handling number, vector, or transform.
 */
export function interpolateValue<T>(from: T, to: T, t: number, outCache?: any): T {
  if (typeof from === 'number' && typeof to === 'number') {
    return interpolateNumber(from, to, t) as unknown as T;
  }

  if (
    typeof from === 'object' &&
    from !== null &&
    typeof to === 'object' &&
    to !== null
  ) {
    if ('scale' in from && 'scale' in to) {
      return interpolateTransform(
        from as unknown as Transform2D,
        to as unknown as Transform2D,
        t,
        outCache
      ) as unknown as T;
    }
    if ('x' in from && 'x' in to) {
      return interpolateVector2D(
        from as unknown as Vector2D,
        to as unknown as Vector2D,
        t,
        outCache
      ) as unknown as T;
    }
  }

  return t >= 1 ? to : from;
}
