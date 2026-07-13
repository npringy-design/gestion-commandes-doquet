// =============================================================
// components/tutorials/TutorialSection.tsx
// Fiche tutoriel repliable (accordéon) réutilisable pour la page
// Aide / Tutoriels : titre, description optionnelle, liste d'étapes
// numérotées avec image optionnelle sous le texte.
// =============================================================

import React, { useState } from 'react';

export interface TutorialStep {
  title: string;
  text: string;
  image?: string;
}

interface TutorialSectionProps {
  title: string;
  description?: string;
  steps: TutorialStep[];
}

const TutorialSection: React.FC<TutorialSectionProps> = ({ title, description, steps }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-[24px] border border-[#D8AE77] bg-[#FFF7EA] p-6 shadow-[0_14px_30px_rgba(80,38,18,0.12)]">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <h2 className="text-lg font-black text-[#2F1D14]">{title}</h2>
          {description && <p className="mt-1 text-sm text-[#6A432D]">{description}</p>}
        </div>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#E2C39B] bg-[#FFFDF8] text-[#6A432D] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="mt-6 space-y-6 border-t border-[#E8D8C8] pt-6">
          {steps.map((step, index) => (
            <div key={step.title} className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C86F24] text-sm font-black text-white shadow-[0_4px_0_#8B431C]">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-[#2F1D14]">{step.title}</h3>
                <p className="mt-1 text-sm text-[#6A432D]">{step.text}</p>
                {step.image && (
                  <img
                    src={step.image}
                    alt={step.title}
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
