import React from 'react';
import { IconPreset } from '../types';

interface AxonLogoProps {
  size?: number;
  className?: string;
  preset?: IconPreset;
  customUrl?: string;
  glow?: boolean;
}

export const AxonLogo: React.FC<AxonLogoProps> = ({
  size = 40,
  className = '',
  preset = 'axon-orb',
  customUrl,
  glow = true,
}) => {
  if (customUrl) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 border border-white/20 bg-neutral-900 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={customUrl}
          alt="Avatar"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Built-in presets
  if (preset === 'axon-minimal') {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-full bg-neutral-900 border border-white/20 text-white font-bold select-none shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(12, size * 0.45) }}
      >
        <span>A</span>
      </div>
    );
  }

  if (preset === 'axon-neural') {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-full bg-neutral-900 border border-white/20 text-white shrink-0 overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full p-1 text-white"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="50" cy="50" r="14" fill="white" fillOpacity="0.9" />
          <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 4" />
          <path d="M50 15 L50 32 M50 68 L50 85 M15 50 L32 50 M68 50 L85 50" strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="15" r="4" fill="white" />
          <circle cx="50" cy="85" r="4" fill="white" />
          <circle cx="15" cy="50" r="4" fill="white" />
          <circle cx="85" cy="50" r="4" fill="white" />
        </svg>
      </div>
    );
  }

  if (preset === 'axon-cyber') {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-full bg-neutral-950 border border-white/30 text-white shrink-0 overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" fill="none">
          <polygon points="50,14 86,78 14,78" stroke="white" strokeWidth="4" strokeLinejoin="round" />
          <polygon points="50,38 70,72 30,72" fill="white" fillOpacity="0.3" />
          <circle cx="50" cy="62" r="5" fill="white" />
        </svg>
      </div>
    );
  }

  // Default: Authentic AXON Glowing Orb Logo ('axon-orb') matching user concept image
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-sm overflow-visible"
        fill="none"
      >
        <defs>
          <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="75%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="blurFilter" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>

        {/* Ambient Dark Background Circle for contrast if placed on light surfaces */}
        <circle cx="100" cy="100" r="92" fill="#09090b" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />

        {/* Central Luminous Aura / Glow */}
        {glow && (
          <circle
            cx="100"
            cy="116"
            r="38"
            fill="url(#orbGlow)"
            filter="url(#blurFilter)"
            opacity="0.8"
          />
        )}

        {/* The Sculpted 'A' Frame of AXON */}
        <path
          d="M 100 32
             C 124 32, 142 54, 150 78
             L 168 145
             C 170 152, 166 158, 158 158
             L 142 158
             C 136 158, 131 154, 129 148
             L 125 132
             C 123 118, 134 104, 136 94
             C 134 82, 120 80, 114 96
             L 94 136
             C 86 152, 70 158, 56 158
             L 42 158
             C 34 158, 30 152, 32 145
             L 50 82
             C 58 52, 76 32, 100 32 Z"
          fill="#ffffff"
        />

        {/* Stylized Cross-Arc Cutout defining AXON's signature curve */}
        <path
          d="M 44 132
             C 66 132, 88 120, 102 96
             C 116 72, 128 72, 136 92"
          stroke="#09090b"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* The Core White Sphere / Orb */}
        <circle cx="100" cy="116" r="16" fill="#ffffff" />
        <circle cx="96" cy="112" r="5" fill="#f4f4f5" opacity="0.9" />

        {/* Little Sparkle Accent in bottom-right corner as seen on official branding */}
        <path
          d="M 172 156 Q 172 163 165 163 Q 172 163 172 170 Q 172 163 179 163 Q 172 163 172 156 Z"
          fill="#a1a1aa"
        />
      </svg>
    </div>
  );
};
