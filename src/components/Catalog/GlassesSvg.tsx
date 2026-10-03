import React from 'react';

interface GlassesSvgProps {
  type: string;
  frameColor: string;
  lensColor: string;
  className?: string;
}

export const GlassesSvg: React.FC<GlassesSvgProps> = ({
  type,
  frameColor,
  lensColor,
  className = 'w-full h-20',
}) => {
  switch (type) {
    case 'aviator':
      return (
        <svg viewBox="0 0 200 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Top Brow Bar */}
          <path d="M 45 22 Q 100 24 155 22" stroke={frameColor} strokeWidth="2.5" strokeLinecap="round" />
          {/* Bridge Bar */}
          <path d="M 85 30 Q 100 27 115 30" stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
          {/* Left Teardrop Rim & Lens */}
          <path
            d="M 40 26 C 20 26 15 45 22 62 C 30 78 72 76 82 56 C 88 44 85 28 40 26 Z"
            fill={lensColor}
            fillOpacity="0.85"
            stroke={frameColor}
            strokeWidth="3.2"
          />
          {/* Left Lens Highlight */}
          <path
            d="M 32 35 Q 26 48 30 58"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="0.4"
          />
          {/* Right Teardrop Rim & Lens */}
          <path
            d="M 160 26 C 180 26 185 45 178 62 C 170 78 128 76 118 56 C 112 44 115 28 160 26 Z"
            fill={lensColor}
            fillOpacity="0.85"
            stroke={frameColor}
            strokeWidth="3.2"
          />
          {/* Right Lens Highlight */}
          <path
            d="M 168 35 Q 174 48 170 58"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="0.4"
          />
          {/* Temple End Hinges */}
          <path d="M 18 32 L 6 36" stroke={frameColor} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 182 32 L 194 36" stroke={frameColor} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'wayfarer':
      return (
        <svg viewBox="0 0 200 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Solid Acetate Frame Body */}
          <path
            d="M 14 22 L 94 22 C 97 22 99 26 100 30 C 101 26 103 22 106 22 L 186 22 C 192 22 194 28 190 35 L 176 68 C 173 74 165 76 156 74 L 122 66 C 116 64 114 56 116 48 L 118 36 C 118 32 114 30 110 30 L 90 30 C 86 30 82 32 82 36 L 84 48 C 86 56 84 64 78 66 L 44 74 C 35 76 27 74 24 68 L 10 35 C 6 28 8 22 14 22 Z"
            fill={frameColor}
            stroke={frameColor}
            strokeWidth="2"
          />
          {/* Left Trapezoidal Lens */}
          <path
            d="M 28 29 L 80 29 C 83 29 85 32 84 36 L 76 63 C 74 68 68 70 60 68 L 38 64 C 31 62 26 56 26 49 L 24 35 C 24 31 26 29 28 29 Z"
            fill={lensColor}
            fillOpacity="0.88"
          />
          <path d="M 33 34 L 70 34" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.3" strokeLinecap="round" />
          {/* Right Trapezoidal Lens */}
          <path
            d="M 172 29 L 120 29 C 117 29 115 32 116 36 L 124 63 C 126 68 132 70 140 68 L 162 64 C 169 62 174 56 174 49 L 176 35 C 176 31 174 29 172 29 Z"
            fill={lensColor}
            fillOpacity="0.88"
          />
          <path d="M 167 34 L 130 34" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.3" strokeLinecap="round" />
          {/* Iconic Metal Rivets */}
          <ellipse cx="18" cy="27" rx="3.5" ry="1.8" fill="#D4AF37" />
          <ellipse cx="182" cy="27" rx="3.5" ry="1.8" fill="#D4AF37" />
        </svg>
      );

    case 'sport':
      return (
        <svg viewBox="0 0 200 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Upper Aerodynamic Brow */}
          <path
            d="M 10 32 C 30 18 70 16 100 16 C 130 16 170 18 190 32 C 194 35 192 40 186 38 C 160 30 130 25 100 25 C 70 25 40 30 14 38 C 8 40 6 35 10 32 Z"
            fill={frameColor}
          />
          {/* Continuous Plutonite Shield Lens */}
          <path
            d="M 14 38 Q 100 24 186 38 C 188 48 184 62 175 66 C 150 72 120 70 108 55 C 104 50 96 50 92 55 C 80 70 50 72 25 66 C 16 62 12 48 14 38 Z"
            fill={lensColor}
            fillOpacity="0.88"
            stroke={frameColor}
            strokeWidth="1.5"
          />
          {/* Shield Lens Vent cutouts */}
          <path d="M 40 34 L 52 32" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.6" />
          <path d="M 148 32 L 160 34" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.6" />
        </svg>
      );

    case 'hexagonal':
      return (
        <svg viewBox="0 0 200 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Thin Bridge */}
          <path d="M 85 36 Q 100 32 115 36" stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
          {/* Left Hexagonal Lens & Rim */}
          <polygon
            points="38,20 74,20 88,40 74,68 38,68 24,40"
            fill={lensColor}
            fillOpacity="0.85"
            stroke={frameColor}
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <line x1="38" y1="24" x2="68" y2="24" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.4" />
          {/* Right Hexagonal Lens & Rim */}
          <polygon
            points="126,20 162,20 176,40 162,68 126,68 112,40"
            fill={lensColor}
            fillOpacity="0.85"
            stroke={frameColor}
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <line x1="128" y1="24" x2="158" y2="24" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.4" />
          {/* Temples */}
          <path d="M 24 40 L 8 42" stroke={frameColor} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 176 40 L 192 42" stroke={frameColor} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'round':
      return (
        <svg viewBox="0 0 200 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* High Curved Brow Bridge */}
          <path d="M 86 36 Q 100 28 114 36" stroke={frameColor} strokeWidth="3.2" strokeLinecap="round" />
          {/* Left Circular Rim & Lens */}
          <circle
            cx="54"
            cy="44"
            r="26"
            fill={lensColor}
            fillOpacity="0.85"
            stroke={frameColor}
            strokeWidth="3.2"
          />
          <path d="M 40 32 A 20 20 0 0 1 68 32" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
          {/* Right Circular Rim & Lens */}
          <circle
            cx="146"
            cy="44"
            r="26"
            fill={lensColor}
            fillOpacity="0.85"
            stroke={frameColor}
            strokeWidth="3.2"
          />
          <path d="M 132 32 A 20 20 0 0 1 160 32" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
          {/* Temples */}
          <path d="M 28 44 L 10 44" stroke={frameColor} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 172 44 L 190 44" stroke={frameColor} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'cateye':
      return (
        <svg viewBox="0 0 200 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Upswept High-Fashion Bridge */}
          <path d="M 88 38 Q 100 32 112 38" stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
          {/* Left Sculpted Cat-Eye */}
          <path
            d="M 16 24 C 20 20 54 26 84 32 C 86 46 80 62 60 66 C 40 70 24 58 20 44 C 18 36 12 28 16 24 Z"
            fill={lensColor}
            fillOpacity="0.85"
            stroke={frameColor}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Right Sculpted Cat-Eye */}
          <path
            d="M 184 24 C 180 20 146 26 116 32 C 114 46 120 62 140 66 C 160 70 176 58 180 44 C 182 36 188 28 184 24 Z"
            fill={lensColor}
            fillOpacity="0.85"
            stroke={frameColor}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Gold Accent Hinges */}
          <circle cx="16" cy="24" r="3" fill="#D4AF37" />
          <circle cx="184" cy="24" r="3" fill="#D4AF37" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 200 80" className={className} fill="none">
          <rect x="25" y="25" width="60" height="35" rx="10" stroke={frameColor} strokeWidth="3" fill={lensColor} />
          <rect x="115" y="25" width="60" height="35" rx="10" stroke={frameColor} strokeWidth="3" fill={lensColor} />
          <path d="M 85 40 L 115 40" stroke={frameColor} strokeWidth="3" />
        </svg>
      );
  }
};
