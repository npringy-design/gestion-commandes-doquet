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
  glow: string;
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
    accent: '#C46B22',
    accentSoft: '#FFF0D2',
    border: '#E7B56F',
    text: '#3C2415',
    glow: '#F8D69E',
  },
  prep: {
    accent: '#5E7A3E',
    accentSoft: '#F2F6E7',
    border: '#BFD19E',
    text: '#273C18',
    glow: '#DFEBC5',
  },
  settings: {
    accent: '#A77A19',
    accentSoft: '#FFF4C6',
    border: '#E1BF5F',
    text: '#3E2B0C',
    glow: '#F7DEA0',
  },
  sales: {
    accent: '#9A7428',
    accentSoft: '#F8EED4',
    border: '#DDBE76',
    text: '#3E2B10',
    glow: '#EED69B',
  },
  finance: {
    accent: '#456B7A',
    accentSoft: '#E7F0F0',
    border: '#B8CED1',
    text: '#203942',
    glow: '#D4E6E7',
  },
  takeRate: {
    accent: '#8F6A2F',
    accentSoft: '#F8ECD6',
    border: '#DDBB82',
    text: '#3F2B16',
    glow: '#EAD0A3',
  },
} satisfies Record<string, TileTone>;

const TileButton: React.FC<HomeTile> = ({ title, subtitle, onClick, icon, tone, primary = false }) => (
  <button
    onClick={onClick}
    className={`group relative flex w-full overflow-hidden rounded-lg border bg-white p-5 text-left shadow-[0_8px_24px_rgba(81,52,24,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(81,52,24,0.14)] ${
      primary ? 'min-h-[148px] lg:col-span-2 lg:min-h-[158px]' : 'min-h-[156px]'
    }`}
    style={{ borderColor: tone.border }}
  >
    <span className="pointer-events-none absolute inset-x-0 top-0 h-2" style={{ backgroundColor: tone.glow }} />
    <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-55 blur-2xl" style={{ backgroundColor: tone.glow }} />

    {primary ? (
      <>
        <span className="relative flex min-w-0 flex-1 items-center gap-5 pr-12">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition group-hover:scale-105"
            style={{ backgroundColor: tone.accent }}
          >
            {icon}
          </span>

          <span className="min-w-0">
            <span className="block whitespace-normal text-[2rem] font-black leading-[1.05] tracking-normal sm:text-[2.25rem]" style={{ color: tone.text }}>
              {title}
            </span>
            <span className="mt-2 block text-[12px] font-black uppercase tracking-[0.11em] text-[#7B675A]">
              {subtitle}
            </span>
          </span>
        </span>

        <span
          className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition group-hover:translate-x-0.5"
          style={{ backgroundColor: tone.accentSoft, color: tone.accent }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </>
    ) : (
      <span className="relative flex min-w-0 flex-1 flex-col justify-between gap-5">
        <span className="flex items-start justify-between gap-3">
          <span
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition group-hover:scale-105"
            style={{ backgroundColor: tone.accent }}
          >
            {icon}
          </span>

          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition group-hover:translate-x-0.5"
            style={{ backgroundColor: tone.accentSoft, color: tone.accent }}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </span>

        <span>
          <span className="block whitespace-normal text-[1.55rem] font-black leading-[1.08] tracking-normal" style={{ color: tone.text }}>
            {title}
          </span>
          <span className="mt-2 block text-[12px] font-black uppercase tracking-[0.11em] text-[#7B675A]">
            {subtitle}
          </span>
        </span>
      </span>
    )}
  </button>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="mb-3 text-[12px] font-black uppercase tracking-[0.18em] text-[#6E4A25]">{children}</h2>
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
            linear-gradient(180deg, rgba(255, 247, 229, 0.94), rgba(247, 225, 188, 0.95)),
            linear-gradient(135deg, #FFF2D2 0%, #F4CE89 100%);
        }

        .home-shell::before {
          content: '';
          position: absolute;
          inset: auto 0 0 0;
          height: 45%;
          pointer-events: none;
          background:
            linear-gradient(165deg, transparent 0%, rgba(198, 119, 35, 0.10) 55%, rgba(255, 220, 151, 0.28) 100%);
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
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#DDAE6A] pb-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#A05E1D]">Accueil</p>
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
              className="inline-flex items-center gap-2 rounded-lg border border-[#C98E46] bg-[#FFF6DC] px-4 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#5D3A1E] shadow-sm transition hover:bg-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Admin
            </button>
          </header>

          <section className="mb-8">
            <SectionTitle>Essentiel</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-4">
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
            <div className="grid gap-4 md:grid-cols-3">
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
