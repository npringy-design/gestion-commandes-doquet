// Accès Supabase aux allergènes : tableau déposé par site, remplacement atomique,
// recherche par plat et lien avec les fiches techniques. La lecture du PDF
// elle-même est dans utils/allergenReader.ts (module pur).

import { supabase } from './supabaseClient';
import { ALLERGEN_CODES, type AllergenCode } from '../utils/manualConstants';
import { type AllergenDocument, type AllergenReadResult } from '../utils/allergenReader';
import { readAllergenPdf } from '../utils/allergenPdfReader';
import { groupDishes, type AllergenIgnoredLine } from '../utils/allergenReader';
import { normalizeText } from '../utils/manualIndexer';

const BUCKET = 'manuels-operatoires';

export interface AllergenDocRecord {
  id: string;
  site: string;
  nom_fichier: string;
  chemin_stockage: string;
  date_mise_a_jour: string;
  date_trouvee: boolean;
  nb_plats: number;
  // Lignes de la première colonne ignorées à la lecture (0 = tout a été reconnu).
  lignes_ignorees: number;
  depose_le: string;
}

// Plat du tableau des allergènes, avec les informations du document d'origine.
export interface AllergenPlat {
  id: string;
  nom: string;
  categorie: string;
  allergenes: AllergenCode[];
  page: number;
  nomFichier: string;
  cheminStockage: string;
  dateMiseAJour: string;
  dateTrouvee: boolean;
  // Catégories des autres lignes du même plat (mêmes allergènes) : « Aussi présent dans ».
  alsoIn: string[];
  // Même nom avec des allergènes différents ailleurs : résultats séparés, jamais ouverts seuls.
  conflict: boolean;
}

const client = () => {
  if (!supabase) throw new Error('Supabase n’est pas configuré.');
  return supabase;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toCodes = (value: unknown): AllergenCode[] =>
  Array.isArray(value)
    ? ALLERGEN_CODES.filter((code) => value.includes(code))
    : [];

// JJ/MM/AAAA à partir d'une date AAAA-MM-JJ.
export function formatAllergenDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

export async function indexAllergenPdf(data: ArrayBuffer): Promise<AllergenReadResult> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    const doc = await task.promise;
    return await readAllergenPdf(doc, pdfjs.OPS);
  } finally {
    await task.destroy();
  }
}

export async function getAllergenDocument(site: string): Promise<AllergenDocRecord | null> {
  const { data, error } = await client()
    .from('allergenes_documents')
    .select('id, site, nom_fichier, chemin_stockage, date_mise_a_jour, date_trouvee, nb_plats, lignes_ignorees, depose_le')
    .eq('site', site)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AllergenDocRecord | null) ?? null;
}

// Dépôt atomique : le PDF est envoyé sous un nom unique, la base bascule en une
// seule transaction (remplacer_allergenes), puis l'ancien fichier est supprimé.
// En cas d'échec avant la bascule, l'ancien document reste intact.
export async function deposerAllergenes(params: { site: string; file: File; document: AllergenDocument }): Promise<void> {
  const { site, file, document } = params;
  const sb = client();
  const existing = await sb.from('allergenes_documents').select('chemin_stockage').eq('site', site).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const previousPath = (existing.data as { chemin_stockage: string } | null)?.chemin_stockage ?? null;

  const path = `${site}/allergenes-${Date.now().toString(36)}.pdf`;
  const upload = await sb.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (upload.error) throw new Error(upload.error.message);

  const today = new Date().toISOString().slice(0, 10);
  const rpc = await sb.rpc('remplacer_allergenes', {
    p_site: site,
    p_nom_fichier: file.name,
    p_chemin: path,
    p_date: document.date ?? today,
    p_date_trouvee: document.date !== null,
    p_lignes_ignorees: document.ignorees.length,
    p_plats: document.plats.map((plat) => ({
      categorie: plat.categorie,
      nom: plat.nom,
      nom_normalise: plat.nomNormalise,
      allergenes: plat.allergenes,
      page: plat.page,
    })),
  });
  if (rpc.error) {
    await sb.storage.from(BUCKET).remove([path]);
    throw new Error(rpc.error.message);
  }
  if (previousPath && previousPath !== path) await sb.storage.from(BUCKET).remove([previousPath]);
}

export async function urlAllergenPdf(cheminStockage: string, page: number): Promise<string> {
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(cheminStockage, 3600);
  if (error || !data) throw new Error(error?.message ?? 'Lien du PDF indisponible.');
  return `${data.signedUrl}#page=${Math.max(1, page)}`;
}

const SELECT_PLAT =
  'id, nom, categorie, allergenes, page, nom_normalise, allergenes_documents(nom_fichier, chemin_stockage, date_mise_a_jour, date_trouvee)';

interface PlatLine {
  key: string;
  plat: AllergenPlat;
}

const toLine = (row: unknown): PlatLine | null => {
  if (!isRecord(row) || typeof row.nom_normalise !== 'string') return null;
  const embedded = Array.isArray(row.allergenes_documents) ? row.allergenes_documents[0] : row.allergenes_documents;
  if (!isRecord(embedded)) return null;
  return {
    key: row.nom_normalise,
    plat: {
      id: String(row.id),
      nom: String(row.nom ?? ''),
      categorie: typeof row.categorie === 'string' ? row.categorie : '',
      allergenes: toCodes(row.allergenes),
      page: Number(row.page ?? 1),
      nomFichier: String(embedded.nom_fichier ?? ''),
      cheminStockage: String(embedded.chemin_stockage ?? ''),
      dateMiseAJour: String(embedded.date_mise_a_jour ?? ''),
      dateTrouvee: embedded.date_trouvee !== false,
      alsoIn: [],
      conflict: false,
    },
  };
};

// TOUTES les lignes du site portant ces noms normalisés (pour regrouper sans rien omettre).
async function fetchLinesByKeys(site: string, keys: string[]): Promise<PlatLine[]> {
  if (keys.length === 0) return [];
  const { data, error } = await client().from('allergenes_plats').select(SELECT_PLAT).eq('site', site).in('nom_normalise', keys).limit(500);
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? (data as unknown[]) : []).map(toLine).filter((line): line is PlatLine => line !== null);
}

// Regroupe les lignes d'un même nom (allergènes strictement identiques) en un résultat ;
// si les allergènes diffèrent, résultats séparés marqués « conflit ».
function groupPlats(lines: AllergenPlat[]): AllergenPlat[] {
  return groupDishes(lines).map((group) => ({ ...group.item, alsoIn: group.alsoIn, conflict: group.conflict }));
}

// Recherche par nom de plat (termes déjà nettoyés : ni synonymes ni mots vides).
export async function rechercherAllergenes(site: string, terms: string[], mode: 'tous' | 'un'): Promise<AllergenPlat[]> {
  if (terms.length === 0) return [];
  const { data, error } = await client().rpc('rechercher_allergenes', { p_site: site, p_termes: terms, p_mode: mode });
  if (error) throw new Error(error.message);
  const found: AllergenPlat[] = [];
  for (const row of Array.isArray(data) ? (data as unknown[]) : []) {
    if (!isRecord(row)) continue;
    found.push({
      id: String(row.id),
      nom: String(row.nom ?? ''),
      categorie: typeof row.categorie === 'string' ? row.categorie : '',
      allergenes: toCodes(row.allergenes),
      page: Number(row.page ?? 1),
      nomFichier: String(row.nom_fichier ?? ''),
      cheminStockage: String(row.chemin_stockage ?? ''),
      dateMiseAJour: String(row.date_mise_a_jour ?? ''),
      dateTrouvee: row.date_trouvee !== false,
      alsoIn: [],
      conflict: false,
    });
  }
  // La recherche renvoie au plus 10 lignes : on recharge toutes les lignes des plats trouvés,
  // sinon un doublon aux allergènes différents pourrait être masqué.
  const keys = [...new Set(found.map((plat) => normalizeText(plat.nom)))];
  const all = await fetchLinesByKeys(site, keys);
  const lines: AllergenPlat[] = [];
  for (const key of keys) {
    const complete = all.filter((line) => line.key === key).map((line) => line.plat);
    lines.push(...(complete.length > 0 ? complete : found.filter((plat) => normalizeText(plat.nom) === key)));
  }
  return groupPlats(lines);
}

// Lien entre une fiche technique et le tableau des allergènes : correspondance
// EXACTE du nom normalisé uniquement. Sans correspondance, ou si le même nom existe
// avec des allergènes différents, rien ne s'affiche.
export async function trouverAllergenesParNoms(site: string, names: string[]): Promise<AllergenPlat | null> {
  const keys = [...new Set(names.map((name) => normalizeText(name)).filter((key) => key.length > 0))];
  const lines = await fetchLinesByKeys(site, keys);
  for (const key of keys) {
    const groups = groupPlats(lines.filter((line) => line.key === key).map((line) => line.plat));
    if (groups.length === 1) return groups[0];
    if (groups.length > 1) return null;
  }
  return null;
}

// Nombre de plats DISTINCTS (noms normalisés) du guide du site.
export async function countDistinctPlats(site: string): Promise<number> {
  const { data, error } = await client().from('allergenes_plats').select('nom_normalise').eq('site', site).limit(5000);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { nom_normalise: string }[]).map((row) => row.nom_normalise)).size;
}

// Relit le PDF déposé pour retrouver les lignes non reconnues (leurs textes ne sont pas stockés).
export async function readIgnoredLines(cheminStockage: string): Promise<AllergenIgnoredLine[]> {
  const download = await client().storage.from(BUCKET).download(cheminStockage);
  if (download.error || !download.data) throw new Error(download.error?.message ?? 'Fichier introuvable.');
  const result = await indexAllergenPdf(await download.data.arrayBuffer());
  if (!result.document) throw new Error(result.error ?? 'Lecture du PDF impossible.');
  return result.document.ignorees;
}
