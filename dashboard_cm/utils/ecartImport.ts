import * as XLSX from 'xlsx';

export type ProductType = 'LIQUIDE' | 'SOLIDE';
export type TypeSource = 'SECTEUR' | 'FOURNISSEUR' | 'HEURISTIQUE' | 'INCONNU';

export interface EcartRow {
  id: string;
  name: string;
  cleanName: string;
  quantity: number;
  value: number;
  unitPrice?: number;
  sector?: string;
  supplier?: string;
  type?: ProductType;
  typeSource?: TypeSource;
}

export function cleanLabel(label: string): string {
  return (label || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function parseNumberFr(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v)
    .replace(/\u00A0/g, ' ') // nbsp
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/€/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Tes règles de tri
 * - priorité au SECTEUR (si dispo)
 * - sinon FOURNISSEUR (si dispo)
 * - sinon heuristique mots-clés
 */
const LIQUID_SECTORS = new Set([
  cleanLabel('réserve alcool'),
  cleanLabel('réserve bière'),
  cleanLabel('réserve cafeterie'),
  cleanLabel('réserve soft'),
  cleanLabel('réserve vin et champagne'),
]);

const SOLID_SECTORS = new Set([
  cleanLabel('cf+ bof'),
  cleanLabel('cf+ viande'),
  cleanLabel('cf+ fruite et légume'),
  cleanLabel('cf+ fruits et légume'),
  cleanLabel('cf-'),
  cleanLabel('cf- glaces'),
  cleanLabel('réserve épicerie'),
]);

// Secteurs autorisés (on ignore tout le reste : hygiène, vêtements, etc.)
const ALLOWED_SECTORS = new Set<string>([...LIQUID_SECTORS, ...SOLID_SECTORS]);

// Produits à ignorer (jamais pris en compte)
// Match sur libellé "propre" : minuscules + accents retirés + espaces normalisés
const EXCLUDED_PRODUCTS = new Set([
  cleanLabel('Champagne AC GH Martel brut prestige bouteille 75cl'),
  cleanLabel('Mix gaz 4m3 azote/co2'),
]);

const LIQUID_SUPPLIERS = new Set([
  cleanLabel('doquet'),
  cleanLabel('richard vins'),
]);

// Fournisseurs solides connus (pas obligatoire; on met SOLIDE si fournisseur présent mais non liquide)
const SOLID_SUPPLIERS_HINTS = [
  cleanLabel('plaine maison'),
  cleanLabel('pomona terre azur'),
  cleanLabel('pomona episaveurs'),
  cleanLabel('domafrais'),
];

const LIQUIDE_KEYWORDS = [
  'biere', 'beer', '1664', 'kronenbourg', 'grim', 'heine', 'desperados',
  'vin', 'bordeaux', 'bourgogne', 'cotes', 'champagne', 'prosecco',
  'ricard', 'pastis', 'armagnac', 'cognac', 'whisky', 'vodka', 'rhum', 'gin',
  'coca', 'pepsi', 'fanta', 'sprite', 'ice tea', 'icetea', 'orangina',
  'eau', 'san pellegrino', 'perrier', 'vittel', 'evian',
  'jus', 'nectar', 'limonade', 'sirop', 'schweppes', 'tonic',
  'boisson', 'cocktail', 'mocktail',
];

export function guessType(cleanName: string): ProductType {
  for (const k of LIQUIDE_KEYWORDS) {
    if (cleanName.includes(k)) return 'LIQUIDE';
  }
  return 'SOLIDE';
}

export function determineType(params: { sector?: string; supplier?: string; cleanName: string }): { type: ProductType; source: TypeSource } {
  const sectorClean = params.sector ? cleanLabel(params.sector) : '';
  const supplierClean = params.supplier ? cleanLabel(params.supplier) : '';

  if (sectorClean) {
    if (LIQUID_SECTORS.has(sectorClean)) return { type: 'LIQUIDE', source: 'SECTEUR' };
    if (SOLID_SECTORS.has(sectorClean)) return { type: 'SOLIDE', source: 'SECTEUR' };
  }

  if (supplierClean) {
    if (LIQUID_SUPPLIERS.has(supplierClean)) return { type: 'LIQUIDE', source: 'FOURNISSEUR' };
    // Si c'est un fournisseur connu solide, on force SOLIDE
    if (SOLID_SUPPLIERS_HINTS.some(s => supplierClean.includes(s))) return { type: 'SOLIDE', source: 'FOURNISSEUR' };
    // Sinon, on considère "le reste = solide" comme tu l'as demandé
    return { type: 'SOLIDE', source: 'FOURNISSEUR' };
  }

  // fallback heuristique
  return { type: guessType(params.cleanName), source: 'HEURISTIQUE' };
}

function looksLikeHeaderRow(r: any[]): boolean {
  const a = cleanLabel(r?.[0] ?? '');
  const b = cleanLabel(r?.[1] ?? '');
  return (
    a === 'produit' ||
    a === 'article' ||
    a.includes('libelle') ||
    (a.includes('produit') && (b.includes('secteur') || b.includes('fournisseur')))
  );
}

function findColumnIndexes(rows: any[][]): { sectorIdx: number | null; supplierIdx: number | null; puIdx: number | null } {
  // scan first 15 rows for a header row that contains "secteur" / "fournisseur"
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i] ?? [];
    for (let c = 0; c < r.length; c++) {
      const v = cleanLabel(r[c] ?? '');
      if (!v) continue;
      // For robustness, accept variations
      if (v === 'secteur' || v.includes('secteur') || v.includes('zone') || v.includes('emplacement')) {
        // We assume this is a header row; sector in same column on subsequent rows
        // But do not immediately return; supplier might be in another col
      }
    }

    const idxSect = r.findIndex(cell => {
      const v = cleanLabel(cell ?? '');
      return v === 'secteur' || v.includes('secteur') || v.includes('zone') || v.includes('emplacement');
    });
    const idxFou = r.findIndex(cell => {
      const v = cleanLabel(cell ?? '');
      return v === 'fournisseur' || v.includes('fournisseur') || v.includes('supplier');
    });

    const idxPu = r.findIndex(cell => {
      const v = cleanLabel(cell ?? '');
      // Ton export : colonne "PU" (prix unitaire)
      return v === 'pu' || v.includes('prix unitaire') || v.includes('p.u') || v.includes('€/') || v.includes('eur/') || v.includes('valeur unitaire');
    });

    if (idxSect !== -1 || idxFou !== -1 || idxPu !== -1) {
      return {
        sectorIdx: idxSect !== -1 ? idxSect : null,
        supplierIdx: idxFou !== -1 ? idxFou : null,
        puIdx: idxPu !== -1 ? idxPu : null,
      };
    }
  }

  return { sectorIdx: null, supplierIdx: null, puIdx: null };
}

function isBlockLabel(cellValue: string): boolean {
  const v = cleanLabel(cellValue);
  if (!v) return false;
  // Accept generic sector headers even if not in our known sets (e.g. "Réserve Bar", "Réserve Libre", etc.)
  if (v.startsWith('reserve') || v.startsWith('cf')) return true;
  if (LIQUID_SECTORS.has(v) || SOLID_SECTORS.has(v)) return true;
  // supplier blocks
  if (LIQUID_SUPPLIERS.has(v)) return true;
  if (SOLID_SUPPLIERS_HINTS.some(s => v.includes(s))) return true;
  // Sometimes exports include prefixes like "fournisseur : doquet"
  if (v.startsWith('fournisseur') && (v.includes('doquet') || v.includes('richard') || v.includes('domafrais') || v.includes('pomona') || v.includes('plaine'))) return true;
  return false;
}

function extractSupplierFromBlockLabel(label: string): string {
  const v = cleanLabel(label);
  if (v.includes('doquet')) return 'Doquet';
  if (v.includes('richard')) return 'Richard Vins';
  if (v.includes('plaine')) return 'Plaine Maison';
  if (v.includes('terre azur')) return 'Pomona Terre Azur';
  if (v.includes('episaveurs')) return 'Pomona Episaveurs';
  if (v.includes('domafrais')) return 'Domafrais';
  return label.trim();
}

function extractSectorFromBlockLabel(label: string): string {
  // Keep original label as sector; it will be cleaned during classification
  return label.trim();
}

function fromRows(rows: any[][]): EcartRow[] {
  const out: EcartRow[] = [];

  // --- Format "Export consolidé" (détection par en-têtes) ---
  // IMPORTANT : sur certains exports, la ligne d'en-tête n'est PAS la première
  // (lignes vides, titre, etc.). On la cherche donc dans les 15 premières lignes.
  // Exemple d'en-têtes:
  // - Destination de Stock
  // - Produit
  // - Démarque inconnue Qté
  // - Démarque inconnue Total
  // - Conso réelle prix UHT (utile comme PU si pas de colonne PU)

  const wantedA = cleanLabel('démarque inconnue qté');
  const wantedB = cleanLabel('démarque inconnue total');
  const wantedProd = cleanLabel('produit');
  const wantedSect = cleanLabel('destination de stock');

  let headerRowIndex = 0;
  let header: string[] = (rows[0] ?? []).map(c => cleanLabel(String(c ?? '')));
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = (rows[i] ?? []).map(c => cleanLabel(String(c ?? '')));
    const looks = h.includes(wantedA) && h.includes(wantedB) && (h.includes(wantedProd) || h.some(x => x.includes(wantedProd))) && (h.includes(wantedSect) || h.some(x => x.includes(wantedSect)));
    if (looks) {
      headerRowIndex = i;
      header = h;
      break;
    }
  }
  const isConsolidated = header.includes(wantedA) && header.includes(wantedB);

  if (isConsolidated) {
    const idxProduit = header.findIndex(h => h === 'produit');
    const idxSector = header.findIndex(h => h === cleanLabel('destination de stock'));
    const idxQty = header.findIndex(h => h === cleanLabel('démarque inconnue qté'));
    const idxVal = header.findIndex(h => h === cleanLabel('démarque inconnue total'));
    // PU : soit une vraie colonne "PU", soit "Conso réelle prix UHT"
    const idxPU = header.findIndex(h => h === 'pu');
    const idxUht = header.findIndex(h => h === cleanLabel('conso réelle prix uht'));

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      const name = String(r[idxProduit] ?? '').trim();
      if (!name || cleanLabel(name) === 'produit') continue;

      const cleanName = cleanLabel(name);
      // Produits exclus (ex : Martel / Mix gaz)
      if (EXCLUDED_PRODUCTS.has(cleanName)) continue;

      const sector = idxSector >= 0 ? String(r[idxSector] ?? '').trim() : '';

      // Dans l'export consolidé, on ne veut garder QUE les secteurs définis ensemble.
      // Tout ce qui est hygiène, vêtements, etc. est ignoré.
      const sectorClean = sector ? cleanLabel(sector) : '';
      if (sectorClean && !ALLOWED_SECTORS.has(sectorClean)) {
        continue;
      }

      const qty = idxQty >= 0 ? parseNumberFr(r[idxQty]) : 0;
      const val = idxVal >= 0 ? parseNumberFr(r[idxVal]) : 0;
      const unitPrice = idxPU >= 0 ? parseNumberFr(r[idxPU]) : (idxUht >= 0 ? parseNumberFr(r[idxUht]) : 0);

      const { type, source } = determineType({ sector: sector || undefined, supplier: undefined, cleanName });

      out.push({
        id: cleanName,
        name,
        cleanName,
        quantity: qty,
        value: val,
        unitPrice: unitPrice === 0 ? undefined : unitPrice,
        sector: sector || undefined,
        supplier: undefined,
        type,
        typeSource: source,
      });
    }

    return out;
  }

  // --- Format "Écart inventaire" historique (A/I/J + blocs) ---
  // A = produit, I = ecart quantité, J = ecart € (0-indexed: 0, 8, 9)
  const { sectorIdx, supplierIdx, puIdx } = findColumnIndexes(rows);

  let currentSector: string | undefined = undefined;
  let currentSupplier: string | undefined = undefined;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    // Skip header rows
    if (looksLikeHeaderRow(r)) continue;

    const firstCell = (r[0] ?? '').toString().trim();
    const cleanFirst = cleanLabel(firstCell);

    // Detect "block labels" (sector or supplier) when file is grouped
    if (firstCell && isBlockLabel(firstCell) && (!r[8] && !r[9])) {
      // decide if it's sector-like or supplier-like
      if (LIQUID_SECTORS.has(cleanFirst) || SOLID_SECTORS.has(cleanFirst) || cleanFirst.startsWith('reserve') || cleanFirst.startsWith('cf')) {
        currentSector = extractSectorFromBlockLabel(firstCell);
      } else {
        currentSupplier = extractSupplierFromBlockLabel(firstCell);
      }
      continue;
    }

    const name = firstCell;
    if (!name) continue;

    const qty = parseNumberFr(r[8]);
    const val = parseNumberFr(r[9]);
    const unitPrice = puIdx != null ? parseNumberFr(r[puIdx]) : undefined;
    const cleanName = cleanLabel(name);

    // Produits exclus (jamais pris en compte)
    if (EXCLUDED_PRODUCTS.has(cleanName)) continue;

    // Sector/supplier per row (column) or inherited from blocks
    const sector = sectorIdx != null ? (r[sectorIdx] ?? '').toString().trim() : currentSector;
    const supplier = supplierIdx != null ? (r[supplierIdx] ?? '').toString().trim() : currentSupplier;

    const { type, source } = determineType({ sector, supplier, cleanName });

    out.push({
      id: cleanName,
      name,
      cleanName,
      quantity: qty,
      value: val,
      unitPrice: unitPrice === 0 ? undefined : unitPrice,
      sector: sector || undefined,
      supplier: supplier || undefined,
      type,
      typeSource: source,
    });
  }

  return out;
}


// --- CSV parsing robuste (gère les champs entre guillemets) ---
function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // double quote inside quoted field => escape
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === sep) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseEcartCsvText(text: string): EcartRow[] {
  const lines = (text || '').split(/
?
/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  // detect delimiter (;, 	, ,)
  const first = lines[0];
  const sep = first.includes(';') ? ';' : (first.includes('	') ? '	' : ',');
  const rows = lines.map(l => parseCsvLine(l, sep));
  return fromRows(rows);
}

export async function parseEcartFile(file: File): Promise<EcartRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  // CSV/TXT
  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const sep = lines[0]?.includes(';') ? ';' : ',';
    const rows = lines.map(l => l.split(sep));
    return fromRows(rows);
  }

  // XLS/XLSX
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const first = wb.SheetNames[0];
  const ws = wb.Sheets[first];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];
  return fromRows(rows);
}
