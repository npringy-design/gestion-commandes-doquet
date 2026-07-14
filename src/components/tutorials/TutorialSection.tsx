// =============================================================
// components/tutorials/TutorialSection.tsx
// Fiche tutoriel repliable réutilisable pour la page Aide / Tutoriels :
// titre, description optionnelle, et deux modes d'affichage au choix
// (vidéo unique, ou étapes numérotées texte/image), sélectionnés via
// les deux boutons ronds à droite du titre.
// =============================================================

import React, { useState } from 'react';

export interface TutorialStep {
  text: string;
  image?: string;
}

interface TutorialSectionProps {
  title: string;
  description?: string;
  video?: string;
  steps: TutorialStep[];
}

type TutorialMode = 'video' | 'steps' | null;

const modeButtonClass = (active: boolean) =>
  `flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] shadow-[0_4px_0_#8B431C] transition-all ${
    active
      ? 'border-[#8B431C] bg-[#C86F24] text-white'
      : 'border-[#C86F24] bg-[#FFE8C2] text-[#8B431C] hover:bg-[#FFDBA3] hover:-translate-y-0.5'
  }`;

const TutorialSection: React.FC<TutorialSectionProps> = ({ title, description, video, steps }) => {
  const [mode, setMode] = useState<TutorialMode>(null);

  const toggleMode = (next: Exclude<TutorialMode, null>) => {
    setMode((current) => (current === next ? null : next));
  };

  return (
    <section className="rounded-[24px] border border-[#D8AE77] bg-[#FFF7EA] p-6 shadow-[0_14px_30px_rgba(80,38,18,0.12)]">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-[#2F1D14]">{title}</h2>
          {description && <p className="mt-1 text-sm text-[#6A432D]">{description}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {video && (
            <button
              type="button"
              onClick={() => toggleMode('video')}
              aria-pressed={mode === 'video'}
              title="Voir la vidéo"
              aria-label="Voir la vidéo"
              className={modeButtonClass(mode === 'video')}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14" />
                <rect x="3" y="6" width="12" height="12" rx="2" strokeWidth={2.4} />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleMode('steps')}
            aria-pressed={mode === 'steps'}
            title="Voir les étapes (texte et images)"
            aria-label="Voir les étapes (texte et images)"
            className={modeButtonClass(mode === 'steps')}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
            </svg>
          </button>
        </div>
      </div>

      {mode === 'video' && video && (
        <div className="mt-6 border-t border-[#E8D8C8] pt-6">
          <video
            src={video}
            controls
            playsInline
            preload="metadata"
            className="w-full rounded-[16px] border border-[#E2C39B]"
          >
            Votre navigateur ne supporte pas la lecture vidéo.
          </video>
        </div>
      )}

      {mode === 'steps' && (
        <div className="mt-6 space-y-6 border-t border-[#E8D8C8] pt-6">
          {steps.map((step, index) => (
            <div key={step.text} className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C86F24] text-sm font-black text-white shadow-[0_4px_0_#8B431C]">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-[#6A432D]">{step.text}</p>
                {step.image && (
                  <img
                    src={step.image}
                    alt={step.text}
                    className="mt-3 w-full rounded-[16px] border border-[#E2C39B] object-contain"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default TutorialSection;
