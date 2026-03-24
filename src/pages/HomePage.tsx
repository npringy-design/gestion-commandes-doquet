import React, { useState } from 'react';
import { View } from '../constants';
import { PasswordModal } from '../components/Modals';
import { useAuth } from '../auth/AuthProvider';
import { canAccessAdminDashboard, canAccessStatsPage } from '../lib/permissions';
import homeBgCow from '../assets/supplier-visuals/home-bg-cow.jpg';

interface HomePageProps {
  setView: (v: View) => void;
}

type IconName = 'bag' | 'sliders' | 'clipboard' | 'chart';

type HomeCardProps = {
  title: string;
  accent: string;
  metalTop: string;
  metalMid: string;
  metalBottom: string;
  shadow: string;
  icon: IconName;
  onClick: () => void;
};

const HomeIcon: React.FC<{ name: IconName; color: string }> = ({ name, color }) => {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'bag':
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path {...common} d="M6.5 9.5h11l-1 9h-9z" />
          <path {...common} d="M9 9.5V8a3 3 0 0 1 6 0v1.5" />
        </svg>
      );
    case 'sliders':
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path {...common} d="M6 5v14" />
          <path {...common} d="M12 5v14" />
          <path {...common} d="M18 5v14" />
          <circle cx="6" cy="9" r="1.4" fill={color} />
          <circle cx="12" cy="15" r="1.4" fill={color} />
          <circle cx="18" cy="11" r="1.4" fill={color} />
        </svg>
      );
    case 'clipboard':
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <rect {...common} x="7" y="5.5" width="10" height="14" rx="2" />
          <path {...common} d="M10 5.5h4" />
          <path {...common} d="M9.5 10.5h5" />
          <path {...common} d="M9.5 14h5" />
        </svg>
      );
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path {...common} d="M5 18.5h14" />
          <path {...common} d="M7.5 16v-4" />
          <path {...common} d="M12 16v-7" />
          <path {...common} d="M16.5 16v-9" />
          <path {...common} d="M7.5 10.5 12 7.5l4.5-2" />
        </svg>
      );
    default:
      return null;
  }
};

const HomeCard: React.FC<HomeCardProps> = ({
  title,
  accent,
  metalTop,
  metalMid,
  metalBottom,
  shadow,
  icon,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="group relative mx-auto h-[184px] w-full max-w-[320px] text-left transition-all duration-300 hover:-translate-y-1"
    >
      <div
        className="absolute inset-x-[8px] bottom-[-10px] top-[8px] rounded-[28px]"
        style={{
          background: `linear-gradient(180deg, ${shadow} 0%, rgba(70,39,22,0.92) 100%)`,
          boxShadow: '0 16px 28px rgba(34, 16, 8, 0.34)',
        }}
      />

      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border px-7 py-6"
        style={{
          background: `linear-gradient(180deg, ${metalTop} 0%, ${metalMid} 52%, ${metalBottom} 100%)`,
          borderColor: `${accent}aa`,
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 0 rgba(105,58,31,0.28), inset 0 18px 24px rgba(255,255,255,0.12)',
        }}
      >
        <div
          className="absolute inset-x-5 top-0 h-[5px] rounded-b-full"
          style={{
            background: `linear-gradient(90deg, ${accent} 0%, ${accent}cc 50%, ${accent} 100%)`,
            boxShadow: `0 2px 8px ${accent}55`,
          }}
        />

        <div
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-2xl border"
          style={{
            color: accent,
            borderColor: `${accent}55`,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.12) 100%)',
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 12px ${accent}22`,
          }}
        >
          <HomeIcon name={icon} color={accent} />
        </div>

        <div className="flex h-full items-center justify-center">
          <h2
            className="max-w-[82%] whitespace-pre-line text-center font-black uppercase leading-[0.92] tracking-[-0.045em] text-[#0d2b57]"
            style={{ fontSize: 'clamp(1.15rem, 1.8vw, 2rem)' }}
          >
            {title}
          </h2>
        </div>
      </div>
    </button>
  );
};

const HomePage: React.FC<HomePageProps> = ({ setView }) => {
  const [showPassword, setShowPassword] = useState(false);
  const { profile } = useAuth();

  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 1023px)').matches;

  const showStats = !isMobile && canAccessStatsPage(profile);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#24130d]">
      {showPassword && (
        <PasswordModal
          onConfirm={() => {
            setShowPassword(false);
            setView('admin_dashboard');
          }}
          onClose={() => setShowPassword(false)}
        />
      )}

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${homeBgCow})`,
          backgroundSize: 'cover',
          backgroundPosition: isMobile ? '72% center' : '68% center',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(0.94) saturate(1.08)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(182,109,61,0.18) 0%, rgba(160,92,52,0.22) 44%, rgba(87,45,24,0.28) 100%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 16%, rgba(230,164,112,0.16), transparent 34%), radial-gradient(circle at 50% 100%, rgba(166,92,54,0.16), transparent 38%)',
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="w-full max-w-[1640px]">
          <div className="mb-8 text-center sm:mb-10 lg:mb-12">
            <h1
              className="mb-4 font-black uppercase leading-none tracking-tighter text-[#ffd700]"
              style={{
                fontSize: 'clamp(3rem, 6vw, 6.8rem)',
              }}
            >
              HIPPO
              <br />
              <span className="text-white">COMMANDES</span>
            </h1>
            <div className="mx-auto h-2 w-36 rounded-full bg-red-600 sm:w-44 lg:w-56" />
          </div>

          <div
            className={`grid justify-center gap-5 lg:gap-7 ${
              showStats
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            <HomeCard
              title="Commandes"
              accent="#df5f54"
              metalTop="#f3cdc8"
              metalMid="#eaaba2"
              metalBottom="#d78d83"
              shadow="rgba(171,86,74,0.95)"
              icon="bag"
              onClick={() => setView('suppliers')}
            />

            {showStats && (
              <HomeCard
                title="Paramètres"
                accent="#cf9b1d"
                metalTop="#f4df9a"
                metalMid="#e3bd52"
                metalBottom="#c7921c"
                shadow="rgba(140,103,22,0.96)"
                icon="sliders"
                onClick={() => setView('stats')}
              />
            )}

            <HomeCard
              title={'Feuille de\nMise en Place'}
              accent="#c96e38"
              metalTop="#efc6a4"
              metalMid="#de9b67"
              metalBottom="#c67843"
              shadow="rgba(131,76,42,0.96)"
              icon="clipboard"
              onClick={() => setView('prep_sheet')}
            />

            <HomeCard
              title={'Analyse\nCoût Matière'}
              accent="#d9821d"
              metalTop="#f0d2a3"
              metalMid="#deae63"
              metalBottom="#c78426"
              shadow="rgba(131,86,28,0.96)"
              icon="chart"
              onClick={() => setView('cost_analysis')}
            />
          </div>

          <button
            onClick={() => {
              if (canAccessAdminDashboard(profile)) {
                setView('admin_dashboard');
                return;
              }
              setShowPassword(true);
            }}
            className="mx-auto mt-8 flex items-center gap-4 text-white/25 transition-colors hover:text-[#ffd700]"
          >
            <span className="text-[11px] font-black uppercase tracking-widest">
              Accès Dashboard Admin
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
