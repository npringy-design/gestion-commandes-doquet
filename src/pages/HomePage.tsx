import React, { useState } from 'react';
import { View } from '../constants';
import { PasswordModal } from '../components/Modals';
import { useAuth } from '../auth/AuthProvider';
import { canAccessAdminDashboard, canAccessStatsPage } from '../lib/permissions';

interface HomePageProps {
  setView: (v: View) => void;
}

type HomeCardProps = {
  title: string;
  subtitle?: string;
  gradient: string;
  onClick: () => void;
  icon: React.ReactNode;
  delay?: number;
};

const HomeCard: React.FC<HomeCardProps> = ({
  title,
  subtitle,
  gradient,
  onClick,
  icon,
  delay = 0,
}) => {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
      style={{
        animation: `fadeInUp 0.8s ease-out ${delay}s both`,
      }}
    >
      {/* Gradient accent bar */}
      <div
        className="absolute left-0 top-0 h-1.5 w-full transition-all duration-500 group-hover:h-2"
        style={{ background: gradient }}
      />

      {/* Icon container */}
      <div className="mb-6 flex items-start justify-between">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3"
          style={{
            background: `linear-gradient(135deg, ${gradient})`,
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
          }}
        >
          <div className="text-white">{icon}</div>
        </div>

        {/* Arrow indicator */}
        <div className="opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
          <svg
            className="h-6 w-6 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2 text-left">
        <h3 className="text-2xl font-bold text-slate-900 transition-colors duration-300 group-hover:text-slate-700">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm font-medium text-slate-500">{subtitle}</p>
        )}
      </div>

      {/* Hover overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-5"
        style={{ background: gradient }}
      />
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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600&display=swap');

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes gradientShift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        .hero-title {
          font-family: 'Poppins', sans-serif;
          background: linear-gradient(135deg, #1e293b 0%, #475569 50%, #1e293b 100%);
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .accent-line {
          background: linear-gradient(90deg, 
            transparent 0%, 
            #3b82f6 25%, 
            #8b5cf6 50%, 
            #ec4899 75%, 
            transparent 100%
          );
          background-size: 200% 100%;
          animation: gradientShift 3s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        {showPassword && (
          <PasswordModal
            onConfirm={() => {
              setShowPassword(false);
              setView('admin_dashboard');
            }}
            onClose={() => setShowPassword(false)}
          />
        )}

        {/* Decorative background elements */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl"
            style={{ animation: 'float 15s ease-in-out infinite' }}
          />
          <div
            className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-400/10 blur-3xl"
            style={{ animation: 'float 20s ease-in-out infinite reverse' }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
          {/* Header */}
          <div className="mb-16 text-center" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
            <div className="mb-6 flex items-center justify-center gap-3">
              <div className="h-1 w-12 rounded-full bg-gradient-to-r from-transparent to-blue-500" />
              <span className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                Plateforme de gestion
              </span>
              <div className="h-1 w-12 rounded-full bg-gradient-to-l from-transparent to-purple-500" />
            </div>

            <h1 className="hero-title mb-6 text-6xl font-black uppercase leading-tight tracking-tight sm:text-7xl lg:text-8xl">
              Hippo
              <br />
              <span className="text-5xl sm:text-6xl lg:text-7xl">Commandes</span>
            </h1>

            <div className="accent-line mx-auto h-1.5 w-32 rounded-full" />

            <p className="mx-auto mt-6 max-w-2xl text-lg font-medium text-slate-600">
              Gérez vos opérations en toute simplicité avec notre suite d'outils professionnels
            </p>
          </div>

          {/* Cards Grid */}
          <div
            className={`grid gap-6 ${
              showStats
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }`}
          >
            <HomeCard
              title="Commandes"
              subtitle="Gestion des commandes"
              gradient="linear-gradient(135deg, #3b82f6, #2563eb)"
              onClick={() => setView('suppliers')}
              delay={0.1}
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 10H4L5 9z"
                  />
                </svg>
              }
            />

            {showStats && (
              <HomeCard
                title="Paramètres"
                subtitle="Configuration système"
                gradient="linear-gradient(135deg, #f59e0b, #d97706)"
                onClick={() => setView('stats')}
                delay={0.2}
                icon={
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                }
              />
            )}

            <HomeCard
              title="Mix Produit"
              subtitle="Analyse des ventes"
              gradient="linear-gradient(135deg, #8b5cf6, #7c3aed)"
              onClick={() => setView('product_mix')}
              delay={showStats ? 0.3 : 0.2}
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                  />
                </svg>
              }
            />

            <HomeCard
              title="Mise en Place"
              subtitle="Feuille de préparation"
              gradient="linear-gradient(135deg, #ec4899, #db2777)"
              onClick={() => setView('prep_sheet')}
              delay={showStats ? 0.4 : 0.3}
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
            />

            <HomeCard
              title="Coût Matière"
              subtitle="Analyse des coûts"
              gradient="linear-gradient(135deg, #10b981, #059669)"
              onClick={() => setView('cost_analysis')}
              delay={showStats ? 0.5 : 0.4}
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              }
            />

            <HomeCard
              title="Taux de Prise"
              subtitle="Suivi des performances"
              gradient="linear-gradient(135deg, #06b6d4, #0891b2)"
              onClick={() => setView('take_rate_sheet')}
              delay={showStats ? 0.6 : 0.5}
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              }
            />
          </div>

          {/* Admin Access */}
          <div className="mt-16 text-center" style={{ animation: 'fadeInUp 1s ease-out 0.8s both' }}>
            <button
              onClick={() => {
                if (canAccessAdminDashboard(profile)) {
                  setView('admin_dashboard');
                  return;
                }
                setShowPassword(true);
              }}
              className="group inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md"
            >
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span className="uppercase tracking-wider">Dashboard Admin</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;
