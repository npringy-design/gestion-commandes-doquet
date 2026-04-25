import React, { useEffect, useState } from 'react';
import { View } from '../constants';
import { PasswordModal } from '../components/Modals';
import { useAuth } from '../auth/AuthProvider';
import { canAccessAdminDashboard, canAccessStatsPage } from '../lib/permissions';
import restaurantHero from '../assets/hippopotamus-thillois-home.jpg';

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
  <h2 className="mb-3 text-[12px] font-black uppercase tracking-[0.18em] text-[#FFE0A5]">{children}</h2>
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
      subtitle: 'Préparation',
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
      title: 'Paramètres',
      subtitle: 'Réglages',
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
      title: 'Coût matière',
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

  const quickAccessTiles = showStats
    ? [
        mainTiles[0],
        analysisTiles[1],
        mainTiles[1],
        analysisTiles[0],
        analysisTiles[2],
        mainTiles[2],
      ]
    : [
        mainTiles[0],
        analysisTiles[1],
        mainTiles[1],
        analysisTiles[0],
        analysisTiles[2],
      ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Great+Vibes&family=Manrope:wght@500;700;800;900&display=swap');

        .home-shell {
          background:
            linear-gradient(180deg, rgba(38, 22, 16, 0.98) 0%, rgba(92, 45, 28, 0.96) 48%, rgba(177, 107, 45, 0.92) 100%),
            linear-gradient(135deg, #25140F 0%, #7C3322 48%, #D28B3F 100%);
          font-family: 'Manrope', system-ui, sans-serif;
        }

        .home-shell::before {
          content: '';
          position: absolute;
          inset: auto 0 0 0;
          height: 45%;
          pointer-events: none;
          background:
            linear-gradient(165deg, transparent 0%, rgba(120, 45, 28, 0.18) 50%, rgba(245, 169, 78, 0.26) 100%);
        }

        .restaurant-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          letter-spacing: 0;
        }

        .restaurant-script {
          font-family: 'Great Vibes', 'Cormorant Garamond', Georgia, serif;
          letter-spacing: 0;
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
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={() => {
                if (canOpenAdmin) {
                  setView('admin_dashboard');
                  return;
                }
                setShowPassword(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D99A4A] bg-[#FFF2CF] px-4 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#512A16] shadow-[0_10px_22px_rgba(26,13,8,0.18)] transition hover:bg-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Admin
            </button>
          </div>

          <header className="mb-7 overflow-hidden rounded-lg border border-[#B8793B] bg-[#1F140F] shadow-[0_22px_55px_rgba(65,37,18,0.24)]">
            <div className="relative min-h-[230px]">
              <img
                src={restaurantHero}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#170E0A]/88 via-[#170E0A]/55 to-[#170E0A]/18" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#170E0A]/75 via-transparent to-transparent" />

              <div className="relative z-10 flex min-h-[230px] flex-col justify-end p-5 sm:p-7 lg:p-8">
                <div>
                  <h1 className="restaurant-title max-w-[760px] text-[3.35rem] font-bold leading-[0.9] text-[#FFF6E8] drop-shadow-[0_8px_18px_rgba(0,0,0,0.42)] sm:text-[4.9rem] lg:text-[6rem]">
                    Hippopotamus
                    <span className="restaurant-script mt-2 block text-[4rem] font-normal leading-[0.78] text-[#F6B24A] sm:text-[5.8rem] lg:text-[7.2rem]">Thillois</span>
                  </h1>
                </div>
              </div>
            </div>
          </header>

          <section className="mb-8">
            <SectionTitle>Accès rapides</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-4">
              {quickAccessTiles.map((tile) => (
                <TileButton key={tile.title} {...tile} />
              ))}
            </div>

            {!showStats && canSeeStats ? (
              <p className="mt-3 text-[12px] font-semibold text-[#FFE0A5]">
                Paramètres masqués sur téléphone.
              </p>
            ) : null}
          </section>

        </main>
      </div>
    </>
  );
};

export default HomePage;
