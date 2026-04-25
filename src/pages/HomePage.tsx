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
  onClick: () => void;
  icon: React.ReactNode;
  delay?: number;
};

const HomeCard: React.FC<HomeCardProps> = ({
  title,
  subtitle,
  onClick,
  icon,
  delay = 0,
}) => {
  return (
    <button
      onClick={onClick}
      className="menu-card group relative overflow-hidden rounded-lg transition-all duration-500 hover:scale-[1.03]"
      style={{
        animation: `slideInUp 0.7s ease-out ${delay}s both`,
      }}
    >
      {/* Leather texture background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2a1810] via-[#1f120c] to-[#150a06]" />
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
      />

      {/* Border glow effect */}
      <div className="absolute inset-0 border-2 border-[#d97742]/20 transition-all duration-500 group-hover:border-[#d97742]/60 group-hover:shadow-[0_0_20px_rgba(217,119,66,0.3)]" />

      {/* Top accent bar */}
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-[#d97742] to-transparent opacity-60" />

      <div className="relative px-6 py-8">
        {/* Icon */}
        <div className="mb-6 flex items-center justify-between">
          <div 
            className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97742] to-[#a03939] shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-[0_8px_24px_rgba(217,119,66,0.4)]"
          >
            <div className="text-white">{icon}</div>
          </div>

          {/* Arrow */}
          <div className="translate-x-0 opacity-0 transition-all duration-300 group-hover:translate-x-2 group-hover:opacity-100">
            <svg className="h-6 w-6 text-[#d97742]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-2 font-display text-2xl font-bold uppercase tracking-wide text-[#ffa500] transition-colors duration-300 group-hover:text-[#ff8c00]">
          {title}
        </h3>
        
        {subtitle && (
          <p className="font-body text-sm font-medium text-[#d4a574]/80">
            {subtitle}
          </p>
        )}

        {/* Bottom decorative line */}
        <div className="mt-6 h-px w-12 bg-gradient-to-r from-[#d97742] to-transparent transition-all duration-500 group-hover:w-full" />
      </div>

      {/* Shine effect on hover */}
      <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
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
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:wght@400;500;600;700;800;900&family=Lato:wght@400;700;900&display=swap');

        .font-display {
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 0.08em;
        }

        .font-accent {
          font-family: 'Playfair Display', serif;
        }

        .font-body {
          font-family: 'Lato', sans-serif;
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.92; }
        }

        @keyframes ember {
          0%, 100% {
            text-shadow: 
              0 0 10px rgba(255, 165, 0, 0.8),
              0 0 20px rgba(255, 140, 0, 0.6),
              0 0 30px rgba(217, 119, 66, 0.4);
          }
          50% {
            text-shadow: 
              0 0 15px rgba(255, 165, 0, 1),
              0 0 25px rgba(255, 140, 0, 0.8),
              0 0 35px rgba(217, 119, 66, 0.6);
          }
        }

        .ember-glow {
          animation: ember 3s ease-in-out infinite;
        }

        .wood-grain {
          background-image: 
            repeating-linear-gradient(
              90deg,
              rgba(212, 165, 116, 0.03) 0px,
              rgba(212, 165, 116, 0.03) 2px,
              transparent 2px,
              transparent 4px
            ),
            repeating-linear-gradient(
              0deg,
              rgba(184, 144, 109, 0.02) 0px,
              rgba(184, 144, 109, 0.02) 8px,
              transparent 8px,
              transparent 12px
            );
        }

        .menu-card {
          box-shadow: 
            0 4px 6px rgba(0, 0, 0, 0.4),
            0 8px 15px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .menu-card:hover {
          box-shadow: 
            0 8px 12px rgba(0, 0, 0, 0.5),
            0 16px 30px rgba(0, 0, 0, 0.4),
            0 0 40px rgba(217, 119, 66, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .brick-pattern {
          background-image: 
            linear-gradient(rgba(139, 46, 46, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 46, 46, 0.1) 1px, transparent 1px);
          background-size: 60px 30px;
        }
      `}</style>

      <div className="wood-grain brick-pattern relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0f0a08] via-[#1a1410] to-[#0f0a08]">
        {showPassword && (
          <PasswordModal
            onConfirm={() => {
              setShowPassword(false);
              setView('admin_dashboard');
            }}
            onClose={() => setShowPassword(false)}
          />
        )}

        {/* Ambient lighting effects */}
        <div className="pointer-events-none fixed inset-0">
          {/* Warm top light */}
          <div 
            className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[#d97742] opacity-10 blur-3xl"
            style={{ animation: 'flicker 4s ease-in-out infinite' }}
          />
          
          {/* Corner embers */}
          <div className="absolute left-0 top-1/4 h-64 w-64 rounded-full bg-[#a03939] opacity-5 blur-3xl" />
          <div className="absolute bottom-1/4 right-0 h-64 w-64 rounded-full bg-[#ff8c00] opacity-5 blur-3xl" />
        </div>

        {/* Metal beam decorations */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-2 bg-gradient-to-r from-transparent via-[#1a1410] to-transparent opacity-60" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-[#1a1410] to-transparent opacity-60" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          {/* Header */}
          <div className="mb-16 text-center" style={{ animation: 'slideInUp 0.6s ease-out' }}>
            {/* Top ornament */}
            <div className="mb-8 flex items-center justify-center gap-4">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#d97742]" />
              <svg className="h-6 w-6 text-[#d97742]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#d97742]" />
            </div>

            {/* Main title */}
            <div className="relative mb-8">
              <h1 className="ember-glow font-display text-7xl font-black uppercase tracking-wider text-[#ffa500] sm:text-8xl lg:text-9xl">
                Hippo
              </h1>
              <h2 className="font-accent mt-2 text-4xl font-bold italic text-[#d4a574] sm:text-5xl lg:text-6xl">
                Commandes
              </h2>
            </div>

            {/* Decorative separator */}
            <div className="relative mx-auto h-1 w-48">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#d97742] to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#ffa500] to-transparent opacity-50 blur-sm" />
            </div>

            {/* Subtitle */}
            <p className="font-body mx-auto mt-8 max-w-2xl text-lg font-medium text-[#d4a574]/90">
              Plateforme de gestion professionnelle pour votre établissement
            </p>
          </div>

          {/* Cards Grid */}
          <div
            className={`grid gap-6 ${
              showStats
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }`}
          >
            <HomeCard
              title="Commandes"
              subtitle="Gestion des commandes"
              onClick={() => setView('suppliers')}
              delay={0.1}
              icon={
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 10H4L5 9z" />
                </svg>
              }
            />

            {showStats && (
              <HomeCard
                title="Paramètres"
                subtitle="Configuration"
                onClick={() => setView('stats')}
                delay={0.2}
                icon={
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
            )}

            <HomeCard
              title="Mix Produit"
              subtitle="Analyse des ventes"
              onClick={() => setView('product_mix')}
              delay={showStats ? 0.3 : 0.2}
              icon={
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              }
            />

            <HomeCard
              title="Mise en Place"
              subtitle="Préparation"
              onClick={() => setView('prep_sheet')}
              delay={showStats ? 0.4 : 0.3}
              icon={
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />

            <HomeCard
              title="Coût Matière"
              subtitle="Analyse financière"
              onClick={() => setView('cost_analysis')}
              delay={showStats ? 0.5 : 0.4}
              icon={
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />

            <HomeCard
              title="Taux de Prise"
              subtitle="Performance"
              onClick={() => setView('take_rate_sheet')}
              delay={showStats ? 0.6 : 0.5}
              icon={
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            />
          </div>

          {/* Admin Access */}
          <div className="mt-20 text-center" style={{ animation: 'slideInUp 1s ease-out 0.8s both' }}>
            <button
              onClick={() => {
                if (canAccessAdminDashboard(profile)) {
                  setView('admin_dashboard');
                  return;
                }
                setShowPassword(true);
              }}
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-lg border border-[#d97742]/30 bg-gradient-to-r from-[#1a1410] to-[#2a1810] px-8 py-4 transition-all duration-300 hover:border-[#d97742]/60 hover:shadow-[0_0_20px_rgba(217,119,66,0.3)]"
            >
              <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-[#d97742]/10 to-transparent transition-transform duration-500 group-hover:translate-x-[100%]" />
              
              <svg className="relative h-5 w-5 text-[#d97742] transition-transform duration-300 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              
              <span className="font-display relative text-sm font-bold uppercase tracking-widest text-[#d4a574] transition-colors duration-300 group-hover:text-[#ffa500]">
                Dashboard Admin
              </span>
            </button>
          </div>

          {/* Bottom decorative element */}
          <div className="mt-16 flex items-center justify-center gap-4 opacity-30">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#d97742]" />
            <svg className="h-4 w-4 text-[#d97742]" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
            </svg>
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#d97742]" />
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;
