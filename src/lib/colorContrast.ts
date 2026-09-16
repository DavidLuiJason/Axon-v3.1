/**
 * Color and Contrast Utility for AXON Chat & Theme System
 * Implements WCAG 2.1 relative luminance and contrast ratio specifications.
 */

// Helper to sanitize and normalize any hex or rgb color string to standard 6-digit hex #rrggbb
export function normalizeHex(color?: string, fallback = '#000000'): string {
  if (!color || typeof color !== 'string') return fallback;
  const trimmed = color.trim().toLowerCase();

  // If already standard #rrggbb
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed;
  }

  // If short #rgb
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  // If starts with rgb(...)
  const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10)).toString(16).padStart(2, '0');
    const g = Math.min(255, parseInt(rgbMatch[2], 10)).toString(16).padStart(2, '0');
    const b = Math.min(255, parseInt(rgbMatch[3], 10)).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  // Return fallback if unrecognized
  return fallback;
}

// Calculate relative luminance of a color according to WCAG 2.1
export function getLuminance(hexColor: string): number {
  const hex = normalizeHex(hexColor, '#000000').replace('#', '');
  const r8 = parseInt(hex.substring(0, 2), 16) / 255;
  const g8 = parseInt(hex.substring(2, 4), 16) / 255;
  const b8 = parseInt(hex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio between two colors (ranging from 1.0 to 21.0)
export function getContrastRatio(fgColor: string, bgColor: string): number {
  const lum1 = getLuminance(fgColor);
  const lum2 = getLuminance(bgColor);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Get the optimal high-contrast monochrome color (pure black or pure white) for any background
export function getAutoContrastColor(bgColor: string): string {
  const lum = getLuminance(bgColor);
  // If background is light (lum >= 0.45), crisp black is highest contrast; otherwise pure white
  return lum >= 0.45 ? '#000000' : '#ffffff';
}

// Evaluates contrast quality rating based on WCAG standards
export function getContrastQuality(ratio: number): {
  label: string;
  badgeClass: string;
  isGood: boolean;
  color: string;
} {
  if (ratio >= 7.0) {
    return {
      label: 'AAA Excellent',
      badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-800',
      isGood: true,
      color: '#10b981',
    };
  }
  if (ratio >= 4.5) {
    return {
      label: 'AA High Visibility',
      badgeClass: 'bg-teal-950 text-teal-300 border-teal-800',
      isGood: true,
      color: '#14b8a6',
    };
  }
  if (ratio >= 3.0) {
    return {
      label: 'Acceptable',
      badgeClass: 'bg-amber-950 text-amber-300 border-amber-800',
      isGood: true,
      color: '#f59e0b',
    };
  }
  return {
    label: 'Low Contrast Warning',
    badgeClass: 'bg-rose-950 text-rose-300 border-rose-800',
    isGood: false,
    color: '#f43f5e',
  };
}

export interface RecommendedColor {
  name: string;
  hex: string;
  ratio: number;
  contrastRatio: number;
  quality: {
    label: string;
    badgeClass: string;
    isGood: boolean;
    color: string;
  };
}

// Generates an array of recommended high-visibility colors dynamically for any given background color
export function getRecommendedColors(bgColor: string): RecommendedColor[] {
  const candidates = [
    { name: 'Pure White', hex: '#ffffff' },
    { name: 'Crisp Black', hex: '#000000' },
    { name: 'Deep Charcoal', hex: '#1e293b' },
    { name: 'Cool Silver', hex: '#e2e8f0' },
    { name: 'Vibrant Amber', hex: '#f59e0b' },
    { name: 'Electric Cyan', hex: '#06b6d4' },
    { name: 'Emerald Mint', hex: '#10b981' },
    { name: 'Neon Lime', hex: '#22c55e' },
    { name: 'Vivid Rose', hex: '#f43f5e' },
    { name: 'Bright Violet', hex: '#a855f7' },
    { name: 'Sky Blue', hex: '#38bdf8' },
    { name: 'Royal Navy', hex: '#1e3a8a' },
    { name: 'Deep Wine', hex: '#881337' },
    { name: 'Warm Cream', hex: '#fef3c7' },
    { name: 'Sunburst Orange', hex: '#ea580c' },
  ];

  return candidates
    .map((c) => {
      const ratio = Math.round(getContrastRatio(c.hex, bgColor) * 10) / 10;
      return {
        name: c.name,
        hex: c.hex,
        ratio,
        contrastRatio: ratio,
        quality: getContrastQuality(ratio),
      };
    })
    .filter((c) => c.ratio >= 4.0) // Only recommend colors that meet or nearly meet WCAG AA
    .sort((a, b) => b.ratio - a.ratio); // Highest contrast first
}

/**
 * Resolves the effective message action button color.
 * If user hasn't specified a color, or if autoContrast is enabled and the chosen
 * color does not meet minimum visibility requirements (ratio < 2.8), it adapts
 * automatically to guarantee high visibility against the current bubble color.
 */
export function resolveMessageButtonColor(
  customColor?: string,
  bubbleBg?: string,
  autoContrast = true
): string {
  const normBg = normalizeHex(bubbleBg, '#171717');

  // If no custom color set, use auto contrast
  if (!customColor) {
    return getAutoContrastColor(normBg);
  }

  const normCustom = normalizeHex(customColor, '#ffffff');

  // If autoContrast mode is enabled, check if the chosen custom color clashes
  if (autoContrast) {
    const ratio = getContrastRatio(normCustom, normBg);
    // If contrast is poor (< 2.8:1), automatically adapt to prevent invisible buttons
    if (ratio < 2.8) {
      return getAutoContrastColor(normBg);
    }
  }

  return normCustom;
}
