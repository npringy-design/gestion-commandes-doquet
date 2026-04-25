import React, { useEffect, useState } from 'react';
import { View } from '../constants';
import { PasswordModal } from '../components/Modals';
import { useAuth } from '../auth/AuthProvider';
import { canAccessAdminDashboard, canAccessStatsPage } from '../lib/permissions';

interface HomePageProps {
  setView: (v: View) => void;
}

type TileTone = {
  accent: string;
  accentSoft: string;
  border: string;
  text: string;
};

type HomeTile = {
  title: string;
  subtitle: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone: TileTone;
  primary?: boolean;
};

const tones = {
  order: {
    accent: '#B85E2B',
    accentSoft: '#FFF0D8',
    border: '#E7BE83',
    text: '#4A2A16',
  },
  prep: {
    accent: '#55724B',
    accentSoft: '#EEF3E6',
    border: '#C9D7BC',
    text: '#253F21',
  },
  settings: {
    accent: '#8B6B21',
    accentSoft: '#FFF4C9',
    border: '#E6CC7A',
    text: '#4B3810',
  },
  sales: {
    accent: '#A14F43',
    accentSoft: '#F8E7E1',
    border: '#E1B8AD',
    text: '#4F211B',
  },
  finance: {
    accent: '#516E86',
    accentSoft: '#E8F0F4',
    border: '#BFD0DA',
    text: '#243A49',
  },
  takeRate: {
    accent: '#8C6B38',
    accentSoft: '#F7EBD8',
    border: '#DEC095',
    text: '#4D3319',
  },
} satisfies Record<string, TileTone>;

const TileButton: React.FC<HomeTile> = ({ title, subtitle, onClick, icon, tone, primary = false }) => (
  <button
    onClick={onClick}
    className={`group flex min-h-[118px] w-full items-center gap-4 rounded-lg border bg-white/90 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg ${
      primary ? 'lg:col-span-2 lg:min-h-[150px]' : ''
    }`}
    style={{ borderColor: tone.border }}
  >
    <span
      className={`${primary ? 'h-16 w-16' : 'h-12 w-12'} flex shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition group-hover:scale-105`}
      style={{ backgroundColor: tone.accent }}
    >
      {icon}
    </span>

    <span className="min-w-0 flex-1">
      <span
        className={`${primary ? 'text-[2rem]' : 'text-[1.45rem]'} block truncate font-black leading-tight tracking-normal`}
        style={{ color: tone.text }}
      >
        {title}
      </span>
      <span className="mt-1 block truncate text-[13px] font-bold uppercase tracking-[0.08em] text-[#7B675A]">
        {subtitle}
      </span>
    </span>

    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition group-hover:translate-x-0.5"
      style={{ backgroundColor: tone.accentSoft, color: tone.accent }}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
      </svg>
    </span>
  </button>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="mb-3 text-[12px] font-black uppercase tracking-[0.18em] text-[#7C5A3A]">{children}</h2>
);

const HomePage: React.FC<HomePageProps> = ({ setView }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(max-width: 1023px)');
    const updateMobile = () => setIsMobile(media.matches);
    updateMobile();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updateMobile);
      return () => media.removeEventListener('change', updateMobile);
    }

    media.addListener(updateMobile);
    return () => media.removeListener(updateMobile);
  }, []);

  const canSeeStats = canAccessStatsPage(profile);
  const canOpenAdmin = canAccessAdminDashboard(profile);
  const showStats = !isMobile && canSeeStats;

  const mainTiles: HomeTile[] = [
    {
      title: 'Commandes',
      subtitle: 'Fournisseurs',
      onClick: () => setView('suppliers'),
      tone: tones.order,
      primary: true,
      icon: (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 10H4L5 9z" />
        </svg>
      ),
    },
    {
      title: 'Mise en place',
      subtitle: 'Preparation',
      onClick: () => setView('prep_sheet'),
      tone: tones.prep,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L19 11.5V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  if (showStats) {
    mainTiles.push({
      title: 'Parametres',
      subtitle: 'Reglages',
      onClick: () => setView('stats'),
      tone: tones.settings,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19.4 15a1.8 1.8 0 00.36 1.98l.04.04a2.15 2.15 0 01-3.04 3.04l-.04-.04A1.8 1.8 0 0014.75 19a1.8 1.8 0 00-1.65 1.1 2.15 2.15 0 01-4.2 0A1.8 1.8 0 007.25 19a1.8 1.8 0 00-1.98.36l-.04.04a2.15 2.15 0 01-3.04-3.04l.04-.04A1.8 1.8 0 003 14.75a1.8 1.8 0 00-1.1-1.65 2.15 2.15 0 010-4.2A1.8 1.8 0 003 7.25a1.8 1.8 0 00-.36-1.98l-.04-.04A2.15 2.15 0 015.64 2.2l.04.04A1.8 1.8 0 007.25 3a1.8 1.8 0 001.65-1.1 2.15 2.15 0 014.2 0A1.8 1.8 0 0014.75 3a1.8 1.8 0 001.98-.36l.04-.04a2.15 2.15 0 013.04 3.04l-.04.04A1.8 1.8 0 0019 7.25a1.8 1.8 0 001.1 1.65 2.15 2.15 0 010 4.2A1.8 1.8 0 0019.4 15z" />
        </svg>
      ),
    });
  }

  const analysisTiles: HomeTile[] = [
    {
      title: 'Mix produit',
      subtitle: 'Ventes',
      onClick: () => setView('product_mix'),
      tone: tones.sales,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M11 3.05A9 9 0 1020.95 13H11V3.05z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M20.5 9H15V3.5A9 9 0 0120.5 9z" />
        </svg>
      ),
    },
    {
      title: 'Cout matiere',
      subtitle: 'Marge',
      onClick: () => setView('cost_analysis'),
      tone: tones.finance,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M4 19V9m5 10V5m5 14v-7m5 7V8" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M3 19h18" />
        </svg>
      ),
    },
    {
      title: 'Taux de prise',
      subtitle: 'Suivi',
      onClick: () => setView('take_rate_sheet'),
      tone: tones.takeRate,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M4 17l6-6 4 4 6-8" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M15 7h5v5" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <style>{`
        .home-shell {
          background:
            linear-gradient(180deg, rgba(255, 248, 236, 0.94), rgba(245, 226, 199, 0.94)),
            linear-gradient(135deg, #F7E6CA 0%, #F3D39D 100%);
        }

        .home-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(116, 82, 45, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(116, 82, 45, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}</style>

      <div className="home-shell relative min-h-screen overflow-hidden text-[#2E1B12]">
        {showPassword && (
          <PasswordModal
            onConfirm={() => {
              setShowPassword(false);
              setView('admin_dashboard');
            }}
            onClose={() => setShowPassword(false)}
          />
        )}

        <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1280px] flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#E4C391] pb-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#A3682E]">Accueil</p>
              <h1 className="text-[2rem] font-black leading-tight tracking-normal text-[#2E1B12] sm:text-[2.55rem]">
                Hippo Commandes
              </h1>
            </div>

            <button
              onClick={() => {
                if (canOpenAdmin) {
                  setView('admin_dashboard');
                  return;
                }
                setShowPassword(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D3A973] bg-[#FFF8EA] px-4 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#5D3A1E] shadow-sm transition hover:bg-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Admin
            </button>
          </header>

          <section className="mb-7">
            <SectionTitle>Essentiel</SectionTitle>
            <div className="grid gap-3 lg:grid-cols-4">
              {mainTiles.map((tile) => (
                <TileButton key={tile.title} {...tile} />
              ))}
            </div>

            {!showStats && canSeeStats ? (
              <p className="mt-3 text-[12px] font-semibold text-[#7D604B]">
                Parametres masques sur telephone.
              </p>
            ) : null}
          </section>

          <section>
            <SectionTitle>Pilotage</SectionTitle>
            <div className="grid gap-3 md:grid-cols-3">
              {analysisTiles.map((tile) => (
                <TileButton key={tile.title} {...tile} />
              ))}
            </div>
          </section>
        </main>
      </div>
    </>
  );
};

export default HomePage;
