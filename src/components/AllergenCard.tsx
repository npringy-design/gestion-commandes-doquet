// Carte « Allergènes » d'un plat : allergènes signalés en pastilles pleines, les
// autres en petites pastilles grisées repliables, message de sécurité et bouton
// PDF. Un plat sans case colorée n'est JAMAIS présenté comme « sans allergène ».

import React from 'react';
import { formatAllergenDate, urlAllergenPdf, type AllergenPlat } from '../lib/allergenes';
import {
  ALLERGEN_CODES,
  ALLERGEN_WARNING,
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
  // Plat trouvé par une recherche approximative (au moins un mot) : à confirmer par l'utilisateur.
  approximate: boolean;
  backLabel: string | null;
  onBack: (() => void) | null;
  onError: (message: string) => void;
}

const AllergenCard: React.FC<AllergenCardProps> = ({ plat, approximate, backLabel, onBack, onError }) => {
  const others = ALLERGEN_CODES.filter((code) => !plat.allergenes.includes(code));
  const documentDate = formatAllergenDate(plat.dateMiseAJour);

  const openGuide = async () => {
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
      <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-100 p-4" role="alert">
        <p className="flex items-start gap-3 text-base font-bold leading-snug text-amber-950">
          <span aria-hidden="true" className="text-2xl leading-none">⚠️</span>
          <span>{ALLERGEN_WARNING}</span>
        </p>
        <button
          type="button"
          onClick={() => void openGuide()}
          className="mt-3 w-full rounded-lg bg-[#512A16] px-4 py-3 text-base font-black text-white hover:bg-[#3A2116] sm:w-auto"
        >
          Ouvrir le guide officiel
        </button>
      </div>

      <header className="mb-4">
        {approximate ? (
          <p className="mb-1 rounded-md bg-orange-100 px-3 py-1.5 text-sm font-black text-orange-900">Est-ce bien ce plat ?</p>
        ) : null}
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black uppercase text-red-800">Allergènes</span>
        <h3 className={`mt-1 font-black leading-tight text-[#3A2116] ${approximate ? 'text-3xl' : 'text-xl'}`}>{toDisplayCase(plat.nom)}</h3>
        {plat.categorie ? (
          <p className={plat.conflict ? 'mt-1 inline-block rounded-md bg-orange-100 px-2 py-1 text-base font-black text-orange-900' : 'text-sm font-semibold text-[#6B4A33]'}>
            {plat.conflict ? 'Catégorie : ' : ''}{toDisplayCase(plat.categorie)}
          </p>
        ) : null}
        {plat.conflict ? (
          <p className="mt-2 rounded-md bg-orange-100 px-3 py-2 text-sm font-bold text-orange-900">
            Ce plat existe avec des allergènes différents selon la catégorie : vérifie la catégorie avant de lire ses allergènes.
          </p>
        ) : null}
        {plat.alsoIn.length > 0 ? (
          <p className="mt-1 text-xs font-semibold text-[#6B4A33]">
            Aussi présent dans : {plat.alsoIn.map((category) => toDisplayCase(category)).join(', ')}
          </p>
        ) : null}
        <p className="mt-1 text-xs font-bold text-[#8A4B1F]">
          Document du {documentDate}
          {plat.dateTrouvee ? '' : ' (date de dépôt : date de mise à jour non trouvée dans le PDF)'}
        </p>
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

    </div>
  );
};

export default AllergenCard;
