import React, { useState } from 'react';
import { View } from '../constants';
import { PasswordModal } from '../components/Modals';
import { useAuth } from '../auth/AuthProvider';
import { canAccessAdminDashboard, canAccessStatsPage } from '../lib/permissions';
import homeBgCow from '../assets/supplier-visuals/home-bg-cow.jpg';

interface HomePageProps {
  setView: (v: View) => void;
}

type HomeCardProps = {
  title: string;
  accent: string;
  accent2: string;
  shadow: string;
  edge: string;
  iconTone: string;
  onClick: () => void;
  icon: React.ReactNode;
};

const HomeCard: React.FC<HomeCardProps> = ({
  title,
  accent,
  accent2,
  shadow,
  edge,
  iconTone,
  onClick,
  icon,
}) => {
  return (
    <button
      onClick={onClick}
      className="group relative mx-auto w-full max-w-[350px]"
    >
      <div
        className="absolute inset-0 translate-x-[12px] translate-y-[12px] rounded-[28px]"
        style={{
          background: 'linear-gradient(180deg, rgba(74,53,41,0.95) 0%, rgba(47,31,23,0.96) 100%)',
          boxShadow: '0 18px 34px rgba(0,0,0,0.34)',
        }}
      />

      <div
        className="relative overflow-hidden rounded-[28px] border border-white/55 px-7 py-7"
        style={{
          background: `linear-gradient(180deg, ${accent} 0%, ${accent2} 52%, ${shadow} 100%)`,
          boxShadow:
            'inset 0 2px 0 rgba(255,255,255,0.65), inset 0 -2px 0 rgba(82,48,27,0.30), 0 12px 28px rgba(63,33,18,0.26)',
        }}
      >
        <div
          className="absolute inset-x-8 top-0 h-[4px] rounded-b-full"
          style={{ background: 'rgba(255,255,255,0.65)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 22%, rgba(255,255,255,0.02) 44%, rgba(0,0,0,0.03) 74%, rgba(0,0,0,0.12) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 8%, rgba(255,255,255,0.22), transparent 32%), radial-gradient(circle at 50% 100%, rgba(0,0,0,0.10), transparent 38%)',
          }}
        />

        <div className="relative flex min-h-[150px] flex-col items-center justify-center gap-5 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border"
            style={{
              borderColor: 'rgba(255,255,255,0.35)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)',
              color: iconTone,
            }}
          >
            {icon}
          </div>

          <h2
            className="whitespace-pre-line text-center font-black uppercase leading-[0.94] tracking-[-0.04em] text-[#0d2b57]"
            style={{ fontSize: 'clamp(1.55rem, 2vw, 2.55rem)' }}
          >
            {title}
          </h2>
        </div>

        <div
          className="pointer-events-none absolute inset-0 rounded-[28px]"
          style={{ boxShadow: `0 0 0 1px ${edge} inset` }}
        />
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
          filter: 'brightness(1.02) saturate(1.08)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(78,34,18,0.16) 0%, rgba(50,20,11,0.15) 45%, rgba(31,13,8,0.24) 100%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 18%, rgba(204,128,74,0.10), transparent 32%), radial-gradient(circle at 50% 100%, rgba(137,70,38,0.12), transparent 34%)',
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="w-full max-w-[1740px]">
          <div className="mb-10 text-center lg:mb-12">
            <h1
              className="mb-4 font-black uppercase leading-none tracking-tighter text-[#ffd700]"
              style={{ fontSize: 'clamp(3rem, 6vw, 6.8rem)' }}
            >
              HIPPO
              <br />
              <span className="text-white">COMMANDES</span>
            </h1>
            <div className="mx-auto h-2 w-36 rounded-full bg-red-600 sm:w-44 lg:w-56" />
          </div>

          <div
            className={`grid justify-center gap-x-6 gap-y-8 ${
              showStats
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-5'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
            }`}
          >
            <HomeCard
              title="Commandes"
              accent="#ef9a93"
              accent2="#d75a4f"
              shadow="#ab332a"
              edge="rgba(255,255,255,0.26)"
              iconTone="#b52a22"
              onClick={() => setView('suppliers')}
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 10H4L5 9z" />
                </svg>
              }
            />

            {showStats && (
              <HomeCard
                title="Paramètres"
                accent="#efd36f"
                accent2="#d8aa28"
                shadow="#ae7e10"
                edge="rgba(255,255,255,0.24)"
                iconTone="#9e6a06"
                onClick={() => setView('stats')}
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M7 5v14M12 5v14M17 5v14" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 8h4M10 15h4M15 10h4" />
                  </svg>
                }
              />
            )}

            <HomeCard
              title={'Mix\nProduit'}
              accent="#c084fc"
              accent2="#9333ea"
              shadow="#7e22ce"
              edge="rgba(255,255,255,0.24)"
              iconTone="#6b21a8"
              onClick={() => setView('product_mix')}
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              }
            />

            <HomeCard
              title={'Feuille de\nMise en Place'}
              accent="#e8b382"
              accent2="#cf7d42"
              shadow="#a95d2b"
              edge="rgba(255,255,255,0.23)"
              iconTone="#9f5122"
              onClick={() => setView('prep_sheet')}
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="7" y="4" width="10" height="16" rx="2" strokeWidth="2.2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M10 9h4M10 13h4" />
                </svg>
              }
            />

            <HomeCard
              title={'Analyse\nCoût Matière'}
              accent="#e8c06a"
              accent2="#cb9322"
              shadow="#a86f0f"
              edge="rgba(255,255,255,0.22)"
              iconTone="#99610d"
              onClick={() => setView('cost_analysis')}
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 18h14" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M7 16V9M12 16V6M17 16V11" />
                </svg>
              }
            />

            <HomeCard
              title={'Taux de\nPrise'}
              accent="#f1d36b"
              accent2="#d59b1f"
              shadow="#a06a10"
              edge="rgba(255,255,255,0.22)"
              iconTone="#8f580a"
              onClick={() => setView('take_rate_sheet')}
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 18h16" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M7 14l3-3 3 2 4-5" />
                  <circle cx="7" cy="14" r="1.2" fill="currentColor" stroke="none" />
                  <circle cx="10" cy="11" r="1.2" fill="currentColor" stroke="none" />
                  <circle cx="13" cy="13" r="1.2" fill="currentColor" stroke="none" />
                  <circle cx="17" cy="8" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              }
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
