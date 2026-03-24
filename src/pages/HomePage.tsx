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
  fill: string;
  icon: IconName;
  onClick: () => void;
};

const HomeIcon: React.FC<{ name: IconName; color: string }> = ({ name, color }) => {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'bag':
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
          <path {...common} d="M6.5 9.5h11l-1 9h-9z" />
          <path {...common} d="M9 9.5V8a3 3 0 0 1 6 0v1.5" />
        </svg>
      );
    case 'sliders':
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
          <path {...common} d="M6 5v14" />
          <path {...common} d="M12 5v14" />
          <path {...common} d="M18 5v14" />
          <circle cx="6" cy="9" r="2.2" fill={color} />
          <circle cx="12" cy="15" r="2.2" fill={color} />
          <circle cx="18" cy="11" r="2.2" fill={color} />
        </svg>
      );
    case 'clipboard':
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
          <rect {...common} x="7" y="5.5" width="10" height="14" rx="2" />
          <path {...common} d="M10 5.5h4" />
          <path {...common} d="M9.5 10.5h5" />
          <path {...common} d="M9.5 14h5" />
        </svg>
      );
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
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

const HomeCard: React.FC<HomeCardProps> = ({ title, accent, fill, icon, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="group relative mx-auto flex h-[188px] w-full max-w-[320px] items-center justify-center overflow-hidden rounded-[28px] border border-[#e2bf99] px-6 py-6 text-center transition-all duration-300 hover:-translate-y-1"
      style={{
        background: fill,
        boxShadow:
          '0 22px 40px rgba(39, 19, 10, 0.26), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -10px 18px rgba(126, 67, 39, 0.06)',
      }}
    >
      <div
        className="absolute inset-x-5 top-0 h-[4px] rounded-b-full"
        style={{ backgroundColor: accent }}
      />

      <div
        className="absolute inset-x-6 top-4 h-10 rounded-full opacity-50 blur-xl"
        style={{ background: `linear-gradient(180deg, ${accent}22 0%, transparent 100%)` }}
      />

      <div className="relative flex h-full w-full flex-col items-center justify-center gap-5">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl border"
          style={{
            color: accent,
            borderColor: `${accent}55`,
            background: `linear-gradient(180deg, ${accent}1f 0%, rgba(255,255,255,0.35) 100%)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.65), 0 10px 18px ${accent}18`,
          }}
        >
          <HomeIcon name={icon} color={accent} />
        </div>

        <h2
          className="whitespace-pre-line text-center font-black uppercase leading-[0.94] tracking-[-0.05em] text-[#0d2b57]"
          style={{ fontSize: 'clamp(1.15rem, 1.8vw, 2rem)' }}
        >
          {title}
        </h2>
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
          filter: 'brightness(0.98) saturate(1.05)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(153,83,42,0.24) 0%, rgba(126,69,37,0.32) 45%, rgba(66,31,17,0.38) 100%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 18%, rgba(223,133,81,0.20), transparent 34%), radial-gradient(circle at 50% 100%, rgba(165,87,49,0.20), transparent 38%)',
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
            className={`grid justify-center gap-5 lg:gap-6 ${
              showStats
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            <HomeCard
              title="Commandes"
              accent="#e45449"
              fill="linear-gradient(180deg, rgba(248,223,214,0.98) 0%, rgba(241,205,191,0.98) 100%)"
              icon="bag"
              onClick={() => setView('suppliers')}
            />

            {showStats && (
              <HomeCard
                title="Paramètres"
                accent="#d69a15"
                fill="linear-gradient(180deg, rgba(248,230,188,0.98) 0%, rgba(240,211,154,0.98) 100%)"
                icon="sliders"
                onClick={() => setView('stats')}
              />
            )}

            <HomeCard
              title={'Feuille de\nMise en Place'}
              accent="#c96b36"
              fill="linear-gradient(180deg, rgba(248,224,196,0.98) 0%, rgba(239,201,164,0.98) 100%)"
              icon="clipboard"
              onClick={() => setView('prep_sheet')}
            />

            <HomeCard
              title={'Analyse\nCoût Matière'}
              accent="#e78927"
              fill="linear-gradient(180deg, rgba(249,225,192,0.98) 0%, rgba(241,204,159,0.98) 100%)"
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
