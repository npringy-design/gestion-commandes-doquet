// Accès Supabase aux allergènes : tableau déposé par site, remplacement atomique,
// recherche par plat et lien avec les fiches techniques. La lecture du PDF
// elle-même est dans utils/allergenReader.ts (module pur).

import { supabase } from './supabaseClient';
import { ALLERGEN_CODES, type AllergenCode } from '../utils/manualConstants';
import { type AllergenDocument, type AllergenReadResult } from '../utils/allergenReader';
import { readAllergenPdf } from '../utils/allergenPdfReader';
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
    .select('id, site, nom_fichier, chemin_stockage, date_mise_a_jour, date_trouvee, nb_plats, depose_le')
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

// Recherche par nom de plat (termes déjà nettoyés : ni synonymes ni mots vides).
export async function rechercherAllergenes(site: string, terms: string[], mode: 'tous' | 'un'): Promise<AllergenPlat[]> {
  if (terms.length === 0) return [];
  const { data, error } = await client().rpc('rechercher_allergenes', { p_site: site, p_termes: terms, p_mode: mode });
  if (error) throw new Error(error.message);
  const plats: AllergenPlat[] = [];
  for (const row of Array.isArray(data) ? (data as unknown[]) : []) {
    if (!isRecord(row)) continue;
    plats.push({
      id: String(row.id),
      nom: String(row.nom ?? ''),
      categorie: typeof row.categorie === 'string' ? row.categorie : '',
      allergenes: toCodes(row.allergenes),
      page: Number(row.page ?? 1),
      nomFichier: String(row.nom_fichier ?? ''),
      cheminStockage: String(row.chemin_stockage ?? ''),
      dateMiseAJour: String(row.date_mise_a_jour ?? ''),
      dateTrouvee: row.date_trouvee !== false,
    });
  }
  return plats;
}

// Lien entre une fiche technique et le tableau des allergènes : correspondance
// EXACTE du nom normalisé uniquement. Sans correspondance, rien ne s'affiche.
export async function trouverAllergenesParNoms(site: string, names: string[]): Promise<AllergenPlat | null> {
  const keys = [...new Set(names.map((name) => normalizeText(name)).filter((key) => key.length > 0))];
  if (keys.length === 0) return null;
  const { data, error } = await client()
    .from('allergenes_plats')
    .select('id, nom, categorie, allergenes, page, nom_normalise, allergenes_documents(nom_fichier, chemin_stockage, date_mise_a_jour, date_trouvee)')
    .eq('site', site)
    .in('nom_normalise', keys)
    .limit(5);
  if (error) throw new Error(error.message);
  for (const row of Array.isArray(data) ? (data as unknown[]) : []) {
    if (!isRecord(row)) continue;
    const embedded = Array.isArray(row.allergenes_documents) ? row.allergenes_documents[0] : row.allergenes_documents;
    if (!isRecord(embedded) || typeof row.nom_normalise !== 'string' || !keys.includes(row.nom_normalise)) continue;
    return {
      id: String(row.id),
      nom: String(row.nom ?? ''),
      categorie: typeof row.categorie === 'string' ? row.categorie : '',
      allergenes: toCodes(row.allergenes),
      page: Number(row.page ?? 1),
      nomFichier: String(embedded.nom_fichier ?? ''),
      cheminStockage: String(embedded.chemin_stockage ?? ''),
      dateMiseAJour: String(embedded.date_mise_a_jour ?? ''),
      dateTrouvee: embedded.date_trouvee !== false,
    };
  }
  return null;
}
