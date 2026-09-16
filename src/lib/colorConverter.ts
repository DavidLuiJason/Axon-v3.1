/**
 * AXON Color Converter & Modern CSS Color Normalizer
 *
 * Converts modern CSS color functions (oklab, oklch, lab, lch, color) into
 * parser-compatible RGB/RGBA representations exclusively within the capture pipeline.
 * Preserves exact color appearance without altering original DOM or stylesheet sources.
 */

// Cache for converted colors to ensure fast O(1) repeated lookups
const colorCache = new Map<string, string>();

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

/**
 * Checks if a string contains modern CSS color functions.
 */
export function containsModernColorFunction(str: string): boolean {
  return /\b(oklab|oklch|lab|lch|color)\s*\(/i.test(str);
}

/**
 * Parses CSS numeric value (handles percentage or float).
 */
function parseCssNumber(val: string, maxPercent = 1): number {
  val = val.trim();
  if (val.endsWith('%')) {
    return (parseFloat(val) / 100) * maxPercent;
  }
  return parseFloat(val) || 0;
}

/**
 * Parses CSS hue angle to degrees.
 */
function parseHueToDegrees(val: string): number {
  val = val.trim().toLowerCase();
  if (val.endsWith('deg')) return parseFloat(val) || 0;
  if (val.endsWith('rad')) return ((parseFloat(val) || 0) * 180) / Math.PI;
  if (val.endsWith('turn')) return (parseFloat(val) || 0) * 360;
  return parseFloat(val) || 0;
}

/**
 * Mathematical conversion of Oklab (L, a, b, alpha) to sRGB string.
 */
export function oklabToRgb(L: number, a: number, b: number, alpha = 1): string {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const gamma = (x: number): number => {
    const c = Math.max(0, Math.min(1, x));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  const R = Math.max(0, Math.min(255, Math.round(gamma(rLin) * 255)));
  const G = Math.max(0, Math.min(255, Math.round(gamma(gLin) * 255)));
  const B = Math.max(0, Math.min(255, Math.round(gamma(bLin) * 255)));

  const cleanAlpha = Math.max(0, Math.min(1, alpha));
  if (cleanAlpha >= 0.999) {
    return `rgb(${R}, ${G}, ${B})`;
  }
  return `rgba(${R}, ${G}, ${B}, ${Number(cleanAlpha.toFixed(3))})`;
}

/**
 * Mathematical conversion of CIE Lab (L, a, b, alpha) to sRGB string.
 */
export function labToRgb(L: number, a: number, b: number, alpha = 1): string {
  const y = (L + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;

  const f = (t: number) => (t > 0.206897 ? t * t * t : (t - 16 / 116) / 7.787);
  const X = 0.95047 * f(x);
  const Y = 1.0 * f(y);
  const Z = 1.08883 * f(z);

  const rLin = +3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const gLin = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const bLin = +0.0557 * X - 0.204 * Y + 1.057 * Z;

  const gamma = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;

  const R = Math.max(0, Math.min(255, Math.round(gamma(rLin) * 255)));
  const G = Math.max(0, Math.min(255, Math.round(gamma(gLin) * 255)));
  const B = Math.max(0, Math.min(255, Math.round(gamma(bLin) * 255)));

  const cleanAlpha = Math.max(0, Math.min(1, alpha));
  if (cleanAlpha >= 0.999) {
    return `rgb(${R}, ${G}, ${B})`;
  }
  return `rgba(${R}, ${G}, ${B}, ${Number(cleanAlpha.toFixed(3))})`;
}

/**
 * Tries resolving the color through browser canvas 2d rasterization.
 */
function convertViaBrowserCanvas(colorStr: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    if (!sharedCanvas) {
      sharedCanvas = document.createElement('canvas');
      sharedCanvas.width = 1;
      sharedCanvas.height = 1;
      sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!sharedCtx) return null;

    sharedCtx.clearRect(0, 0, 1, 1);
    sharedCtx.fillStyle = '#000000';
    sharedCtx.fillStyle = colorStr;

    // If browser rejected the color function, fillStyle remains untouched
    if (sharedCtx.fillStyle === '#000000' && !colorStr.toLowerCase().includes('black') && !colorStr.includes('0 0 0')) {
      return null;
    }

    sharedCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = sharedCtx.getImageData(0, 0, 1, 1).data;
    const alpha = a / 255;
    if (alpha >= 0.999) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;
  } catch {
    return null;
  }
}

/**
 * Parses and converts a single modern CSS color expression to standard rgb/rgba.
 */
export function parseAndConvertModernColor(colorStr: string): string {
  const trimmed = colorStr.trim();
  if (colorCache.has(trimmed)) {
    return colorCache.get(trimmed)!;
  }

  // 1. Try browser canvas rendering first (covers all native browser-supported color functions)
  const canvasResult = convertViaBrowserCanvas(trimmed);
  if (canvasResult) {
    colorCache.set(trimmed, canvasResult);
    return canvasResult;
  }

  // 2. Pure JavaScript mathematical fallback
  const match = trimmed.match(/^(oklab|oklch|lab|lch|color)\s*\((.*)\)$/i);
  if (!match) {
    return trimmed;
  }

  const fn = match[1].toLowerCase();
  const inner = match[2].trim();

  let parts: string[] = [];
  let alpha = 1;

  if (inner.includes('/')) {
    const [cPart, aPart] = inner.split('/');
    parts = cPart.trim().split(/[\s,]+/);
    alpha = parseCssNumber(aPart, 1);
  } else {
    parts = inner.split(/[\s,]+/);
  }

  let converted = trimmed;

  if (fn === 'oklab') {
    const L = parseCssNumber(parts[0] || '0', 1);
    const a = parseCssNumber(parts[1] || '0', 0.4);
    const b = parseCssNumber(parts[2] || '0', 0.4);
    converted = oklabToRgb(L, a, b, alpha);
  } else if (fn === 'oklch') {
    const L = parseCssNumber(parts[0] || '0', 1);
    const C = parseCssNumber(parts[1] || '0', 0.4);
    const H = parseHueToDegrees(parts[2] || '0');
    const rad = (H * Math.PI) / 180;
    const a = C * Math.cos(rad);
    const b = C * Math.sin(rad);
    converted = oklabToRgb(L, a, b, alpha);
  } else if (fn === 'lab') {
    const L = parseCssNumber(parts[0] || '0', 100);
    const a = parseCssNumber(parts[1] || '0', 125);
    const b = parseCssNumber(parts[2] || '0', 125);
    converted = labToRgb(L, a, b, alpha);
  } else if (fn === 'lch') {
    const L = parseCssNumber(parts[0] || '0', 100);
    const C = parseCssNumber(parts[1] || '0', 150);
    const H = parseHueToDegrees(parts[2] || '0');
    const rad = (H * Math.PI) / 180;
    const a = C * Math.cos(rad);
    const b = C * Math.sin(rad);
    converted = labToRgb(L, a, b, alpha);
  } else if (fn === 'color') {
    // color(srgb r g b / a) or color(display-p3 r g b / a)
    const r = parseCssNumber(parts[1] || '0', 1);
    const g = parseCssNumber(parts[2] || '0', 1);
    const b = parseCssNumber(parts[3] || '0', 1);
    const R = Math.max(0, Math.min(255, Math.round(r * 255)));
    const G = Math.max(0, Math.min(255, Math.round(g * 255)));
    const B = Math.max(0, Math.min(255, Math.round(b * 255)));
    converted = alpha < 1 ? `rgba(${R}, ${G}, ${B}, ${Number(alpha.toFixed(3))})` : `rgb(${R}, ${G}, ${B})`;
  }

  colorCache.set(trimmed, converted);
  return converted;
}

/**
 * Replaces all modern color functions inside any CSS string (e.g. style sheet, box-shadow, gradient).
 * Uses balanced parentheses matching to safely handle nested parentheses.
 */
export function replaceModernColorsInCss(cssText: string): string {
  if (!containsModernColorFunction(cssText)) {
    return cssText;
  }

  const colorFuncRegex = /\b(oklab|oklch|lab|lch|color)\s*\(/gi;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let result = '';

  while ((match = colorFuncRegex.exec(cssText)) !== null) {
    const startIndex = match.index;
    result += cssText.slice(lastIndex, startIndex);

    let depth = 1;
    let i = match.index + match[0].length;
    while (i < cssText.length && depth > 0) {
      if (cssText[i] === '(') depth++;
      else if (cssText[i] === ')') depth--;
      i++;
    }

    const rawColor = cssText.slice(startIndex, i);
    const converted = parseAndConvertModernColor(rawColor);
    result += converted;
    lastIndex = i;
    colorFuncRegex.lastIndex = i;
  }

  result += cssText.slice(lastIndex);
  return result;
}

/**
 * Pre-processes and sanitizes a cloned DOM tree before passing to html2canvas.
 * Converts all modern color functions in <style> elements, inline styles,
 * and computed styles to standard RGB/RGBA representations.
 */
export function sanitizeClonedTreeForCapture(
  clonedDoc: Document,
  clonedElement: HTMLElement,
  originalElement?: HTMLElement
): void {
  try {
    // 1. If clonedElement is the offscreen capture stage, bring it to (0, 0)
    // in the cloned document so html2canvas computes positive bounds and aligns correctly
    if (
      clonedElement.id === 'axon-offscreen-capture-stage' ||
      clonedElement.getAttribute('data-capture-stage') === 'true'
    ) {
      clonedElement.style.position = 'relative';
      clonedElement.style.left = '0px';
      clonedElement.style.top = '0px';
      clonedElement.style.margin = '0px';
      clonedElement.style.visibility = 'visible';
      clonedElement.style.opacity = '1';
      clonedElement.style.zIndex = '1';
    } else {
      // Ensure visibility & opacity are active so hidden background screens don't render blank
      clonedElement.style.visibility = 'visible';
      clonedElement.style.opacity = '1';
    }

    // 2. Disable/safely neutralize child iframes in cloned tree
    // so html2canvas never invokes cross-document methods on sandboxed runtimes
    const iframes = clonedElement.querySelectorAll('iframe');
    iframes.forEach((ifr) => {
      try {
        ifr.setAttribute('data-html2canvas-ignore', 'true');
        const placeholder = clonedDoc.createElement('div');
        placeholder.style.width = ifr.style.width || '100%';
        placeholder.style.height = ifr.style.height || '220px';
        placeholder.style.backgroundColor = '#0c0c0c';
        placeholder.style.border = '1px dashed #2e2e2e';
        placeholder.style.borderRadius = '8px';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = '#737373';
        placeholder.style.fontSize = '12px';
        placeholder.style.fontFamily = 'monospace';
        placeholder.textContent = '[Sandboxed Runtime Execution Area]';
        ifr.parentNode?.insertBefore(placeholder, ifr);
        ifr.style.display = 'none';
      } catch {
        ifr.setAttribute('data-html2canvas-ignore', 'true');
      }
    });

    // 3. Sanitize all <style> elements in the cloned document
    const styleTags = clonedDoc.querySelectorAll('style');
    styleTags.forEach((styleTag) => {
      if (styleTag.textContent && containsModernColorFunction(styleTag.textContent)) {
        styleTag.textContent = replaceModernColorsInCss(styleTag.textContent);
      }
    });

    // 4. Relevant color properties to check and sanitize
    const COLOR_CSS_PROPERTIES = [
      'color',
      'background-color',
      'border-top-color',
      'border-right-color',
      'border-bottom-color',
      'border-left-color',
      'outline-color',
      'box-shadow',
      'background-image',
    ];

    const clonedList = [clonedElement, ...Array.from(clonedElement.querySelectorAll('*'))] as HTMLElement[];
    const origList = originalElement
      ? ([originalElement, ...Array.from(originalElement.querySelectorAll('*'))] as HTMLElement[])
      : [];

    const win = clonedDoc.defaultView || (typeof window !== 'undefined' ? window : null);
    const origWin = originalElement?.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null);

    for (let idx = 0; idx < clonedList.length; idx++) {
      const el = clonedList[idx];
      if (!el || !el.style) continue;

      // Check inline style attribute
      const inlineStyle = el.getAttribute('style');
      if (inlineStyle && containsModernColorFunction(inlineStyle)) {
        el.setAttribute('style', replaceModernColorsInCss(inlineStyle));
      }

      // Check computed styles on original element if available
      const origEl = origList[idx];
      if (origEl && origWin) {
        try {
          const origComputed = origWin.getComputedStyle(origEl);
          if (origComputed) {
            for (const prop of COLOR_CSS_PROPERTIES) {
              const val = origComputed.getPropertyValue(prop);
              if (val && containsModernColorFunction(val)) {
                const converted = replaceModernColorsInCss(val);
                el.style.setProperty(prop, converted, 'important');
              }
            }
          }
        } catch {
          // Ignore read errors
        }
      }

      // Check computed styles on cloned element
      if (win) {
        try {
          const clonedComputed = win.getComputedStyle(el);
          if (clonedComputed) {
            for (const prop of COLOR_CSS_PROPERTIES) {
              const val = clonedComputed.getPropertyValue(prop);
              if (val && containsModernColorFunction(val)) {
                const converted = replaceModernColorsInCss(val);
                el.style.setProperty(prop, converted, 'important');
              }
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  } catch (err) {
    console.warn('Modern color sanitization fallback triggered:', err);
  }
}

/**
 * Wraps a Window's getComputedStyle so that any CSS properties
 * containing modern color functions (oklab, oklch, lab, lch, color)
 * are seamlessly normalized to standard rgb/rgba during rendering.
 *
 * CRITICAL FIX: Ensures that when getComputedStyle is invoked across
 * different window/document contexts (such as html2canvas iframe clones),
 * the invocation is executed against the element's actual owner window.
 * Catches all errors and provides safe fallback styles, completely eliminating
 * "Illegal invocation" failures.
 */
export function wrapWindowGetComputedStyle(win: Window): () => void {
  if (!win || !win.getComputedStyle) return () => {};
  const orig = win.getComputedStyle;

  const sanitizeValue = (val: any): any => {
    if (typeof val === 'string' && containsModernColorFunction(val)) {
      try {
        return replaceModernColorsInCss(val);
      } catch {
        return val;
      }
    }
    return val;
  };

  const createProxy = (decl: CSSStyleDeclaration): CSSStyleDeclaration => {
    if (!decl) return decl;
    return new Proxy(decl, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function (propertyName: string) {
            try {
              const v = target.getPropertyValue(propertyName);
              return sanitizeValue(v);
            } catch {
              return '';
            }
          };
        }
        try {
          // Direct property lookup on target ensures the native CSSStyleDeclaration is 'this'
          const val = (target as any)[prop];
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return sanitizeValue(val);
        } catch {
          return '';
        }
      },
    });
  };

  try {
    win.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
      if (!elt || typeof elt !== 'object') {
        return null as any;
      }

      // Identify the true window context of the element to eliminate "Illegal invocation"
      const ownerDoc = elt.ownerDocument;
      const ownerWin = ownerDoc?.defaultView || win;

      try {
        // If the element belongs to another document (e.g. html2canvas iframe clone),
        // query that window's getComputedStyle rather than the host window
        const targetFn =
          ownerWin !== win && typeof ownerWin.getComputedStyle === 'function'
            ? ownerWin.getComputedStyle
            : orig;

        const decl = targetFn.call(ownerWin, elt, pseudoElt);
        if (!decl) return decl;
        return createProxy(decl);
      } catch {
        // Fallback 1: try orig with host win if ownerWin failed
        try {
          const decl = orig.call(win, elt, pseudoElt);
          if (!decl) return decl;
          return createProxy(decl);
        } catch {
          // Fallback 2: Never throw "Illegal invocation"! Return a safe proxy around the inline style or an empty object
          try {
            return createProxy(((elt as any).style || {}) as CSSStyleDeclaration);
          } catch {
            return null as any;
          }
        }
      }
    } as typeof win.getComputedStyle;
  } catch {
    // Non-fatal if setting fails
  }

  return () => {
    try {
      win.getComputedStyle = orig;
    } catch {
      // Ignore restore errors
    }
  };
}

