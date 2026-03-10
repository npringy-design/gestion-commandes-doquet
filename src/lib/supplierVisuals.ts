import type { CSSProperties } from 'react';

export type SupplierVisualKey =
  | 'amber-wave'
  | 'wine-cellar'
  | 'grill-fire'
  | 'farm-fresh'
  | 'ice-blue'
  | 'market-green'
  | 'spice-gold'
  | 'night-premium';

export interface SupplierVisualPreset {
  key: SupplierVisualKey;
  name: string;
  description: string;
  cardStyle: CSSProperties;
  thumbStyle: CSSProperties;
}

const makeSvgDataUri = (svg: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

const visual = (
  key: SupplierVisualKey,
  name: string,
  description: string,
  colors: { base: string; glow: string; accent: string; line: string },
  motif: string,
): SupplierVisualPreset => {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${colors.glow}" stop-opacity="0.98"/>
        <stop offset="55%" stop-color="${colors.base}" stop-opacity="0.96"/>
        <stop offset="100%" stop-color="#050505" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect width="800" height="800" fill="url(#g)"/>
    <circle cx="670" cy="160" r="180" fill="${colors.accent}" opacity="0.18"/>
    <circle cx="180" cy="160" r="150" fill="#ffffff" opacity="0.06"/>
    <path d="M-20 610 Q 160 520 300 610 T 640 610 T 840 610 L 840 840 L -20 840 Z" fill="#000000" opacity="0.3"/>
    <path d="M-20 670 Q 120 590 280 680 T 600 690 T 840 650 L 840 840 L -20 840 Z" fill="#000000" opacity="0.18"/>
    <g opacity="0.2" fill="none" stroke="${colors.line}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
      ${motif}
    </g>
  </svg>`;

  const image = makeSvgDataUri(svg.trim());
  const overlay = `linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.78) 100%), ${image}`;
  return {
    key,
    name,
    description,
    cardStyle: {
      backgroundImage: overlay,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    },
    thumbStyle: {
      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.42) 100%), ${image}`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    },
  };
};

export const SUPPLIER_VISUAL_PRESETS: SupplierVisualPreset[] = [
  visual(
    'amber-wave',
    'Ambre boissons',
    'Chaud et lumineux, parfait pour softs, jus et cocktails.',
    { base: '#1b0f0b', glow: '#6f2f13', accent: '#ffd36f', line: '#ffd36f' },
    '<path d="M220 250 v240 M185 288 h70 M200 490 h40"/><path d="M420 215 c20 70 20 160 0 240"/><path d="M480 210 c32 85 32 170 0 255"/><path d="M560 235 q55 60 55 145 q0 85 -55 145"/>',
  ),
  visual(
    'wine-cellar',
    'Cave & vins',
    'Ambiance cave élégante pour vins et alcools.',
    { base: '#140b12', glow: '#4a1732', accent: '#d58ec0', line: '#f1bddb' },
    '<path d="M245 220 h70 q-4 60 -35 95 v115"/><path d="M470 225 h64 q-4 54 -32 88 v124"/><path d="M595 260 q60 40 60 120 t-60 120"/><path d="M170 500 q80 -55 160 0"/>',
  ),
  visual(
    'grill-fire',
    'Grill & braise',
    'Plus intense, idéal boucherie, grill et viandes.',
    { base: '#160d08', glow: '#5b1f0f', accent: '#ff8a3d', line: '#ffbf66' },
    '<path d="M205 430 q45 -110 105 -170 q45 60 45 130 q0 70 -55 110 q-55 -15 -95 -70 z"/><path d="M420 455 q35 -90 90 -145 q35 50 35 110 q0 55 -45 90 q-45 -15 -80 -55 z"/><path d="M120 570 h520"/><path d="M160 610 h440"/>',
  ),
  visual(
    'farm-fresh',
    'Frais & nature',
    'Tons plus naturels pour frais, volailles et laitages.',
    { base: '#10100d', glow: '#324123', accent: '#9dd56a', line: '#d7f0a4' },
    '<path d="M225 495 q75 -170 175 -235 q25 145 -75 235 z"/><path d="M455 475 q55 -115 135 -155 q5 110 -85 185 z"/><path d="M150 580 q120 -55 250 0"/><path d="M395 585 q90 -40 185 0"/>',
  ),
  visual(
    'ice-blue',
    'Surgelé premium',
    'Très propre et lumineux pour surgelés et glaces.',
    { base: '#09121c', glow: '#0f4d7a', accent: '#89d4ff', line: '#d6f3ff' },
    '<path d="M250 220 v250 M170 345 h160 M198 270 l104 150 M302 270 l-104 150"/><path d="M530 245 v205 M458 347 h144 M486 282 l88 129 M574 282 l-88 129"/>',
  ),
  visual(
    'market-green',
    'Marché végétal',
    'Visuel plus vivant pour fruits et légumes.',
    { base: '#0b120b', glow: '#1b4d24', accent: '#95d55f', line: '#cff59a' },
    '<path d="M210 500 q30 -150 140 -220 q25 125 -70 220 z"/><path d="M380 490 q40 -130 155 -180 q10 115 -95 190 z"/><path d="M540 515 q18 -90 90 -145 q14 82 -50 145 z"/>',
  ),
  visual(
    'spice-gold',
    'Épicerie dorée',
    'Chaleureux, polyvalent et élégant.',
    { base: '#171109', glow: '#59401a', accent: '#f4cc75', line: '#ffe3a1' },
    '<path d="M225 225 h95 v70 h-95 z"/><path d="M240 295 v170"/><path d="M470 245 q55 0 85 35 q30 35 30 85 q0 55 -35 90 q-35 35 -90 35"/><path d="M175 560 h420"/>',
  ),
  visual(
    'night-premium',
    'Noir premium',
    'Version élégante et neutre pour tout usage.',
    { base: '#0b0b0d', glow: '#33222e', accent: '#c4b5fd', line: '#f1e9ff' },
    '<path d="M160 520 q85 -35 170 0 t170 0 t170 0"/><path d="M210 275 q50 -50 100 0 t100 0 t100 0"/><circle cx="240" cy="340" r="18"/><circle cx="400" cy="340" r="18"/><circle cx="560" cy="340" r="18"/>',
  ),
];

export const DEFAULT_SUPPLIER_VISUAL_KEY: SupplierVisualKey = 'night-premium';

export const getSupplierVisual = (key?: string | null): SupplierVisualPreset =>
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === key) ??
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === DEFAULT_SUPPLIER_VISUAL_KEY)!;
