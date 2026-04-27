import React from 'react';

type AppNavTileIcon = 'home' | 'back' | 'settings' | 'sheet';
type AppNavTileTone = 'cream' | 'gold' | 'dark';
type AppNavTileSize = 'sm' | 'md' | 'lg' | 'icon';

interface AppNavTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  eyebrow?: string;
  icon?: AppNavTileIcon;
  size?: AppNavTileSize;
  tone?: AppNavTileTone;
}

const icons: Record<AppNavTileIcon, React.ReactNode> = {
  home: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  back: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  settings: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  sheet: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

const toneClasses: Record<AppNavTileTone, string> = {
  cream: 'border-[#E2B16E]/75 bg-[#FFF7EA]/95 text-[#3A2116] shadow-[0_8px_18px_rgba(31,14,8,0.14)] hover:bg-white',
  gold: 'border-[#D9A72B] bg-[linear-gradient(180deg,#F7D66A_0%,#E5AF2F_100%)] text-[#4D2B18] shadow-[0_4px_0_#B8810F] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]',
  dark: 'border-[#F1C27B]/45 bg-[#FFF7EA] text-[#3A2116] shadow-[0_10px_22px_rgba(31,14,8,0.22)] hover:bg-white',
};

const sizeClasses: Record<AppNavTileSize, string> = {
  sm: 'min-h-[48px] rounded-[15px] px-3.5 py-2.5 text-xs',
  md: 'min-h-[58px] rounded-[18px] px-4 py-3 text-sm',
  lg: 'min-h-[66px] rounded-[20px] px-5 py-4 text-sm',
  icon: 'h-11 w-11 rounded-[16px] p-0 text-sm',
};

const AppNavTile: React.FC<AppNavTileProps> = ({
  eyebrow,
  icon,
  size = 'md',
  tone = 'cream',
  className = '',
  children,
  type = 'button',
  ...props
}) => {
  const iconOnly = size === 'icon';

  return (
    <button
      type={type}
      className={[
        'inline-flex shrink-0 items-center justify-center gap-3 border font-black uppercase tracking-[0.10em] transition-all disabled:cursor-not-allowed disabled:opacity-50',
        toneClasses[tone],
        sizeClasses[size],
        iconOnly ? '' : 'text-left',
        className,
      ].join(' ')}
      {...props}
    >
      {icon && <span className="flex shrink-0 items-center justify-center">{icons[icon]}</span>}
      {!iconOnly && (
        <span className="min-w-0 leading-tight">
          {eyebrow && <span className="mb-0.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#A85F2A]">{eyebrow}</span>}
          <span className="block whitespace-normal normal-case tracking-normal">{children}</span>
        </span>
      )}
    </button>
  );
};

export default AppNavTile;
