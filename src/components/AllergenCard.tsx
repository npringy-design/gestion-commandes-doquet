// Carte « Allergènes » d'un plat : allergènes signalés en pastilles pleines, les
// autres en petites pastilles grisées repliables, message de sécurité et bouton
// PDF. Un plat sans case colorée n'est JAMAIS présenté comme « sans allergène ».

import React from 'react';
import { formatAllergenDate, urlAllergenPdf, type AllergenPlat } from '../lib/allergenes';
import {
  ALLERGEN_CODES,
  ALLERGEN_DISCLAIMER,
  ALLERGEN_LABELS,
  ALLERGEN_NONE_FLAGGED,
  type AllergenCode,
} from '../utils/manualConstants';
import { toDisplayCase } from '../utils/manualIndexer';

export const noneFlaggedText = (plat: AllergenPlat): string =>
  `${ALLERGEN_NONE_FLAGGED} ${formatAllergenDate(plat.dateMiseAJour)}`;

export const flaggedSummary = (plat: AllergenPlat): string =>
  plat.allergenes.length > 0 ? plat.allergenes.map((code) => ALLERGEN_LABELS[code]).join(', ') : noneFlaggedText(plat);

export const AllergenChips: React.FC<{ codes: readonly AllergenCode[]; muted?: boolean }> = ({ codes, muted = false }) => (
  <>
    {codes.map((code) => (
      <span
        key={code}
        className={muted
          ? 'rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500'
          : 'rounded-full bg-amber-200 px-3 py-1 text-sm font-black text-amber-950 ring-1 ring-amber-400'}
      >
        {ALLERGEN_LABELS[code]}
      </span>
    ))}
  </>
);

interface AllergenCardProps {
  plat: AllergenPlat;
  backLabel: string | null;
  onBack: (() => void) | null;
  onError: (message: string) => void;
}

const AllergenCard: React.FC<AllergenCardProps> = ({ plat, backLabel, onBack, onError }) => {
  const others = ALLERGEN_CODES.filter((code) => !plat.allergenes.includes(code));
  const documentDate = formatAllergenDate(plat.dateMiseAJour);

  const handlePdf = async () => {
    try {
      window.open(await urlAllergenPdf(plat.cheminStockage, plat.page), '_blank', 'noopener,noreferrer');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Impossible d’ouvrir le PDF.');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-5">
      {onBack ? (
        <button type="button" onClick={onBack} className="mb-3 text-xs font-bold text-[#8A4B1F] hover:underline">
          ← {backLabel ?? 'Retour'}
        </button>
      ) : null}
      <header className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black uppercase text-red-800">Allergènes</span>
          <h3 className="mt-1 text-xl font-black leading-tight text-[#3A2116]">{toDisplayCase(plat.nom)}</h3>
          {plat.categorie ? <p className="text-sm font-semibold text-[#6B4A33]">{toDisplayCase(plat.categorie)}</p> : null}
          <p className="mt-1 text-xs font-bold text-[#8A4B1F]">
            Document du {documentDate}
            {plat.dateTrouvee ? '' : ' (date de dépôt : date de mise à jour non trouvée dans le PDF)'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handlePdf()}
          className="rounded-md bg-[#512A16] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3A2116]"
        >
          PDF
        </button>
      </header>

      {plat.allergenes.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Allergènes signalés">
          <AllergenChips codes={plat.allergenes} />
        </div>
      ) : (
        <p className="rounded-lg border border-[#E2C79B] bg-white px-3 py-2 text-sm font-bold text-[#2F1D14]">
          {noneFlaggedText(plat)}
        </p>
      )}

      {others.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-bold text-[#8A4B1F]">
            Allergènes non signalés ({others.length})
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <AllergenChips codes={others} muted />
          </div>
        </details>
      ) : null}

      <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{ALLERGEN_DISCLAIMER}</p>
    </div>
  );
};

export default AllergenCard;
