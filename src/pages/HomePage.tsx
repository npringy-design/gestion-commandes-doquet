// =============================================================
// pages/HomePage.tsx
// Page d'accueil principale de l'application
// Extraite de App.tsx
// =============================================================

import React, { useMemo, useState } from 'react';
import { View } from '../constants';
import { PasswordModal } from '../components/Modals';
import { useAuth } from '../auth/AuthProvider';
import { canAccessAdminDashboard, canAccessStatsPage } from '../lib/permissions';
import homeBgCow from '../assets/supplier-visuals/home-bg-cow.jpg';

interface HomePageProps {
  setView: (v: View) => void;
}

const HomePage: React.FC<HomePageProps> = ({ setView }) => {
  const [showPassword, setShowPassword] = useState(false);
  const { profile, allowedSites, activeSiteId, setActiveSiteId } = useAuth();

  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 1023px)').matches;

  const selectedSiteName = useMemo(() => {
    return allowedSites.find((site) => site.id === activeSiteId)?.name ?? 'Hippo Thillois';
  }, [allowedSites, activeSiteId]);

  const siteTitle = useMemo(() => {
    const trimmed = (selectedSiteName ?? 'Hippo Thillois').trim();
    if (!trimmed) {
      return { prefix: 'Hippo', suffix: 'Thillois' };
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return { prefix: parts[0], suffix: '' };
    }

    return {
      prefix: parts[0],
      suffix: parts.slice(1).join(' '),
    };
  }, [selectedSiteName]);

  return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
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
          backgroundPosition: isMobile ? '60% center' : '75% 35%',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(1.20)',
          transform: 'scale(1)',
        }}
      />

      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(rgba(26,15,10,0.58), rgba(26,15,10,0.58))',
        }}
      />

      {allowedSites.length > 0 && (
        <div className="hidden xl:block absolute left-4 top-6 z-10 w-72">
          <div className="rounded-[32px] border border-white/15 bg-black/35 backdrop-blur-md shadow-2xl p-4 text-left">
            <div className="space-y-3">
              {allowedSites.map((site) => {
                const isActive = site.id === activeSiteId;

                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => setActiveSiteId(site.id)}
                    className={`w-full text-left rounded-2xl border px-4 py-4 transition-all hover:scale-[1.01] ${
                      isActive
                        ? 'border-[#ffd700] bg-[#ffd700]/15 text-white shadow-lg'
                        : 'border-white/10 bg-white/5 text-white/85 hover:border-white/25 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-[1.65rem] leading-tight font-black tracking-tight">{site.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="z-10 text-center w-full max-w-6xl px-2 xl:pl-80">
        {allowedSites.length > 1 && (
          <div className="xl:hidden mb-6 max-w-md mx-auto rounded-[28px] border border-white/15 bg-black/30 backdrop-blur-md px-4 py-4">
            <div className="flex flex-wrap justify-center gap-2">
              {allowedSites.map((site) => {
                const isActive = site.id === activeSiteId;
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => setActiveSiteId(site.id)}
                    className={`rounded-full border px-3 py-2 text-sm font-bold transition-colors ${
                      isActive
                        ? 'border-[#ffd700] bg-[#ffd700]/15 text-white'
                        : 'border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10'
                    }`}
                  >
                    {site.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-12">
          <div className="leading-none drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
            <div className="text-[#ffd700] text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight">
              {siteTitle.prefix}
            </div>
            {siteTitle.suffix && (
              <div className="text-white text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight mt-1 sm:mt-2">
                {siteTitle.suffix}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          <button
            onClick={() => setView('suppliers')}
            className="group bg-white p-4 sm:p-6 lg:p-8 rounded-[40px] shadow-2xl hover:scale-105 transition-all border-4 border-transparent hover:border-red-600"
          >
            <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-red-600 transition-colors">
              <svg
                className="w-8 h-8 text-red-600 group-hover:text-white"
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
            </div>
            <span className="text-2xl font-black uppercase text-slate-800 tracking-tighter">
              Commandes
            </span>
          </button>

          {!isMobile && canAccessStatsPage(profile) && (
            <button
              onClick={() => setView('stats')}
              className="group bg-white p-4 sm:p-6 lg:p-8 rounded-[40px] shadow-2xl transition-all border-4 border-transparent hover:scale-105 hover:border-amber-500"
              title="Paramètres"
            >
              <div className="w-16 h-16 bg-amber-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-amber-500 transition-colors">
                <svg
                  className="w-8 h-8 text-amber-600 group-hover:text-white"
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
              </div>
              <span className="text-2xl font-black uppercase text-slate-800 tracking-tighter">
                Paramètres
              </span>
            </button>
          )}

          <button
            onClick={() => setView('cost_analysis')}
            className="group bg-white p-4 sm:p-6 lg:p-8 rounded-[40px] shadow-2xl hover:scale-105 transition-all border-4 border-transparent hover:border-orange-600"
          >
            <div className="w-16 h-16 bg-orange-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-orange-600 transition-colors">
              <svg
                className="w-8 h-8 text-orange-600 group-hover:text-white"
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
            </div>
            <span className="text-2xl font-black uppercase text-slate-800 tracking-tighter">
              Analyse
              <br />
              Coût Matière
            </span>
          </button>
        </div>

        <button
          onClick={() => {
            if (canAccessAdminDashboard(profile)) {
              setView('admin_dashboard');
              return;
            }
            setShowPassword(true);
          }}
          className="flex items-center gap-4 mx-auto text-white/20 hover:text-[#ffd700] transition-colors"
        >
          <span className="font-black uppercase text-[11px] tracking-widest">
            Accès Dashboard Admin
          </span>
        </button>
      </div>
    </div>
  );
};

export default HomePage;
