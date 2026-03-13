// =============================================================
// pages/HomePage.tsx
// Page d'accueil principale de l'application
// Extraite de App.tsx
// =============================================================

import React, { useState } from 'react';
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
  const { profile } = useAuth();

  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 1023px)').matches;

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

      {/* Image de fond vache / boeuf */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `url(${homeBgCow})`,
          backgroundSize: 'cover',
          backgroundPosition: isMobile ? '72% center' : '68% center',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(1.12)',
          transform: 'scale(1)',
        }}
      />

      {/* Overlay */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(rgba(26,15,10,0.52), rgba(26,15,10,0.60))',
        }}
      />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-10 py-8 lg:py-12">
        <div className="w-full max-w-[1800px]">
          {/* Titre */}
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

          {/* Boutons principaux */}
          <div
  className={`grid gap-4 lg:gap-6 mb-8 justify-center ${
    !isMobile && canAccessStatsPage(profile)
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2'
  }`}
>
            <button
              onClick={() => setView('suppliers')}
              className="group bg-white p-3 sm:p-4 lg:p-5 rounded-[30px] shadow-2xl hover:scale-105 transition-all border-4 border-transparent hover:border-red-600"
            >
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-red-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-red-600 transition-colors">
                <svg
                  className="w-8 h-8 lg:w-10 lg:h-10 text-red-600 group-hover:text-white"
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
              <span
                className="font-black uppercase text-slate-800 tracking-tighter text-center"
                style={{ fontSize: 'clamp(1.7rem, 2.2vw, 2.6rem)' }}
              >
                Commandes
              </span>
            </button>

            {!isMobile && canAccessStatsPage(profile) && (
              <button
                onClick={() => setView('stats')}
                className="group bg-white p-3 sm:p-4 lg:p-5 rounded-[30px] shadow-2xl transition-all border-4 border-transparent hover:scale-105 hover:border-amber-500"
                title="Paramètres"
              >
                <div className="w-16 h-16 lg:w-20 lg:h-20 bg-amber-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-amber-500 transition-colors">
                  <svg
                    className="w-8 h-8 lg:w-10 lg:h-10 text-amber-600 group-hover:text-white"
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
                <span
                  className="font-black uppercase text-slate-800 tracking-tighter text-center"
                  style={{ fontSize: 'clamp(1.7rem, 2.2vw, 2.6rem)' }}
                >
                  Paramètres
                </span>
              </button>
            )}

            <button
              onClick={() => setView('cost_analysis')}
              className="group bg-white p-3 sm:p-4 lg:p-5 rounded-[30px] shadow-2xl hover:scale-105 transition-all border-4 border-transparent hover:border-orange-600"
            >
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-orange-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-orange-600 transition-colors">
                <svg
                  className="w-8 h-8 lg:w-10 lg:h-10 text-orange-600 group-hover:text-white"
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
              <span
                className="font-black uppercase text-slate-800 tracking-tighter text-center leading-tight"
                style={{ fontSize: 'clamp(1.5rem, 2vw, 2.35rem)' }}
              >
                Analyse
                <br />
                Coût Matière
              </span>
            </button>
          </div>

          {/* Accès admin discret */}
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
