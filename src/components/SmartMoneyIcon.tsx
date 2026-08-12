import React from 'react';

interface SmartMoneyIconProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

/**
 * Minimalist Smart Money Concepts (SMC) Icon Component.
 * Visualizes core SMC elements: Candlesticks, FVG (Fair Value Gap) Zone, and BOS (Break of Structure).
 */
export const SmartMoneyIcon: React.FC<SmartMoneyIconProps> = ({
  className = 'w-5 h-5 text-emerald-400',
  size = 24,
  glow = false,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${glow ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]' : ''}`}
    >
      {/* 1. Fair Value Gap (FVG) Translucent Zone Box */}
      <rect
        x="3.5"
        y="8.5"
        width="17"
        height="7"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1"
        strokeDasharray="2 1.5"
      />

      {/* 2. Order Block / POI Base Box */}
      <rect
        x="3"
        y="17"
        width="6"
        height="4"
        rx="1"
        fill="currentColor"
        fillOpacity="0.35"
      />

      {/* 3. First Candlestick (Left - Bearish Sweep) */}
      <line x1="6" y1="12" x2="6" y2="19" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="4.5" y="14" width="3" height="4" rx="0.5" fill="currentColor" opacity="0.7" />

      {/* 4. Second Candlestick (Center - Explosive Bullish Expansion through FVG) */}
      <line x1="12" y1="5" x2="12" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="10" y="8" width="4" height="8" rx="0.8" fill="currentColor" />

      {/* 5. Third Candlestick (Right - Continuation High) */}
      <line x1="18" y1="3" x2="18" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="16.5" y="4" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.9" />

      {/* 6. Break of Structure (BOS) Step Line & Arrowhead */}
      <path
        d="M10 5.5H19.5M19.5 5.5L17.5 3.5M19.5 5.5L17.5 7.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
