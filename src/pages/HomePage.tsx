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
};

const HomeCard: React.FC<HomeCardProps> = ({
  title,
  accent,
  accentSoft,
  onClick,
  children,
}) => {
  return (
    <button
      onClick={onClick}
      className="group relative w-full max-w-[300px] mx-auto rounded-[24px] border border-white/20 bg-[#f5eee6]/92 px-7 py-6 text-left shadow-[0_16px_36px_rgba(0,0,0,0.20)] backdrop-blur-[1px] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(0,0,0,0.26)]"
    >
      <div
        className="absolute inset-x-6 top-0 h-[4px] rounded-b-full opacity-95"
        style={{ backgroundColor: accent }}
      />

      <div className="flex min-h-[168px] flex-col justify-between">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-black/5 shadow-sm"
          style={{ backgroundColor: accentSoft }}
        >
          {children}
        </div>

        <div className="mt-8">
          <h2
            className="whitespace-pre-line break-words font-black uppercase tracking-[-0.05em] text-[#0d2b57] leading-[0.92]"
            style={{ fontSize: 'clamp(1.65rem, 2vw, 2.6rem)' }}
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
          filter: 'brightness(1.02) saturate(1.08)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(69,29,16,0.36) 0%, rgba(46,19,11,0.40) 48%, rgba(28,12,8,0.48) 100%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 18%, rgba(186,107,58,0.18), transparent 32%), radial-gradient(circle at 50% 100%, rgba(128,54,24,0.18), transparent 34%)',
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="w-full max-w-[1720px]">
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
              accent="#ef5350"
              accentSoft="#f8dede"
              onClick={() => setView('suppliers')}
            >
              <svg
                className="h-8 w-8 text-red-600"
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
                accent="#d8a108"
                accentSoft="#f5e9bf"
                onClick={() => setView('stats')}
              >
                <svg
                  className="h-8 w-8 text-amber-600"
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
              title={'Feuille de\nMise en Place'}
              accent="#2cb673"
              accentSoft="#d7f1e4"
              onClick={() => setView('prep_sheet')}
            >
              <svg
                className="h-8 w-8 text-emerald-600"
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
              title={'Analyse\nCoût Matière'}
              accent="#ea7a1f"
              accentSoft="#f8ead7"
              onClick={() => setView('cost_analysis')}
            >
              <svg
                className="h-8 w-8 text-orange-600"
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
