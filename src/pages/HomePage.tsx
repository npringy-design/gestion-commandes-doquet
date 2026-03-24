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
  accentSoft: string;
  onClick: () => void;
  children: React.ReactNode;
  compactTitle?: boolean;
};

const HomeCard: React.FC<HomeCardProps> = ({
  title,
  accent,
  accentSoft,
  onClick,
  children,
  compactTitle = false,
}) => {
  return (
    <button
      onClick={onClick}
      className="group relative w-full max-w-[360px] mx-auto rounded-[28px] border border-white/35 bg-[#f6efe7]/95 px-6 py-6 sm:px-7 sm:py-7 text-left shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-[2px] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_56px_rgba(0,0,0,0.28)]"
    >
      <div
        className="absolute inset-x-5 top-0 h-1 rounded-b-full opacity-90 transition-all duration-300 group-hover:inset-x-4"
        style={{ backgroundColor: accent }}
      />

      <div className="flex h-full min-h-[220px] flex-col">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-black/5 shadow-sm transition-all duration-300 group-hover:scale-[1.03]"
            style={{ backgroundColor: accentSoft }}
          >
            {children}
          </div>
          <div
            className="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-700/70"
            style={{ borderColor: `${accent}55` }}
          >
            Ouvrir
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <h2
            className={`font-black uppercase tracking-[-0.04em] text-[#0d2b57] ${compactTitle ? 'leading-[0.95]' : 'leading-[0.9]'}`}
            style={{ fontSize: compactTitle ? 'clamp(1.75rem, 2.2vw, 2.7rem)' : 'clamp(2rem, 2.4vw, 3rem)' }}
          >
            {title}
          </h2>
          <div className="flex items-center gap-3 text-[13px] font-bold text-slate-700/70">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: accent }}
            />
            Module principal
          </div>
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
    <div className="min-h-screen bg-[#1a0f0a] relative overflow-hidden">
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
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `url(${homeBgCow})`,
          backgroundSize: 'cover',
          backgroundPosition: isMobile ? '72% center' : '68% center',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(1.08)',
          transform: 'scale(1)',
        }}
      />

      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(rgba(26,15,10,0.56), rgba(26,15,10,0.62))',
        }}
      />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-10 py-8 lg:py-12">
        <div className="w-full max-w-[1720px]">
          <div className="text-center mb-8 sm:mb-10 lg:mb-14">
            <h1
              className="text-[#ffd700] font-black uppercase tracking-tighter leading-none mb-4"
              style={{
                fontSize: 'clamp(3rem, 6vw, 6.8rem)',
              }}
            >
              HIPPO
              <br />
              <span className="text-white">COMMANDES</span>
            </h1>
            <div className="h-2 w-36 sm:w-44 lg:w-56 bg-red-600 mx-auto rounded-full" />
          </div>

          <div
            className={`grid gap-5 lg:gap-6 mb-8 justify-center ${
              showStats
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            <HomeCard
              title="Commandes"
              accent="#e53935"
              accentSoft="#f7dfe0"
              onClick={() => setView('suppliers')}
            >
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </HomeCard>

            {showStats && (
              <HomeCard
                title="Paramètres"
                accent="#d18a00"
                accentSoft="#f5e9bf"
                onClick={() => setView('stats')}
              >
                <svg
                  className="w-8 h-8 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </HomeCard>
            )}

            <HomeCard
              title="Feuille de\nMise en Place"
              accent="#169b63"
              accentSoft="#d7f1e4"
              onClick={() => setView('prep_sheet')}
              compactTitle
            >
              <svg
                className="w-8 h-8 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 6v12m6-6H6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
                />
              </svg>
            </HomeCard>

            <HomeCard
              title="Analyse\nCoût Matière"
              accent="#ea6a11"
              accentSoft="#f8ead7"
              onClick={() => setView('cost_analysis')}
              compactTitle
            >
              <svg
                className="w-8 h-8 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
            </HomeCard>
          </div>

          <button
            onClick={() => {
              if (canAccessAdminDashboard(profile)) {
                setView('admin_dashboard');
                return;
              }
              setShowPassword(true);
            }}
            className="flex items-center gap-4 mx-auto text-white/25 hover:text-[#ffd700] transition-colors"
          >
            <span className="font-black uppercase text-[11px] tracking-widest">
              Accès Dashboard Admin
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
