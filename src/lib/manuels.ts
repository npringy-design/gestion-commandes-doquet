// Accès Supabase aux manuels opératoires : dépôt, réindexation, réglages,
// synonymes et recherche. Le découpage lui-même est dans utils/manualIndexer.ts.

import { supabase } from './supabaseClient';
import {
  DEFAULT_UNITS,
  SECTION_TYPES,
  buildManualRows,
  matchKey,
  normalizeText,
  type HeaderRule,
  type ManualIndex,
  type ManualIndexSettings,
  type LineKind,
  type ManualSection,
  type SectionLine,
  type SectionType,
  type SubLine,
} from '../utils/manualIndexer';
import { readManualPdf } from '../utils/manualPdfReader';

const BUCKET = 'manuels-operatoires';

export interface ManuelRecord {
  id: string;
  site: string;
  poste: string;
  nom_fichier: string;
  chemin_stockage: string;
  nb_pages: number;
  nb_fiches: number;
  niveau_obtenu: number;
  depose_le: string;
}

export interface SynonymeRecord {
  id: string;
  mot: string;
  type_rubrique: SectionType;
}

export interface SearchResult {
  id: string;
  type: 'page' | 'fiche';
  titre: string | null;
  poste: string;
  page: number;
  manuelId: string;
  cheminStockage: string;
  rubriquesCiblees: SectionType[];
  sections: ManualSection[];
  sousFiches: string[];
  extrait: string;
  score: number;
  formatVersion: number;
}

export interface FicheDetail {
  titre: string;
  poste: string;
  page: number;
  cheminStockage: string;
  sections: ManualSection[];
  formatVersion: number;
}

const client = () => {
  if (!supabase) throw new Error('Supabase n’est pas configuré.');
  return supabase;
};

const isSectionType = (value: unknown): value is SectionType =>
  typeof value === 'string' && (SECTION_TYPES as readonly string[]).includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const LINE_KINDS: readonly string[] = ['ingredient', 'etape', 'puce', 'texte'];

const optionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const parseSubLines = (value: unknown): SubLine[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const result: SubLine[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.brut !== 'string') continue;
    result.push({ brut: entry.brut, affichage: typeof entry.affichage === 'string' ? entry.affichage : entry.brut });
  }
  return result.length > 0 ? result : undefined;
};

const parseLignes = (value: unknown): SectionLine[] => {
  if (!Array.isArray(value)) return [];
  const lignes: SectionLine[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.brut !== 'string' || typeof entry.kind !== 'string' || !LINE_KINDS.includes(entry.kind)) continue;
    const quantite = optionalString(entry.quantite);
    const unite = optionalString(entry.unite);
    const produit = optionalString(entry.produit);
    const sousFiche = optionalString(entry.sous_fiche);
    const numero = optionalString(entry.numero);
    const sousLignes = parseSubLines(entry.sous_lignes);
    lignes.push({
      kind: entry.kind as LineKind,
      brut: entry.brut,
      affichage: typeof entry.affichage === 'string' ? entry.affichage : entry.brut,
      ...(quantite !== undefined ? { quantite } : {}),
      ...(unite !== undefined ? { unite } : {}),
      ...(produit !== undefined ? { produit } : {}),
      ...(sousFiche !== undefined ? { sousFiche } : {}),
      ...(numero !== undefined ? { numero } : {}),
      ...(sousLignes ? { sousLignes } : {}),
    });
  }
  return lignes;
};

const parseSections = (value: unknown): ManualSection[] => {
  if (!Array.isArray(value)) return [];
  const sections: ManualSection[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    sections.push({
      typeRubrique: isSectionType(entry.type_rubrique) ? entry.type_rubrique : 'autre',
      libelle: typeof entry.libelle === 'string' ? entry.libelle : '',
      texte: typeof entry.texte === 'string' ? entry.texte : '',
      lignes: parseLignes(entry.lignes),
    });
  }
  return sections;
};

const parseHeaders = (value: unknown): HeaderRule[] => {
  if (!Array.isArray(value)) return [];
  const headers: HeaderRule[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.texte !== 'string' || !isSectionType(entry.type_rubrique)) continue;
    headers.push({ text: entry.texte, type: entry.type_rubrique });
  }
  return headers;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

// ---------------------------------------------------------------------------
// Lecture d'un PDF
// ---------------------------------------------------------------------------

export async function indexPdfData(data: ArrayBuffer, settings: ManualIndexSettings): Promise<ManualIndex> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    const doc = await task.promise;
    return await readManualPdf(doc, settings);
  } finally {
    await task.destroy();
  }
}

// MANUEL_OPERATOIRE_CHAUD_2024.pdf -> « Chaud »
export function guessPosteFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
  const match = /manuel\s+op[eé]ratoire\s+(.+)$/i.exec(base);
  const words = (match ? match[1] : base).split(/[\s-]+/).filter((word) => word.length > 0);
  const kept: string[] = [];
  for (const word of words) {
    if (/\d/.test(word)) break;
    kept.push(word);
  }
  const text = (kept.length > 0 ? kept : words).join(' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Manuels
// ---------------------------------------------------------------------------

export async function listManuels(site: string): Promise<ManuelRecord[]> {
  const { data, error } = await client()
    .from('fiches_manuels')
    .select('id, site, poste, nom_fichier, chemin_stockage, nb_pages, nb_fiches, niveau_obtenu, depose_le')
    .eq('site', site)
    .order('poste');
  if (error) throw new Error(error.message);
  return (data ?? []) as ManuelRecord[];
}

const slug = (value: string) =>
  normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'manuel';

// Dépôt atomique : le nouveau PDF est envoyé sous un nom unique, la base bascule
// en une seule transaction (remplacer_manuel), puis l'ancien fichier est supprimé.
// En cas d'échec avant la bascule, l'ancien manuel reste intact.
export async function deposerManuel(params: {
  site: string;
  poste: string;
  file: File;
  index: ManualIndex;
}): Promise<void> {
  const { site, poste, file, index } = params;
  const sb = client();
  const existing = await sb.from('fiches_manuels').select('chemin_stockage').eq('site', site).eq('poste', poste).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const previousPath = (existing.data as { chemin_stockage: string } | null)?.chemin_stockage ?? null;

  const path = `${site}/${slug(poste)}-${Date.now().toString(36)}.pdf`;
  const upload = await sb.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (upload.error) throw new Error(upload.error.message);

  const rpc = await sb.rpc('remplacer_manuel', {
    p_site: site,
    p_poste: poste,
    p_nom_fichier: file.name,
    p_chemin: path,
    p_nb_pages: index.nbPages,
    p_niveau: index.niveau,
    p_lignes: buildManualRows(index),
  });
  if (rpc.error) {
    await sb.storage.from(BUCKET).remove([path]);
    throw new Error(rpc.error.message);
  }
  if (previousPath && previousPath !== path) await sb.storage.from(BUCKET).remove([previousPath]);
}

export async function reindexerManuel(manuel: ManuelRecord, settings: ManualIndexSettings): Promise<ManualIndex> {
  const sb = client();
  const download = await sb.storage.from(BUCKET).download(manuel.chemin_stockage);
  if (download.error || !download.data) throw new Error(download.error?.message ?? 'Fichier introuvable.');
  const index = await indexPdfData(await download.data.arrayBuffer(), settings);
  const rpc = await sb.rpc('reindexer_manuel', {
    p_manuel: manuel.id,
    p_niveau: index.niveau,
    p_lignes: buildManualRows(index),
  });
  if (rpc.error) throw new Error(rpc.error.message);
  return index;
}

export async function supprimerManuel(manuel: ManuelRecord): Promise<void> {
  const sb = client();
  const { error } = await sb.from('fiches_manuels').delete().eq('id', manuel.id);
  if (error) throw new Error(error.message);
  await sb.storage.from(BUCKET).remove([manuel.chemin_stockage]);
}

export async function urlPdf(cheminStockage: string, page: number): Promise<string> {
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(cheminStockage, 3600);
  if (error || !data) throw new Error(error?.message ?? 'Lien du PDF indisponible.');
  return `${data.signedUrl}#page=${Math.max(1, page)}`;
}

// ---------------------------------------------------------------------------
// Réglages et synonymes
// ---------------------------------------------------------------------------

export const EMPTY_SETTINGS: ManualIndexSettings = { headers: [], ignoredLines: [], subFichePrefix: '', units: [...DEFAULT_UNITS] };

export async function loadSettings(site: string): Promise<ManualIndexSettings> {
  const { data, error } = await client()
    .from('fiches_reglages')
    .select('entetes, lignes_ignorees, prefixe_sous_fiche, unites')
    .eq('site', site)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return EMPTY_SETTINGS;
  const row = data as { entetes: unknown; lignes_ignorees: unknown; prefixe_sous_fiche: unknown; unites: unknown };
  return {
    headers: parseHeaders(row.entetes),
    ignoredLines: toStringArray(row.lignes_ignorees),
    subFichePrefix: typeof row.prefixe_sous_fiche === 'string' ? row.prefixe_sous_fiche : '',
    units: Array.isArray(row.unites) ? toStringArray(row.unites) : [...DEFAULT_UNITS],
  };
}

export async function saveSettings(site: string, settings: ManualIndexSettings): Promise<void> {
  const { error } = await client().from('fiches_reglages').upsert({
    site,
    entetes: settings.headers
      .filter((header) => header.text.trim().length > 0)
      .map((header) => ({ texte: header.text.trim(), type_rubrique: header.type })),
    lignes_ignorees: settings.ignoredLines.map((line) => line.trim()).filter((line) => line.length > 0),
    prefixe_sous_fiche: settings.subFichePrefix.trim(),
    unites: settings.units.map((unit) => normalizeText(unit)).filter((unit) => unit.length > 0),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function listSynonymes(site: string): Promise<SynonymeRecord[]> {
  const { data, error } = await client().from('fiches_synonymes').select('id, mot, type_rubrique').eq('site', site).order('type_rubrique').order('mot');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; mot: string; type_rubrique: unknown }[]).filter(
    (row): row is SynonymeRecord => isSectionType(row.type_rubrique),
  );
}

export async function addSynonyme(site: string, mot: string, type: SectionType): Promise<void> {
  const normalized = normalizeText(mot).replace(/[^a-z0-9]+/g, '');
  if (!normalized) throw new Error('Mot invalide.');
  const { error } = await client().from('fiches_synonymes').upsert(
    { site, mot: normalized, type_rubrique: type },
    { onConflict: 'site,mot,type_rubrique', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function deleteSynonyme(id: string): Promise<void> {
  const { error } = await client().from('fiches_synonymes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------

export async function rechercherFiches(site: string, requete: string): Promise<SearchResult[]> {
  const { data, error } = await client().rpc('rechercher_fiches', { p_site: site, p_requete: requete });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? (data as unknown[]) : [];
  const results: SearchResult[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    results.push({
      id: String(row.id),
      type: row.type === 'page' ? 'page' : 'fiche',
      titre: typeof row.titre === 'string' ? row.titre : null,
      poste: String(row.poste ?? ''),
      page: Number(row.page ?? 1),
      manuelId: String(row.manuel_id),
      cheminStockage: String(row.chemin_stockage ?? ''),
      rubriquesCiblees: toStringArray(row.rubriques_ciblees).filter(isSectionType),
      sections: parseSections(row.sections),
      sousFiches: toStringArray(row.sous_fiches),
      extrait: typeof row.extrait === 'string' ? row.extrait : '',
      score: Number(row.score ?? 0),
      formatVersion: Number(row.format_version ?? 1),
    });
  }
  return results;
}

// Fiche du même titre normalisé dans les manuels du site (de préférence « sous-fiches »).
export async function trouverFicheParTitre(site: string, titreNormalise: string): Promise<FicheDetail | null> {
  const sb = client();
  const { data, error } = await sb
    .from('fiches_operatoires')
    .select('titre, poste, page, sections, manuel_id, format_version')
    .eq('site', site)
    .eq('type', 'fiche')
    .eq('titre_normalise', titreNormalise)
    .limit(10);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { titre: string | null; poste: string; page: number; sections: unknown; manuel_id: string; format_version: number }[];
  if (rows.length === 0) return null;
  const preferred = rows.find((row) => normalizeText(row.poste).includes('sous')) ?? rows[0];
  const manuel = await sb.from('fiches_manuels').select('chemin_stockage').eq('id', preferred.manuel_id).maybeSingle();
  if (manuel.error) throw new Error(manuel.error.message);
  const path = (manuel.data as { chemin_stockage: string } | null)?.chemin_stockage;
  if (!path) return null;
  return {
    titre: preferred.titre ?? titreNormalise,
    poste: preferred.poste,
    page: preferred.page,
    cheminStockage: path,
    sections: parseSections(preferred.sections),
    formatVersion: Number(preferred.format_version ?? 1),
  };
}

// Titres des fiches du site, pour n'afficher un lien de sous-fiche que si la
// fiche existe (rapprochement tolérant par clé, voir matchKey).
export async function listTitresFiches(site: string): Promise<Map<string, string>> {
  const { data, error } = await client()
    .from('fiches_operatoires')
    .select('titre_normalise')
    .eq('site', site)
    .eq('type', 'fiche');
  if (error) throw new Error(error.message);
  const keys = new Map<string, string>();
  for (const row of (data ?? []) as { titre_normalise: string }[]) {
    const key = matchKey(row.titre_normalise);
    if (key && !keys.has(key)) keys.set(key, row.titre_normalise);
  }
  return keys;
}
