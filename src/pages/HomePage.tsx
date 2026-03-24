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
  fill: string;
  symbol: string;
  onClick: () => void;
};

const HomeCard: React.FC<HomeCardProps> = ({ title, accent, fill, symbol, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="group relative mx-auto flex w-full max-w-[270px] items-center justify-center overflow-hidden rounded-[26px] border border-[#e8c9a8] px-6 py-6 text-center shadow-[0_14px_30px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(0,0,0,0.28)]"
      style={{ background: fill }}
    >
      <div
        className="absolute inset-x-7 top-0 h-[4px] rounded-b-full"
        style={{ backgroundColor: accent }}
      />

      <div className="flex min-h-[138px] flex-col items-center justify-center gap-4">
        <span
          aria-hidden="true"
          className="select-none text-[2rem] leading-none transition-transform duration-300 group-hover:scale-105"
          style={{ color: accent }}
        >
          {symbol}
        </span>
        <h2
          className="whitespace-pre-line text-center font-black uppercase leading-[0.94] tracking-[-0.05em] text-[#0d2b57]"
          style={{ fontSize: 'clamp(1.1rem, 1.7vw, 2rem)' }}
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
          filter: 'brightness(0.98) saturate(1.02)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(121,63,34,0.22) 0%, rgba(94,47,25,0.28) 45%, rgba(51,24,14,0.34) 100%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 20%, rgba(205,118,68,0.16), transparent 34%), radial-gradient(circle at 50% 100%, rgba(149,74,40,0.16), transparent 36%)',
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
            className={`grid justify-center gap-4 lg:gap-5 ${
              showStats
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            <HomeCard
              title="Commandes"
              accent="#e45449"
              fill="linear-gradient(180deg, rgba(248,232,226,0.97) 0%, rgba(244,223,214,0.97) 100%)"
              symbol="⌂"
              onClick={() => setView('suppliers')}
            />

            {showStats && (
              <HomeCard
                title="Paramètres"
                accent="#d69a15"
                fill="linear-gradient(180deg, rgba(248,239,222,0.97) 0%, rgba(243,229,201,0.97) 100%)"
                symbol="≡"
                onClick={() => setView('stats')}
              />
            )}

            <HomeCard
              title={'Feuille de\nMise en Place'}
              accent="#c97a2b"
              fill="linear-gradient(180deg, rgba(248,236,223,0.97) 0%, rgba(243,223,203,0.97) 100%)"
              symbol="□"
              onClick={() => setView('prep_sheet')}
            />

            <HomeCard
              title={'Analyse\nCoût Matière'}
              accent="#e78927"
              fill="linear-gradient(180deg, rgba(248,236,225,0.97) 0%, rgba(244,225,207,0.97) 100%)"
              symbol="△"
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
