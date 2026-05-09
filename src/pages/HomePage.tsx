import React, { useEffect, useState } from 'react';
import { ACTIVE_SITE_STORAGE_KEY, SITES, View, getDisplaySiteName, getDisplaySiteShortName } from '../constants';
import { PasswordModal } from '../components/Modals';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured as isAuthConfigured } from '../lib/supabaseClient';
import { canAccessAdminDashboard, canAccessStatsPage } from '../lib/permissions';
import restaurantHero from '../assets/hippopotamus-thillois-home.jpg';
import auBureauHero from '../assets/au-bureau-montevrain-home.png';

interface HomePageProps {
  setView: (v: View) => void;
}

type TileTone = {
  accent: string;
  accentSoft: string;
  border: string;
  text: string;
  glow: string;
  surface?: string;
  subtitleText?: string;
  shadow?: string;
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

const auBureauTones = {
  order: {
    accent: '#078892',
    accentSoft: 'rgba(125, 211, 216, 0.14)',
    border: 'rgba(125, 211, 216, 0.35)',
    text: '#F0FDFA',
    glow: 'rgba(125, 211, 216, 0.22)',
    surface: 'linear-gradient(135deg, rgba(6, 31, 40, 0.96), rgba(7, 56, 70, 0.94) 52%, rgba(11, 90, 98, 0.92))',
    subtitleText: '#A7F3F0',
    shadow: '0 16px 34px rgba(2, 18, 24, 0.28)',
  },
  prep: {
    accent: '#0F766E',
    accentSoft: 'rgba(153, 246, 228, 0.13)',
    border: 'rgba(125, 211, 216, 0.30)',
    text: '#E6FFFB',
    glow: 'rgba(20, 184, 166, 0.20)',
    surface: 'linear-gradient(135deg, rgba(6, 31, 40, 0.94), rgba(7, 56, 70, 0.92) 52%, rgba(11, 90, 98, 0.90))',
    subtitleText: '#A7F3F0',
    shadow: '0 16px 34px rgba(2, 18, 24, 0.26)',
  },
  settings: {
    accent: '#0F5D66',
    accentSoft: 'rgba(125, 211, 216, 0.13)',
    border: 'rgba(125, 211, 216, 0.30)',
    text: '#E6FFFB',
    glow: 'rgba(8, 145, 178, 0.19)',
    surface: 'linear-gradient(135deg, rgba(6, 31, 40, 0.94), rgba(7, 56, 70, 0.92) 52%, rgba(11, 90, 98, 0.90))',
    subtitleText: '#A7F3F0',
    shadow: '0 16px 34px rgba(2, 18, 24, 0.26)',
  },
  sales: {
    accent: '#0891B2',
    accentSoft: 'rgba(103, 232, 249, 0.13)',
    border: 'rgba(103, 232, 249, 0.30)',
    text: '#E6FFFB',
    glow: 'rgba(8, 145, 178, 0.20)',
    surface: 'linear-gradient(135deg, rgba(6, 31, 40, 0.94), rgba(7, 56, 70, 0.92) 52%, rgba(11, 90, 98, 0.90))',
    subtitleText: '#A7F3F0',
    shadow: '0 16px 34px rgba(2, 18, 24, 0.26)',
  },
  finance: {
    accent: '#F59E0B',
    accentSoft: 'rgba(245, 158, 11, 0.18)',
    border: 'rgba(251, 191, 36, 0.42)',
    text: '#FFF7ED',
    glow: 'rgba(245, 158, 11, 0.24)',
    surface: 'linear-gradient(135deg, rgba(6, 31, 40, 0.96), rgba(7, 56, 70, 0.94) 50%, rgba(11, 90, 98, 0.90))',
    subtitleText: '#FDE68A',
    shadow: '0 16px 34px rgba(2, 18, 24, 0.30)',
  },
  takeRate: {
    accent: '#14B8A6',
    accentSoft: 'rgba(153, 246, 228, 0.13)',
    border: 'rgba(125, 211, 216, 0.30)',
    text: '#E6FFFB',
    glow: 'rgba(20, 184, 166, 0.20)',
    surface: 'linear-gradient(135deg, rgba(6, 31, 40, 0.94), rgba(7, 56, 70, 0.92) 52%, rgba(11, 90, 98, 0.90))',
    subtitleText: '#A7F3F0',
    shadow: '0 16px 34px rgba(2, 18, 24, 0.26)',
  },
} satisfies Record<string, TileTone>;

const TileButton: React.FC<HomeTile> = ({ title, subtitle, onClick, icon, tone, primary = false }) => (
  <button
    onClick={onClick}
    className={`home-tile group relative flex w-full overflow-hidden rounded-lg border bg-white p-4 text-left shadow-[0_8px_24px_rgba(81,52,24,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(81,52,24,0.14)] sm:p-5 ${
      primary ? 'home-tile-primary lg:col-span-2' : ''
    }`}
    style={{
      borderColor: tone.border,
      background: tone.surface,
      boxShadow: tone.shadow,
    }}
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
            <span className="home-tile-title-primary block whitespace-normal text-[2rem] font-black leading-[1.05] tracking-normal sm:text-[2.25rem]" style={{ color: tone.text }}>
              {title}
            </span>
            <span className="mt-2 block text-[12px] font-black uppercase tracking-[0.11em] text-[#7B675A]" style={{ color: tone.subtitleText }}>
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
          <span className="home-tile-title block whitespace-normal text-[1.55rem] font-black leading-[1.08] tracking-normal" style={{ color: tone.text }}>
            {title}
          </span>
          <span className="mt-2 block text-[12px] font-black uppercase tracking-[0.11em] text-[#7B675A]" style={{ color: tone.subtitleText }}>
            {subtitle}
          </span>
        </span>
      </span>
    )}
  </button>
);

const HomePage: React.FC<HomePageProps> = ({ setView }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { profile, user, signOut, activeSiteId, availableSiteIds } = useAuth();

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
  const activeSite = SITES[activeSiteId] ?? SITES.hippo_thillois;
  const siteDisplayName = getDisplaySiteShortName(activeSite.name);
  const activeSiteHeaderLabel = getDisplaySiteName(activeSite.name);
  const canSwitchSite = availableSiteIds.length > 1;
  const isAuBureauHome = activeSiteId === 'au_bureau_montevrain';
  const homeTones = isAuBureauHome ? auBureauTones : tones;
  const heroImage = isAuBureauHome ? auBureauHero : restaurantHero;
  const heroBrand = isAuBureauHome ? 'Au Bureau' : 'Hippopotamus';
  const heroLocation = isAuBureauHome ? getDisplaySiteName('Montévrain') : siteDisplayName;
  const actionBadgeClass = isAuBureauHome
    ? 'inline-flex items-center gap-2 rounded-lg border border-cyan-100/25 bg-gradient-to-r from-[#061F28]/95 via-[#073846]/95 to-[#0B5A62]/95 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50 shadow-[0_10px_22px_rgba(2,18,24,0.28)] ring-1 ring-white/10 sm:px-4 sm:py-3 sm:text-[12px]'
    : 'inline-flex items-center gap-2 rounded-lg border border-[#D99A4A] bg-[#FFF8E8] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#512A16] shadow-[0_10px_22px_rgba(26,13,8,0.18)] sm:px-4 sm:py-3 sm:text-[12px]';
  const actionButtonClass = isAuBureauHome
    ? 'inline-flex items-center gap-2 rounded-lg border border-cyan-100/25 bg-gradient-to-r from-[#061F28]/95 via-[#073846]/95 to-[#0B5A62]/95 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50 shadow-[0_10px_22px_rgba(2,18,24,0.28)] ring-1 ring-white/10 transition hover:border-cyan-100/45 sm:px-4 sm:py-3 sm:text-[12px]'
    : 'inline-flex items-center gap-2 rounded-lg border border-[#D99A4A] bg-[#FFF2CF] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#512A16] shadow-[0_10px_22px_rgba(26,13,8,0.18)] transition hover:bg-white sm:px-4 sm:py-3 sm:text-[12px]';
  const actionSmallButtonClass = isAuBureauHome
    ? 'rounded-md bg-[#078892] px-2 py-1 text-[9px] text-white sm:text-[10px]'
    : 'rounded-md bg-[#512A16] px-2 py-1 text-[9px] text-white sm:text-[10px]';

  const mainTiles: HomeTile[] = [
    {
      title: 'Commandes',
      subtitle: 'Fournisseurs',
      onClick: () => setView('suppliers'),
      tone: homeTones.order,
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
      tone: homeTones.prep,
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
      tone: homeTones.settings,
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
      tone: homeTones.sales,
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
      tone: homeTones.finance,
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
      tone: homeTones.takeRate,
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

  const handleSignOut = async () => {
    await signOut();
    setView('home');
  };

  const handleSwitchSite = () => {
    if (!canSwitchSite) return;
    try {
      window.sessionStorage.removeItem(ACTIVE_SITE_STORAGE_KEY);
    } catch {
      // ignore
    }
    window.location.reload();
  };

  const pageActions = (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        {canSwitchSite ? (
          <div className={actionBadgeClass}>
            <span>{activeSiteHeaderLabel}</span>
          <button
            type="button"
            onClick={handleSwitchSite}
            className={actionSmallButtonClass}
          >
            Changer
          </button>
          </div>
        ) : null}

      {isAuthConfigured() && user ? (
        <button
          onClick={handleSignOut}
          className={actionButtonClass}
          title="Se déconnecter"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M15.75 9V5.75A2.75 2.75 0 0013 3H6.75A2.75 2.75 0 004 5.75v12.5A2.75 2.75 0 006.75 21H13a2.75 2.75 0 002.75-2.75V15" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 12h8m0 0l-3-3m3 3l-3 3" />
          </svg>
          Déconnexion
        </button>
      ) : null}

      <button
        onClick={() => {
          if (canOpenAdmin) {
            setView('admin_dashboard');
            return;
          }
          setShowPassword(true);
        }}
        className={actionButtonClass}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Admin
      </button>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Great+Vibes&family=Manrope:wght@500;700;800;900&display=swap');

        .home-shell {
          background:
            linear-gradient(180deg, rgba(38, 22, 16, 0.98) 0%, rgba(92, 45, 28, 0.96) 48%, rgba(177, 107, 45, 0.92) 100%),
            linear-gradient(135deg, #25140F 0%, #7C3322 48%, #D28B3F 100%);
          font-family: 'Manrope', system-ui, sans-serif;
          min-height: 100dvh;
        }

        .home-shell-au-bureau {
          background:
            radial-gradient(circle at 18% 0%, rgba(125, 211, 216, 0.16), transparent 32%),
            linear-gradient(180deg, #061F28 0%, #073846 45%, #0B5A62 100%);
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

        .home-shell-au-bureau::before {
          background:
            linear-gradient(165deg, transparent 0%, rgba(8, 145, 178, 0.20) 48%, rgba(20, 184, 166, 0.28) 100%);
        }

        .restaurant-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          letter-spacing: 0;
          font-size: clamp(3.35rem, 7vw, 6rem);
        }

        .restaurant-script {
          font-family: 'Great Vibes', 'Cormorant Garamond', Georgia, serif;
          letter-spacing: 0;
          font-size: clamp(4rem, 8vw, 7.2rem);
        }

        .home-page-frame {
          min-height: 100dvh;
          padding-top: clamp(1rem, 2.5vh, 1.5rem);
          padding-bottom: clamp(0.35rem, 1.2vh, 0.8rem);
        }

        .home-hero {
          min-height: clamp(190px, 28vh, 230px);
        }

        .home-tile {
          min-height: clamp(132px, 18vh, 156px);
        }

        .home-tile-primary {
          min-height: clamp(136px, 19vh, 158px);
        }

        @media (min-width: 1024px) and (max-height: 760px) {
          .home-page-frame {
            padding-top: 1rem;
            padding-bottom: 0.85rem;
          }

          .home-hero {
            min-height: 185px;
          }

          .home-tile {
            min-height: 124px;
          }

          .home-tile-primary {
            min-height: 128px;
          }

          .home-tile-title {
            font-size: 1.35rem;
          }

          .home-tile-title-primary {
            font-size: 1.9rem;
          }
        }

        @media (min-width: 1024px) and (max-height: 840px) {
          .home-page-frame {
            padding-top: 0.75rem;
            padding-bottom: 0.35rem;
          }

          .home-hero {
            min-height: 205px;
          }

          .home-tile {
            min-height: 136px;
          }

          .home-tile-primary {
            min-height: 140px;
          }
        }
      `}</style>

      <div className={`home-shell ${isAuBureauHome ? 'home-shell-au-bureau text-[#062F38]' : 'text-[#2E1B12]'} relative min-h-[100dvh] overflow-x-hidden`}>
        {showPassword && (
          <PasswordModal
            onConfirm={() => {
              setShowPassword(false);
              setView('admin_dashboard');
            }}
            onClose={() => setShowPassword(false)}
          />
        )}

        <main className="home-page-frame relative z-10 mx-auto flex w-full max-w-[1280px] flex-col px-4 sm:px-6 lg:px-8">
          {pageActions}

          <header
            className={`mb-5 overflow-hidden rounded-lg border shadow-[0_22px_55px_rgba(65,37,18,0.24)] ${
              isAuBureauHome
                ? 'border-slate-800/60 bg-[#050914]'
                : 'border-[#B8793B] bg-[#1F140F]'
            }`}
          >
            <div className="home-hero relative">
              <img
                src={heroImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className={`absolute inset-0 ${
                  isAuBureauHome
                    ? 'bg-gradient-to-r from-[#050914]/88 via-[#101B3F]/48 to-[#123847]/12'
                    : 'bg-gradient-to-r from-[#170E0A]/88 via-[#170E0A]/55 to-[#170E0A]/18'
                }`}
              />
              <div
                className={`absolute inset-0 ${
                  isAuBureauHome
                    ? 'bg-gradient-to-t from-[#050914]/70 via-transparent to-transparent'
                    : 'bg-gradient-to-t from-[#170E0A]/75 via-transparent to-transparent'
                }`}
              />

              <div className="home-hero relative z-10 flex flex-col justify-end p-5 sm:p-7 lg:p-8">
                {isAuBureauHome ? (
                  <div className="max-w-[420px]">
                    <div className="mb-3 h-px bg-gradient-to-r from-transparent via-[#F6D675]/80 to-transparent" />
                    <h1 className="font-serif text-[clamp(3rem,6vw,5rem)] font-black uppercase leading-none tracking-[0.08em] text-[#F8E7A4] drop-shadow-[0_8px_18px_rgba(0,0,0,0.48)]">
                      {heroBrand}
                    </h1>
                    <div className="mt-3 h-px bg-gradient-to-r from-transparent via-[#F6D675]/75 to-transparent" />
                    <div className="mt-3 text-center text-[12px] font-black uppercase tracking-[0.42em] text-white/90 sm:text-sm">
                      {heroLocation}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h1 className="restaurant-title max-w-[760px] text-[3.35rem] font-bold leading-[0.9] text-[#FFF6E8] drop-shadow-[0_8px_18px_rgba(0,0,0,0.42)] sm:text-[4.9rem] lg:text-[6rem]">
                      {heroBrand}
                      <span className="restaurant-script mt-2 block text-[4rem] font-normal leading-[0.78] text-[#F6B24A] sm:text-[5.8rem] lg:text-[7.2rem]">
                        {heroLocation}
                      </span>
                    </h1>
                  </div>
                )}
              </div>
            </div>
          </header>

          <section className="mb-0">
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
