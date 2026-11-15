// Éléments visuels partagés des sections Paramètres « Manuels opératoires » et
// « Allergènes » : icônes (SVG en ligne, comme ailleurs dans l'application),
// en-tête de section, étiquettes et boutons icônes.

import React from 'react';

type IconProps = { className?: string };

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const FlameIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-1-5 1-8z" />
  </svg>
);

export const SnowflakeIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />
  </svg>
);

export const BowlIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path d="M3 11h18a9 9 0 0 1-18 0zM8 20h8M8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3" />
  </svg>
);

export const DocumentIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6" />
  </svg>
);

export const AlertTriangleIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);

export const EyeIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path d="M20 11a8 8 0 0 0-14.5-4.3L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 4.3L20 15M20 20v-5h-5" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path d="M5 12.5 10 17.5 19 7" />
  </svg>
);

// En-tête commun : titre, sous-titre et action alignée à droite (sous le sous-titre sur téléphone).
export const SectionHeader: React.FC<{ title: string; subtitle: string; level?: 2 | 3; action?: React.ReactNode }> = ({
  title,
  subtitle,
  level = 2,
  action,
}) => {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Heading className="text-xl font-black text-[#3A2116]">{title}</Heading>
        <p className="mt-1 text-sm text-[#6B4A33]">{subtitle}</p>
      </div>
      {action ? <div className="shrink-0 self-start">{action}</div> : null}
    </div>
  );
};

export const headerButtonClass =
  'inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#512A16] px-3 py-2 text-sm font-bold text-white hover:bg-[#3A2116] disabled:cursor-not-allowed disabled:opacity-50';

type TagTone = 'neutral' | 'orange' | 'green' | 'red';

const TAG_TONES: Record<TagTone, string> = {
  neutral: 'bg-[#F5ECD9] text-[#6B4A33]',
  orange: 'bg-amber-100 text-amber-900',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
};

export const Tag: React.FC<{ tone?: TagTone; children: React.ReactNode }> = ({ tone = 'neutral', children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${TAG_TONES[tone]}`}>{children}</span>
);

export const IconButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, disabled = false, danger = false, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-[#FFF8E8] disabled:opacity-50 ${
      danger
        ? 'border-red-300 text-red-700 hover:bg-red-50'
        : 'border-[#C89245] text-[#512A16] hover:bg-[#FFF2CF]'
    }`}
  >
    {children}
  </button>
);

// Carte d'un manuel ou du guide d'allergènes : pastille d'icône, texte, actions
// (sous le texte, alignées à droite, en largeur réduite).
export const ItemCard: React.FC<{
  icon: React.ReactNode;
  iconClass: string;
  actions: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, iconClass, actions, children }) => (
  <div className="flex flex-col gap-3 rounded-xl border border-[#E2C79B] bg-[#FFFBF2] p-3 sm:flex-row sm:items-center">
    <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
    <div className="flex justify-end gap-2">{actions}</div>
  </div>
);
