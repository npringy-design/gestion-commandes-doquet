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
  onClick: () => void;
  icon: React.ReactNode;
};

const HomeCard: React.FC<HomeCardProps> = ({
  title,
  accent,
  accent2,
  shadow,
  onClick,
  icon,
}) => {
  return (
    <button
      onClick={onClick}
      className="group relative mx-auto w-full max-w-[350px]"
    >
      <div
        className="absolute inset-0 translate-x-[10px] translate-y-[10px] rounded-[26px] border border-black/20"
        style={{
          background: 'linear-gradient(180deg, rgba(58,45,38,0.82) 0%, rgba(88,70,58,0.72) 100%)',
          boxShadow: '0 16px 28px rgba(0,0,0,0.28)',
        }}
      />

      <div
        className="relative overflow-hidden rounded-[26px] border border-white/22 px-7 py-7"
        style={{
          background: `linear-gradient(180deg, ${accent} 0%, ${accent2} 58%, ${shadow} 100%)`,
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(70,40,25,0.18), 0 10px 24px rgba(48,22,12,0.22)',
        }}
      >
        <div className="absolute inset-x-6 top-0 h-[4px] rounded-b-full bg-white/55" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.03)_35%,rgba(0,0,0,0.06)_100%)]" />

        <div className="relative flex min-h-[148px] flex-col items-center justify-center gap-5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            {icon}
          </div>

          <h2
            className="whitespace-pre-line text-center font-black uppercase leading-[0.94] tracking-[-0.04em] text-[#0d2b57]"
            style={{ fontSize: 'clamp(1.55rem, 2vw, 2.55rem)' }}
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
            'linear-gradient(180deg, rgba(78,34,18,0.20) 0%, rgba(50,20,11,0.18) 45%, rgba(31,13,8,0.28) 100%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 18%, rgba(204,128,74,0.16), transparent 32%), radial-gradient(circle at 50% 100%, rgba(137,70,38,0.16), transparent 34%)',
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
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            <HomeCard
              title="Commandes"
              accent="#f7b0aa"
              accent2="#e77268"
              shadow="#be4138"
              onClick={() => setView('suppliers')}
              icon={
                <svg className="h-5 w-5 text-[#b42d24]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 10H4L5 9z" />
                </svg>
              }
            />

            {showStats && (
              <HomeCard
                title="Paramètres"
                accent="#f8e08b"
                accent2="#ddb138"
                shadow="#b98414"
                onClick={() => setView('stats')}
                icon={
                  <svg className="h-5 w-5 text-[#a06b08]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M7 5v14M12 5v14M17 5v14" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 8h4M10 15h4M15 10h4" />
                  </svg>
                }
              />
            )}

            <HomeCard
              title={'Feuille de\nMise en Place'}
              accent="#f2c294"
              accent2="#d88b53"
              shadow="#b56632"
              onClick={() => setView('prep_sheet')}
              icon={
                <svg className="h-5 w-5 text-[#a85626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="7" y="4" width="10" height="16" rx="2" strokeWidth="2.2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M10 9h4M10 13h4" />
                </svg>
              }
            />

            <HomeCard
              title={'Analyse\nCoût Matière'}
              accent="#f4d28a"
              accent2="#d79a35"
              shadow="#b87518"
              onClick={() => setView('cost_analysis')}
              icon={
                <svg className="h-5 w-5 text-[#a96a11]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 18h14" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M7 16V9M12 16V6M17 16V11" />
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
