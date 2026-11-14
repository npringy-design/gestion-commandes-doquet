// Barre de recherche dans les manuels opératoires (accueil, tous les rôles).

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import {
  rechercherFiches,
  trouverFicheParTitre,
  urlPdf,
  type FicheDetail,
  type SearchResult,
} from '../lib/manuels';
import { SECTION_TYPE_LABELS, highlightSegments, type ManualSection } from '../utils/manualIndexer';

const DEBOUNCE_MS = 350;

const Highlighted: React.FC<{ text: string; query: string }> = ({ text, query }) => (
  <>
    {highlightSegments(text, query).map((segment, index) =>
      segment.match ? (
        <mark key={index} className="rounded bg-yellow-200 px-0.5 text-inherit">{segment.text}</mark>
      ) : (
        <React.Fragment key={index}>{segment.text}</React.Fragment>
      ),
    )}
  </>
);

const SectionBlocks: React.FC<{ sections: ManualSection[]; query: string }> = ({ sections, query }) => (
  <div className="space-y-3">
    {sections.map((section, index) => (
      <div key={index}>
        {section.libelle ? (
          <div className="text-[11px] font-black uppercase tracking-wide text-[#8A4B1F]">{section.libelle}</div>
        ) : null}
        <div className="whitespace-pre-line text-sm text-[#2F1D14]">
          <Highlighted text={section.texte} query={query} />
        </div>
      </div>
    ))}
  </div>
);

const openPdf = async (path: string, page: number, onError: (message: string) => void) => {
  try {
    const url = await urlPdf(path, page);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Impossible d’ouvrir le PDF.');
  }
};

const ResultCard: React.FC<{ result: SearchResult; query: string; site: string }> = ({ result, query, site }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [subFiche, setSubFiche] = useState<FicheDetail | null>(null);

  const targeted = result.sections.filter((section) => result.rubriquesCiblees.includes(section.typeRubrique));
  const showTargeted = result.type === 'fiche' && targeted.length > 0;
  const heading = result.titre ?? `Page ${result.page}`;

  const handleSubFiche = async (name: string) => {
    setMessage(null);
    try {
      const found = await trouverFicheParTitre(site, name);
      if (found) setSubFiche(found);
      else setMessage(`Aucune fiche « ${name} » trouvée dans les manuels de ce site.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Recherche de la sous-fiche impossible.');
    }
  };

  return (
    <article className="rounded-lg border border-[#E2C79B] bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-black text-[#3A2116]">{heading}</h3>
        <span className="rounded-full bg-[#FFF2CF] px-2 py-0.5 text-[11px] font-bold text-[#512A16]">
          {result.poste} · p. {result.page}
        </span>
      </header>

      <div className="mt-3">
        {showTargeted ? (
          <>
            <div className="mb-1 text-[11px] font-bold uppercase text-[#8A4B1F]">
              {[...new Set(targeted.map((section) => SECTION_TYPE_LABELS[section.typeRubrique]))].join(' · ')}
            </div>
            <SectionBlocks sections={targeted} query={query} />
          </>
        ) : (
          <p className="text-sm text-[#2F1D14]">
            <Highlighted text={result.extrait.replace(/[⟦⟧]/g, '')} query={query} />
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void openPdf(result.cheminStockage, result.page, setMessage)}
          className="rounded-md bg-[#512A16] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3A2116]"
        >
          Ouvrir le PDF
        </button>
        {result.sousFiches.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => void handleSubFiche(name)}
            className="rounded-md border border-[#D99A4A] bg-[#FFF8E8] px-3 py-1.5 text-xs font-bold uppercase text-[#512A16] hover:bg-[#FFF2CF]"
          >
            Sous-fiche : {name}
          </button>
        ))}
      </div>

      {message ? <p className="mt-2 text-xs text-red-700">{message}</p> : null}

      {subFiche ? (
        <div className="mt-3 rounded-md border border-[#E2C79B] bg-[#FFFBF2] p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-black text-[#3A2116]">{subFiche.titre}</h4>
            <span className="rounded-full bg-[#FFF2CF] px-2 py-0.5 text-[11px] font-bold text-[#512A16]">
              {subFiche.poste} · p. {subFiche.page}
            </span>
            <button
              type="button"
              onClick={() => void openPdf(subFiche.cheminStockage, subFiche.page, setMessage)}
              className="rounded-md bg-[#512A16] px-2 py-1 text-[11px] font-bold text-white"
            >
              Ouvrir le PDF
            </button>
            <button type="button" onClick={() => setSubFiche(null)} className="ml-auto text-xs font-bold text-[#8A4B1F]">
              Fermer
            </button>
          </div>
          <SectionBlocks sections={subFiche.sections} query="" />
        </div>
      ) : null}
    </article>
  );
};

const ManualSearch: React.FC = () => {
  const { activeSiteId } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      requestId.current += 1;
      setResults(null);
      setLoading(false);
      setError(null);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      const current = requestId.current + 1;
      requestId.current = current;
      setLoading(true);
      setError(null);
      try {
        const found = await rechercherFiches(activeSiteId, trimmed);
        if (requestId.current === current) setResults(found);
      } catch (searchError) {
        if (requestId.current === current) {
          setResults(null);
          setError(searchError instanceof Error ? searchError.message : 'Recherche impossible.');
        }
      } finally {
        if (requestId.current === current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, activeSiteId]);

  if (!isSupabaseConfigured()) return null;

  return (
    <section className="mb-4" aria-label="Recherche dans les manuels opératoires">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher dans les manuels (ex. poids crème brûlée)"
          className="w-full rounded-lg border border-[#D99A4A] bg-[#FFF8E8] px-4 py-3 text-sm font-semibold text-[#2F1D14] shadow-[0_10px_22px_rgba(26,13,8,0.18)] placeholder:text-[#8A6A4B] focus:outline-none focus:ring-2 focus:ring-[#F6B24A]"
        />
        {loading ? <span className="absolute right-4 top-3.5 text-xs font-bold text-[#8A4B1F]">Recherche…</span> : null}
      </div>

      {error ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {results !== null && !error ? (
        results.length === 0 ? (
          <p className="mt-2 rounded-md bg-[#FFF8E8] px-3 py-2 text-sm font-semibold text-[#512A16]">
            Aucun résultat pour « {query.trim()} ».
          </p>
        ) : (
          <div className="mt-3 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {results.map((result) => (
              <ResultCard key={result.id} result={result} query={query} site={activeSiteId} />
            ))}
          </div>
        )
      ) : null}
    </section>
  );
};

export default ManualSearch;
