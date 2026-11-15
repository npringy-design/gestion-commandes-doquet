// Recherche dans les manuels opératoires (accueil, tous les rôles).
// La barre reste dans l'accueil ; dès la saisie, un panneau s'ouvre par-dessus
// la page : liste des résultats à gauche, fiche à droite (téléphone : liste puis
// fiche en plein écran).

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { canManageManuels } from '../lib/permissions';
import { trouverAllergenesParNoms, urlAllergenPdf, type AllergenPlat } from '../lib/allergenes';
import { ALLERGEN_APPROXIMATE_BANNER, ALLERGEN_WARNING_SHORT } from '../utils/manualConstants';
import AllergenCard, { flaggedSummary } from './AllergenCard';
import {
  listTitresFiches,
  rechercherFiches,
  trouverFicheParTitre,
  urlPdf,
  type SearchResult,
} from '../lib/manuels';
import {
  MANUAL_FORMAT_VERSION,
  SECTION_TYPE_LABELS,
  highlightSegments,
  matchKey,
  splitTitle,
  toDisplayCase,
  type ManualSection,
  type SectionLine,
  type SectionType,
} from '../utils/manualIndexer';

const DEBOUNCE_MS = 350;

// La saisie est conservée tant que la page n'est pas rechargée.
let rememberedQuery = '';

interface FicheModel {
  type: 'page' | 'fiche';
  titre: string | null;
  poste: string;
  page: number;
  cheminStockage: string;
  sections: ManualSection[];
  formatVersion: number;
  extrait: string;
  rubriquesCiblees: SectionType[];
}

const modelFromResult = (result: SearchResult): FicheModel => ({
  type: result.type,
  titre: result.titre,
  poste: result.poste,
  page: result.page,
  cheminStockage: result.cheminStockage,
  sections: result.sections,
  formatVersion: result.formatVersion,
  extrait: result.extrait,
  rubriquesCiblees: result.rubriquesCiblees,
});

// Ce qui s'affiche dans le panneau de droite : une fiche technique ou la carte allergènes d'un plat.
type PanelModel =
  | { kind: 'fiche'; fiche: FicheModel }
  | { kind: 'allergene'; plat: AllergenPlat; approximate: boolean };

// Ligne de la liste de résultats : les allergènes passent en tête.
type ListEntry =
  | { kind: 'allergene'; plat: AllergenPlat; approximate: boolean }
  | { kind: 'fiche'; result: SearchResult };

const modelTitle = (model: PanelModel): string => {
  if (model.kind === 'allergene') return toDisplayCase(model.plat.nom);
  return model.fiche.titre ? toDisplayCase(splitTitle(model.fiche.titre).principal) : `la page ${model.fiche.page}`;
};

const stripMarks = (text: string) => text.replace(/[⟦⟧]/g, '');

const useIsDesktop = () => {
  const [desktop, setDesktop] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia('(min-width: 768px)').matches));
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return desktop;
};

const Highlighted: React.FC<{ text: string; terms: readonly string[] }> = ({ text, terms }) => (
  <>
    {highlightSegments(text, terms).map((segment, index) =>
      segment.match ? (
        <mark key={index} className="rounded bg-yellow-200 px-0.5 text-inherit">{segment.text}</mark>
      ) : (
        <React.Fragment key={index}>{segment.text}</React.Fragment>
      ),
    )}
  </>
);

interface GroupedLines {
  kind: SectionLine['kind'];
  lines: SectionLine[];
}

const groupLines = (lines: SectionLine[]): GroupedLines[] => {
  const groups: GroupedLines[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.kind === line.kind) last.lines.push(line);
    else groups.push({ kind: line.kind, lines: [line] });
  }
  return groups;
};

interface SectionViewProps {
  section: ManualSection;
  terms: readonly string[];
  targeted: boolean;
  titles: Map<string, string>;
  onSubFiche: (name: string) => void;
  sectionRef?: (element: HTMLElement | null) => void;
}

const SectionView: React.FC<SectionViewProps> = ({ section, terms, targeted, titles, onSubFiche, sectionRef }) => {
  const heading = section.libelle
    ? toDisplayCase(section.libelle, [])
    : section.typeRubrique === 'autre'
      ? ''
      : SECTION_TYPE_LABELS[section.typeRubrique];

  return (
    <section
      ref={sectionRef}
      className={`rounded-lg p-3 ${targeted ? 'bg-amber-50 ring-2 ring-amber-400' : ''}`}
    >
      {heading ? (
        <h4 className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#8A4B1F]">{heading}</h4>
      ) : null}
      {section.lignes.length === 0 ? (
        <p className="whitespace-pre-line text-sm text-[#2F1D14]">
          <Highlighted text={section.texte} terms={terms} />
        </p>
      ) : (
        <div className="space-y-2">
          {groupLines(section.lignes).map((group, groupIndex) => {
            if (group.kind === 'ingredient') {
              return (
                <table key={groupIndex} className="w-full text-sm">
                  <tbody>
                    {group.lines.map((line, index) => {
                      const target = line.sousFiche ? titles.get(matchKey(line.sousFiche)) : undefined;
                      return (
                        <tr key={index} className="border-b border-[#F0E2C8] last:border-0">
                          <td className="w-px whitespace-nowrap py-1 pr-3 text-right align-top font-semibold tabular-nums text-[#3A2116]">
                            {line.quantite}
                            {line.unite ? ` ${line.unite}` : ''}
                          </td>
                          <td className="py-1 align-top text-[#2F1D14]">
                            <Highlighted text={line.produit ?? line.affichage} terms={terms} />
                            {target && line.sousFiche ? (
                              <button
                                type="button"
                                onClick={() => onSubFiche(line.sousFiche ?? '')}
                                className="ml-2 rounded border border-[#D99A4A] bg-[#FFF8E8] px-1.5 py-0.5 text-[11px] font-bold text-[#512A16] hover:bg-[#FFF2CF]"
                                title="Ouvrir la sous-fiche"
                              >
                                Fiche ›
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            }
            if (group.kind === 'etape') {
              return (
                <ol key={groupIndex} className="space-y-1.5 text-sm text-[#2F1D14]">
                  {group.lines.map((line, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="w-6 shrink-0 text-right font-black text-[#8A4B1F]">{line.numero}.</span>
                      <div className="min-w-0">
                        <Highlighted text={line.affichage} terms={terms} />
                        {line.sousLignes ? (
                          <ul className="mt-1 list-disc space-y-0.5 pl-5">
                            {line.sousLignes.map((sub, subIndex) => (
                              <li key={subIndex}><Highlighted text={sub.affichage} terms={terms} /></li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              );
            }
            if (group.kind === 'puce') {
              return (
                <ul key={groupIndex} className="list-disc space-y-0.5 pl-5 text-sm text-[#2F1D14]">
                  {group.lines.map((line, index) => (
                    <li key={index}><Highlighted text={line.affichage} terms={terms} /></li>
                  ))}
                </ul>
              );
            }
            return (
              <div key={groupIndex} className="space-y-1 text-sm text-[#2F1D14]">
                {group.lines.map((line, index) => (
                  <p key={index}><Highlighted text={line.affichage} terms={terms} /></p>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

interface FicheViewProps {
  model: FicheModel;
  terms: readonly string[];
  canManage: boolean;
  titles: Map<string, string>;
  backLabel: string | null;
  onBack: (() => void) | null;
  onSubFiche: (name: string) => void;
  allergenLink: AllergenPlat | null;
  onOpenAllergen: (plat: AllergenPlat) => void;
  onError: (message: string) => void;
}

const FicheView: React.FC<FicheViewProps> = ({ model, terms, canManage, titles, backLabel, onBack, onSubFiche, allergenLink, onOpenAllergen, onError }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const structured = model.type === 'fiche' && model.formatVersion >= 2;
  const { principal, sousTitre } = splitTitle(model.titre ?? '');
  const title = model.titre ? toDisplayCase(principal) : `Page ${model.page}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const target = targetRef.current;
    if (target) {
      const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 8;
      container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    } else {
      container.scrollTo({ top: 0 });
    }
  }, [model]);

  const openGuide = async (plat: AllergenPlat) => {
    try {
      window.open(await urlAllergenPdf(plat.cheminStockage, plat.page), '_blank', 'noopener,noreferrer');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Impossible d’ouvrir le guide.');
    }
  };

  const handlePdf = async () => {
    try {
      window.open(await urlPdf(model.cheminStockage, model.page), '_blank', 'noopener,noreferrer');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Impossible d’ouvrir le PDF.');
    }
  };

  targetRef.current = null;
  let firstTargetAssigned = false;
  return (
    <div ref={containerRef} className="h-full overflow-y-auto p-4 md:p-5">
      {onBack ? (
        <button type="button" onClick={onBack} className="mb-3 text-xs font-bold text-[#8A4B1F] hover:underline">
          ← {backLabel ?? 'Retour'}
        </button>
      ) : null}
      <header className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-black leading-tight text-[#3A2116]">{title}</h3>
          {sousTitre ? <p className="text-sm font-semibold text-[#6B4A33]">{toDisplayCase(sousTitre)}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#FFF2CF] px-2 py-0.5 text-[11px] font-bold text-[#512A16]">
              {model.poste} · p. {model.page}
            </span>
            {canManage && model.type === 'fiche' && model.formatVersion < MANUAL_FORMAT_VERSION ? (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-black text-amber-900">À réindexer</span>
            ) : null}
          </div>
          {allergenLink ? (
            <p className="mt-2 text-xs font-semibold text-[#2F1D14]">
              <span className="font-black uppercase text-red-800">Allergènes : </span>
              {flaggedSummary(allergenLink)}
              <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                ⚠ {ALLERGEN_WARNING_SHORT}{' '}
                <button type="button" className="underline" onClick={() => void openGuide(allergenLink)}>Ouvrir le guide</button>
              </span>
              <button
                type="button"
                onClick={() => onOpenAllergen(allergenLink)}
                className="ml-2 rounded border border-[#D99A4A] bg-[#FFF8E8] px-1.5 py-0.5 text-[11px] font-bold text-[#512A16] hover:bg-[#FFF2CF]"
              >
                Voir la carte ›
              </button>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handlePdf()}
          className="rounded-md bg-[#512A16] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3A2116]"
        >
          PDF
        </button>
      </header>

      {structured ? (
        <div className="space-y-3">
          {model.sections.map((section, index) => {
            const targeted = model.rubriquesCiblees.includes(section.typeRubrique);
            const assignRef = targeted && !firstTargetAssigned;
            if (assignRef) firstTargetAssigned = true;
            return (
              <SectionView
                key={index}
                section={section}
                terms={terms}
                targeted={targeted}
                titles={titles}
                onSubFiche={onSubFiche}
                sectionRef={assignRef ? (element) => { targetRef.current = element; } : undefined}
              />
            );
          })}
        </div>
      ) : model.extrait ? (
        <p className="text-sm text-[#2F1D14]">
          <Highlighted text={toDisplayCase(stripMarks(model.extrait))} terms={terms} />
        </p>
      ) : (
        <div className="space-y-2">
          {model.sections.map((section, index) => (
            <p key={index} className="whitespace-pre-line text-sm text-[#2F1D14]">
              <Highlighted text={toDisplayCase(section.texte)} terms={terms} />
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

const ManualSearch: React.FC = () => {
  const { activeSiteId, profile } = useAuth();
  const canManage = canManageManuels(profile);
  const isDesktop = useIsDesktop();
  const [query, setQueryState] = useState(rememberedQuery);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [plats, setPlats] = useState<AllergenPlat[]>([]);
  const [allergenSearch, setAllergenSearch] = useState(false);
  const [allergenPartial, setAllergenPartial] = useState(false);
  const [allergenLink, setAllergenLink] = useState<AllergenPlat | null>(null);
  const [terms, setTerms] = useState<string[]>([]);
  const [partial, setPartial] = useState(false);
  const [vague, setVague] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Choix explicite de l'utilisateur dans la liste ; sinon la sélection est dérivée des résultats (voir activeIndex).
  const [picked, setPicked] = useState<number | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [stack, setStack] = useState<PanelModel[]>([]);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [panelTop, setPanelTop] = useState(80);
  const requestId = useRef(0);
  const barRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const setQuery = (value: string) => {
    rememberedQuery = value;
    setQueryState(value);
  };

  const trimmed = query.trim();
  const panelVisible = open && trimmed.length >= 2;

  const close = useCallback(() => {
    setOpen(false);
    setMobileDetail(false);
  }, []);

  // Recherche après une courte pause de frappe.
  useEffect(() => {
    if (trimmed.length < 2) {
      requestId.current += 1;
      setResults(null);
      setPlats([]);
      setAllergenSearch(false);
      setAllergenPartial(false);
      setTerms([]);
      setPartial(false);
      setVague(false);
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
        if (requestId.current === current) {
          setResults(found.results);
          setPlats(found.allergenes);
          setAllergenSearch(found.allergenSearch);
          setAllergenPartial(found.allergenPartial);
          setTerms(found.terms);
          setPartial(found.partial);
          setVague(found.vague);
          setPicked(null);
          setStack([]);
          setMobileDetail(false);
        }
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
  }, [trimmed, activeSiteId]);

  // Titres des fiches du site : un lien de sous-fiche n'apparaît que si elle existe.
  useEffect(() => {
    if (!panelVisible) return;
    let cancelled = false;
    listTitresFiches(activeSiteId)
      .then((map) => { if (!cancelled) setTitles(map); })
      .catch(() => { if (!cancelled) setTitles(new Map()); });
    return () => { cancelled = true; };
  }, [panelVisible, activeSiteId]);

  // L'accueil ne bouge plus tant que le panneau est ouvert.
  useEffect(() => {
    if (!panelVisible) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [panelVisible]);

  useLayoutEffect(() => {
    if (!panelVisible) return undefined;
    const measure = () => {
      const rect = barRef.current?.getBoundingClientRect();
      if (rect) setPanelTop(Math.max(0, rect.bottom + 8));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [panelVisible, isDesktop]);

  // Les résultats allergènes passent en tête de la liste.
  const entries = useMemo<ListEntry[]>(
    () => [
      ...plats.map((plat): ListEntry => ({ kind: 'allergene', plat, approximate: allergenPartial })),
      ...(results ?? []).map((result): ListEntry => ({ kind: 'fiche', result })),
    ],
    [plats, results, allergenPartial],
  );
  const count = entries.length;

  // SÉCURITÉ : en recherche d'allergènes, une carte ne s'ouvre seule que si UN SEUL plat contient tous
  // les termes. Dérivé des résultats courants (pas d'état à resynchroniser) : valable au premier
  // affichage comme quand la liste change. Sinon, rien n'est sélectionné tant que l'utilisateur ne choisit pas.
  const autoOpenAllowed = !allergenSearch || plats.length === 0 || (plats.length === 1 && !allergenPartial);
  const selected = picked ?? (autoOpenAllowed && count > 0 ? 0 : -1);

  const select = useCallback((index: number) => {
    setPicked(index);
    setStack([]);
  }, []);

  // Clavier : Échap ferme, flèches parcourent la liste, Entrée ouvre.
  useEffect(() => {
    if (!panelVisible) return undefined;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isDesktop && mobileDetail) setMobileDetail(false);
        else close();
      } else if (event.key === 'ArrowDown' && count > 0) {
        event.preventDefault();
        select(Math.min(count - 1, selected + 1));
      } else if (event.key === 'ArrowUp' && count > 0) {
        event.preventDefault();
        select(Math.max(0, selected - 1));
      } else if (event.key === 'Enter' && count > 0 && selected >= 0) {
        event.preventDefault();
        setMobileDetail(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelVisible, count, selected, isDesktop, mobileDetail, close, select]);

  useEffect(() => {
    const item = listRef.current?.children[selected];
    if (item instanceof HTMLElement) item.scrollIntoView({ block: 'nearest' });
  }, [selected, results]);

  const handleSubFiche = async (name: string) => {
    const titreNormalise = titles.get(matchKey(name));
    if (!titreNormalise) return;
    try {
      const found = await trouverFicheParTitre(activeSiteId, titreNormalise);
      if (!found) return;
      const fiche: FicheModel = {
        type: 'fiche',
        titre: found.titre,
        poste: found.poste,
        page: found.page,
        cheminStockage: found.cheminStockage,
        sections: found.sections,
        formatVersion: found.formatVersion,
        extrait: '',
        rubriquesCiblees: [],
      };
      setStack((current) => [...current, { kind: 'fiche', fiche }]);
    } catch (subError) {
      setError(subError instanceof Error ? subError.message : 'Sous-fiche indisponible.');
    }
  };

  const base = useMemo<PanelModel | null>(() => {
    const entry = entries[selected];
    if (!entry) return null;
    return entry.kind === 'allergene' ? { kind: 'allergene', plat: entry.plat, approximate: entry.approximate } : { kind: 'fiche', fiche: modelFromResult(entry.result) };
  }, [entries, selected]);

  const current = stack.length > 0 ? stack[stack.length - 1] : base;
  const previousModel = stack.length > 1 ? stack[stack.length - 2] : base;
  const backLabel = previousModel ? `Retour à ${modelTitle(previousModel)}` : null;

  // Lien fiche technique -> allergènes : correspondance EXACTE du nom normalisé, sinon rien.
  const linkTitle = current && current.kind === 'fiche' && current.fiche.type === 'fiche' ? current.fiche.titre : null;
  useEffect(() => {
    setAllergenLink(null);
    if (!panelVisible || !linkTitle) return undefined;
    let cancelled = false;
    trouverAllergenesParNoms(activeSiteId, [linkTitle, splitTitle(linkTitle).principal])
      .then((plat) => { if (!cancelled) setAllergenLink(plat); })
      .catch(() => { if (!cancelled) setAllergenLink(null); });
    return () => { cancelled = true; };
  }, [panelVisible, linkTitle, activeSiteId]);

  if (!isSupabaseConfigured()) return null;

  const fullScreenDetail = !isDesktop && mobileDetail;
  const showList = isDesktop || !mobileDetail;
  const showDetail = isDesktop || mobileDetail;

  return (
    <section className="mb-4" aria-label="Recherche dans les manuels opératoires">
      <div ref={barRef} className={`relative ${panelVisible ? 'z-[60]' : ''}`}>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(event.target.value.trim().length >= 2);
          }}
          onClick={() => { if (trimmed.length >= 2) setOpen(true); }}
          placeholder="Recherche un plat : recette, dressage ou allergènes"
          aria-label="Rechercher un plat dans les manuels et le tableau des allergènes"
          className="w-full rounded-lg border border-[#D99A4A] bg-[#FFF8E8] px-4 py-3 text-sm font-semibold text-[#2F1D14] shadow-[0_10px_22px_rgba(26,13,8,0.18)] placeholder:text-[#8A6A4B] focus:outline-none focus:ring-2 focus:ring-[#F6B24A]"
        />
        {loading ? <span className="absolute right-4 top-3.5 text-xs font-bold text-[#8A4B1F]">Recherche…</span> : null}
      </div>

      {panelVisible ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Résultats de recherche"
            className="fixed inset-x-0 z-[55] mx-auto w-full max-w-[1280px] px-2 sm:px-4"
            style={fullScreenDetail ? { top: 0, bottom: 0 } : { top: panelTop, bottom: 12 }}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#D99A4A] bg-[#FFFBF2] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E2C79B] px-4 py-2">
                <span className="text-xs font-bold uppercase text-[#8A4B1F]">
                  {loading ? 'Recherche…' : results && !vague ? `${count} résultat${count > 1 ? 's' : ''}` : ''}
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fermer la recherche"
                  className="rounded-md px-2 py-1 text-lg font-black leading-none text-[#512A16] hover:bg-[#FFF2CF]"
                >
                  ×
                </button>
              </div>

              {error ? <p className="m-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

              {!error && vague ? (
                <p className="m-4 text-sm font-semibold text-[#512A16]">
                  Précisez le nom du plat ou du produit recherché (par exemple « recette mousse au chocolat »).
                </p>
              ) : null}

              {!error && !vague && allergenSearch && results !== null && plats.length === 0 ? (
                <p className="border-b border-[#E2C79B] bg-red-50 px-4 py-2 text-xs font-semibold text-red-800">
                  Aucun plat correspondant dans le tableau des allergènes (ou aucun tableau déposé pour ce site). Consultez le document officiel.
                </p>
              ) : null}

              {!error && !vague && results !== null && count === 0 ? (
                <p className="m-4 text-sm font-semibold text-[#512A16]">Aucun résultat pour « {trimmed} ».</p>
              ) : null}

              {!error && allergenSearch && allergenPartial && plats.length > 0 ? (
                <p className="border-b border-orange-300 bg-orange-100 px-4 py-2 text-sm font-black text-orange-900" role="alert">
                  {ALLERGEN_APPROXIMATE_BANNER}
                </p>
              ) : null}

              {!error && partial && count > 0 ? (
                <p className="border-b border-[#E2C79B] bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900">
                  Aucune fiche ne contient tous les mots : voici celles qui en contiennent au moins un.
                </p>
              ) : null}

              {!error && count > 0 ? (
                <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(280px,380px)_1fr]">
                  {showList ? (
                    <ul ref={listRef} className="min-h-0 divide-y divide-[#F0E2C8] overflow-y-auto border-[#E2C79B] md:border-r">
                      {entries.map((entry, index) => (
                        <li key={entry.kind === 'allergene' ? `a-${entry.plat.id}` : entry.result.id}>
                          <button
                            type="button"
                            onClick={() => { select(index); setMobileDetail(true); }}
                            className={`block w-full px-4 py-3 text-left ${index === selected ? 'bg-[#FFF2CF]' : 'hover:bg-[#FFF8E8]'}`}
                          >
                            {entry.kind === 'allergene' ? (
                              <>
                                <div className="text-sm font-black text-[#3A2116]">
                                  <Highlighted text={toDisplayCase(entry.plat.nom)} terms={terms} />
                                </div>
                                <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black uppercase text-red-800">
                                  Allergènes
                                </span>
                                <div className="mt-1 line-clamp-2 text-xs text-[#6B4A33]">{flaggedSummary(entry.plat)}</div>
                              </>
                            ) : (
                              <>
                                <div className="text-sm font-black text-[#3A2116]">
                                  {entry.result.titre ? toDisplayCase(splitTitle(entry.result.titre).principal) : `Page ${entry.result.page}`}
                                </div>
                                <span className="mt-1 inline-block rounded-full bg-[#FFF2CF] px-2 py-0.5 text-[11px] font-bold text-[#512A16]">
                                  {entry.result.poste} · p. {entry.result.page}
                                </span>
                                <div className="mt-1 line-clamp-1 text-xs text-[#6B4A33]">
                                  <Highlighted text={toDisplayCase(stripMarks(entry.result.extrait))} terms={terms} />
                                </div>
                              </>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {showDetail && !current ? (
                    <div className="flex min-h-0 items-center justify-center p-6 text-center text-sm font-semibold text-[#6B4A33]">
                      Choisis le plat dans la liste.
                    </div>
                  ) : null}
                  {showDetail && current ? (
                    <div className="min-h-0">
                      {(() => {
                        const onBack = stack.length > 0
                          ? () => setStack((items) => items.slice(0, -1))
                          : !isDesktop
                            ? () => setMobileDetail(false)
                            : null;
                        const shownBack = stack.length > 0 ? backLabel : null;
                        return current.kind === 'allergene' ? (
                          <AllergenCard plat={current.plat} approximate={current.approximate} backLabel={shownBack} onBack={onBack} onError={setError} />
                        ) : (
                          <FicheView
                            model={current.fiche}
                            terms={terms}
                            canManage={canManage}
                            titles={titles}
                            backLabel={shownBack}
                            onBack={onBack}
                            onSubFiche={(name) => void handleSubFiche(name)}
                            allergenLink={allergenLink}
                            onOpenAllergen={(plat) => setStack((items) => [...items, { kind: 'allergene', plat, approximate: false }])}
                            onError={setError}
                          />
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
};

export default ManualSearch;
