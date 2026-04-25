import React, { useEffect, useState } from 'react';
import { View } from '../constants';
import { PasswordModal } from '../components/Modals';
import { useAuth } from '../auth/AuthProvider';
import { canAccessAdminDashboard, canAccessStatsPage } from '../lib/permissions';

interface HomePageProps {
  setView: (v: View) => void;
}

type ModuleTone = {
  accent: string;
  accentDeep: string;
  border: string;
  tint: string;
  shadow: string;
};

type ModuleCardProps = {
  title: string;
  subtitle: string;
  description: string;
  label: string;
  cta: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone: ModuleTone;
  delay?: number;
  featured?: boolean;
};

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

const tones = {
  amber: {
    accent: '#B86A2D',
    accentDeep: '#7E431E',
    border: '#E7C990',
    tint: '#F6E6CD',
    shadow: 'rgba(184, 106, 45, 0.22)',
  },
  honey: {
    accent: '#C3892A',
    accentDeep: '#8B5C16',
    border: '#E7CF98',
    tint: '#F7EBCF',
    shadow: 'rgba(195, 137, 42, 0.20)',
  },
  copper: {
    accent: '#B85B3A',
    accentDeep: '#7A301A',
    border: '#E8C1AD',
    tint: '#F5DED2',
    shadow: 'rgba(184, 91, 58, 0.20)',
  },
  bronze: {
    accent: '#9A6437',
    accentDeep: '#653B1B',
    border: '#DFC0A3',
    tint: '#F2E1D3',
    shadow: 'rgba(154, 100, 55, 0.18)',
  },
} satisfies Record<string, ModuleTone>;

const HomeModuleCard: React.FC<ModuleCardProps> = ({
  title,
  subtitle,
  description,
  label,
  cta,
  onClick,
  icon,
  tone,
  delay = 0,
  featured = false,
}) => {
  return (
    <button
      onClick={onClick}
      className={`group relative flex h-full flex-col overflow-hidden rounded-[30px] border px-6 py-6 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(84,52,24,0.16)] ${
        featured ? 'lg:col-span-2 lg:min-h-[280px]' : 'min-h-[230px]'
      }`}
      style={{
        animation: `riseIn 0.6s ease-out ${delay}s both`,
        borderColor: tone.border,
        background: `linear-gradient(165deg, #FFF9F0 0%, ${tone.tint} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(circle at top right, ${tone.tint} 0%, transparent 52%)`,
        }}
      />
      <div
        className="pointer-events-none absolute left-6 right-6 top-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${tone.accent} 50%, transparent 100%)`,
        }}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <span
              className="inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.24em]"
              style={{
                color: tone.accent,
                backgroundColor: 'rgba(255, 248, 236, 0.95)',
              }}
            >
              {label}
            </span>

            <div
              className="flex h-14 w-14 items-center justify-center rounded-[18px] text-white shadow-[0_18px_32px_rgba(84,52,24,0.18)] transition-transform duration-300 group-hover:scale-105"
              style={{
                background: `linear-gradient(145deg, ${tone.accent} 0%, ${tone.accentDeep} 100%)`,
                boxShadow: `0 18px 34px ${tone.shadow}`,
              }}
            >
              {icon}
            </div>
          </div>

          <div
            className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-1"
            style={{
              color: tone.accent,
              backgroundColor: 'rgba(255, 247, 226, 0.92)',
            }}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <div className="mt-8 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: tone.accent }}>
            {subtitle}
          </p>
          <h3 className={`mt-2 text-[#2C1B14] ${featured ? 'text-3xl sm:text-[2.15rem]' : 'text-[1.75rem]'} font-extrabold leading-tight`}>
            {title}
          </h3>
          <p className="mt-4 max-w-[34rem] text-[15px] leading-7 text-[#6B5447]">{description}</p>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#4C392E]">{cta}</span>
          <div
            className="h-px flex-1"
            style={{
              background: `linear-gradient(90deg, ${tone.accent} 0%, transparent 100%)`,
            }}
          />
        </div>
      </div>
    </button>
  );
};

const SectionHeading: React.FC<SectionHeadingProps> = ({ eyebrow, title, description }) => (
  <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#B3773D]">{eyebrow}</p>
      <h2 className="home-serif mt-2 text-[2rem] font-semibold leading-none text-[#2C1B14] sm:text-[2.4rem]">
        {title}
      </h2>
    </div>
    <p className="max-w-[38rem] text-[15px] leading-7 text-[#6B5447]">{description}</p>
  </div>
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

  const operationalModules: ModuleCardProps[] = [
    {
      title: 'Commandes',
      subtitle: 'Flux quotidien',
      description:
        'Accedez rapidement a la gestion des commandes fournisseurs avec un point d entree clair et immediat pour l equipe.',
      label: 'Essentiel',
      cta: 'Ouvrir le module',
      onClick: () => setView('suppliers'),
      tone: tones.amber,
      featured: true,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 10H4L5 9z" />
        </svg>
      ),
    },
    {
      title: 'Mise en Place',
      subtitle: 'Preparation',
      description:
        'Retrouvez les supports de preparation dans un acces dedie, pense pour etre lisible et rapide a lancer.',
      label: 'Operationnel',
      cta: 'Lancer la preparation',
      onClick: () => setView('prep_sheet'),
      tone: tones.bronze,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  if (showStats) {
    operationalModules.push({
      title: 'Parametres',
      subtitle: 'Configuration',
      description:
        'Centralisez les reglages sensibles et gardez un acces propre aux donnees qui structurent les autres modules.',
      label: 'Pilotage',
      cta: 'Acceder aux reglages',
      onClick: () => setView('stats'),
      tone: tones.honey,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    });
  }

  const analysisModules: ModuleCardProps[] = [
    {
      title: 'Mix Produit',
      subtitle: 'Lecture commerciale',
      description:
        'Analysez la performance des ventes avec une entree plus orientee pilotage et lecture decisionnelle.',
      label: 'Analyse',
      cta: 'Voir les indicateurs',
      onClick: () => setView('product_mix'),
      tone: tones.copper,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    },
    {
      title: 'Cout Matiere',
      subtitle: 'Lecture financiere',
      description:
        'Suivez la rentabilite du mois avec une entree claire vers les analyses de cout et de marge.',
      label: 'Performance',
      cta: 'Analyser les couts',
      onClick: () => setView('cost_analysis'),
      tone: tones.bronze,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: 'Taux de Prise',
      subtitle: 'Pilotage des ventes',
      description:
        'Accedez rapidement aux performances de prise pour lire les tendances et ajuster vos decisions.',
      label: 'Suivi',
      cta: 'Consulter le suivi',
      onClick: () => setView('take_rate_sheet'),
      tone: tones.honey,
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ];

  const availableModuleCount = operationalModules.length + analysisModules.length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');

        .home-serif {
          font-family: 'Cormorant Garamond', serif;
        }

        .home-sans {
          font-family: 'Manrope', sans-serif;
        }

        .home-shell {
          background-image:
            radial-gradient(circle at top left, rgba(244, 190, 106, 0.30), transparent 28%),
            radial-gradient(circle at top right, rgba(194, 111, 50, 0.18), transparent 24%),
            radial-gradient(circle at bottom center, rgba(255, 222, 159, 0.30), transparent 34%),
            linear-gradient(180deg, #FCF3E4 0%, #F4E2C6 48%, #EBCB97 100%);
        }

        .home-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(156, 112, 68, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(156, 112, 68, 0.05) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.28), transparent 76%);
        }

        .home-panel {
          backdrop-filter: blur(16px);
          box-shadow: 0 28px 80px rgba(87, 57, 27, 0.12);
        }

        @keyframes riseIn {
          from {
            opacity: 0;
            transform: translateY(24px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes floatGlow {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.85;
          }

          50% {
            transform: translate3d(0, 18px, 0);
            opacity: 1;
          }
        }
      `}</style>

      <div className="home-shell home-sans relative min-h-screen overflow-hidden text-[#2C1B14]">
        {showPassword && (
          <PasswordModal
            onConfirm={() => {
              setShowPassword(false);
              setView('admin_dashboard');
            }}
            onClose={() => setShowPassword(false)}
          />
        )}

        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-[-120px] top-[90px] h-72 w-72 rounded-full bg-[#F3C56D]/25 blur-3xl"
            style={{ animation: 'floatGlow 8s ease-in-out infinite' }}
          />
          <div
            className="absolute right-[-100px] top-[180px] h-80 w-80 rounded-full bg-[#C56B3A]/15 blur-3xl"
            style={{ animation: 'floatGlow 10s ease-in-out infinite' }}
          />
          <div
            className="absolute bottom-[-80px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#FFE4A8]/35 blur-3xl"
            style={{ animation: 'floatGlow 12s ease-in-out infinite' }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-[1380px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
            <div
              className="home-panel relative overflow-hidden rounded-[38px] border border-[#E7CFAD] bg-[#FFF8EC]/90 px-7 py-8 sm:px-10 sm:py-10"
              style={{ animation: 'riseIn 0.55s ease-out both' }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,236,193,0.9),transparent_42%)]" />

              <div className="relative z-10">
                <span className="inline-flex rounded-full border border-[#E7C990] bg-[#FFF3DA] px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#A96C31]">
                  Accueil principal
                </span>

                <div className="mt-7">
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.32em] text-[#AF7B47]">Gestion restaurant</p>
                  <h1 className="home-serif mt-3 text-[3.7rem] font-semibold leading-[0.92] text-[#2B1A13] sm:text-[5rem] lg:text-[5.7rem]">
                    Hippo
                    <span className="block text-[#B86A2D]">Commandes</span>
                  </h1>
                  <p className="mt-6 max-w-[43rem] text-[17px] leading-8 text-[#694F42]">
                    Un accueil plus clair pour retrouver vite les modules quotidiens, piloter la performance
                    et garder une lecture professionnelle de l&apos;application dans une ambiance chaleureuse.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {[
                    'Exploitation quotidienne',
                    'Pilotage & analyse',
                    'Acces securise',
                  ].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[#E8D3B5] bg-[#FFF9F0]/95 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#7A5B49]"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-10 flex flex-wrap gap-3">
                  <button
                    onClick={() => setView('suppliers')}
                    className="rounded-full bg-[#2C1A10] px-6 py-3 text-[12px] font-extrabold uppercase tracking-[0.18em] text-white transition hover:bg-[#3C2417]"
                  >
                    Ouvrir les commandes
                  </button>

                  {showStats ? (
                    <button
                      onClick={() => setView('stats')}
                      className="rounded-full border border-[#E2BE7F] bg-[#FFF4D9] px-6 py-3 text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#7A5A22] transition hover:bg-[#F7E0AD]"
                    >
                      Voir les parametres
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <aside
              className="home-panel relative overflow-hidden rounded-[38px] border border-[#E7CFAD] bg-[#FFF8EC]/88 p-7 sm:p-8"
              style={{ animation: 'riseIn 0.65s ease-out 0.08s both' }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,229,177,0.7),transparent_38%)]" />

              <div className="relative z-10">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#B3773D]">Vue d&apos;ensemble</p>
                <h2 className="home-serif mt-3 text-[2.2rem] font-semibold leading-none text-[#2C1B14]">
                  Une entree plus lisible pour toute l&apos;equipe
                </h2>

                <div className="mt-7 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {[
                    {
                      value: `${availableModuleCount}`,
                      label: 'Modules',
                      note: 'acces actifs sur cet accueil',
                    },
                    {
                      value: '2',
                      label: 'Univers',
                      note: 'exploitation et pilotage',
                    },
                    {
                      value: canOpenAdmin ? 'Admin' : 'Protege',
                      label: 'Acces',
                      note: canOpenAdmin ? 'dashboard autorise' : 'mot de passe requis',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[24px] border border-[#E6D1B0] bg-[#FFF9F1]/95 px-5 py-5"
                    >
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#A87845]">{item.label}</p>
                      <p className="mt-3 text-[2rem] font-extrabold leading-none text-[#2C1B14]">{item.value}</p>
                      <p className="mt-2 text-[13px] leading-6 text-[#6E584C]">{item.note}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-7 rounded-[28px] border border-[#E5C497] bg-[#FFF3DA] p-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#A96C31]">Administration</p>
                  <p className="mt-3 text-[15px] leading-7 text-[#60483B]">
                    L&apos;espace admin reste present, mais mieux integre au reste de l&apos;accueil et plus
                    explicite sur son niveau d&apos;acces.
                  </p>

                  {!showStats && canSeeStats ? (
                    <p className="mt-3 text-[13px] leading-6 text-[#8A6645]">
                      Le module Parametres est masque sur telephone pour eviter les modifications sensibles.
                    </p>
                  ) : null}

                  <button
                    onClick={() => {
                      if (canOpenAdmin) {
                        setView('admin_dashboard');
                        return;
                      }
                      setShowPassword(true);
                    }}
                    className="mt-5 inline-flex items-center gap-3 rounded-full border border-[#C98746] bg-[#2C1A10] px-5 py-3 text-[12px] font-extrabold uppercase tracking-[0.18em] text-white transition hover:bg-[#3C2417]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Dashboard admin
                  </button>
                </div>
              </div>
            </aside>
          </section>

          <section className="mt-10">
            <SectionHeading
              eyebrow="Exploitation quotidienne"
              title="Les acces utilises chaque jour"
              description="Les modules operationnels sont mis en avant avec une hiérarchie plus claire, pour guider l'equipe sans surcharger l'accueil."
            />

            <div
              className={`grid gap-4 ${showStats ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
            >
              {operationalModules.map((module, index) => (
                <HomeModuleCard
                  key={module.title}
                  {...module}
                  delay={0.14 + index * 0.08}
                />
              ))}
            </div>
          </section>

          <section className="mt-12">
            <SectionHeading
              eyebrow="Pilotage"
              title="Analyse et performance"
              description="Les modules de lecture business sont regroupes pour rendre la navigation plus naturelle entre rentabilite, ventes et taux de prise."
            />

            <div className="grid gap-4 lg:grid-cols-3">
              {analysisModules.map((module, index) => (
                <HomeModuleCard
                  key={module.title}
                  {...module}
                  delay={0.28 + index * 0.08}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default HomePage;
