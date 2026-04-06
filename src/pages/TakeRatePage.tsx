import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MONTHS_DISPLAY_CONFIG, STORAGE_PREFIX, View } from '../constants';

interface MarginCatalogItem {
  label: string;
  normalized: string;
  costHt: number | null;
  sellPriceHt: number | null;
  marginPercent: number | null;
  marginEuro: number | null;
  sourceSheet: string;
}

export interface TakeRateMappingRow {
  id: string;
  label: string;
  family: string;
  linkedImports: string[];
  costHt?: string;
  sellPriceHt?: string;
  marginPercent?: string;
  marginEuro?: string;
  marginSource?: 'auto' | 'manual' | '';
  matchedMarginLabel?: string;
  matchedMarginSheet?: string;
}

interface TakeRatePageProps {
  setView: (view: View) => void;
  prepImportsByMonth: Record<string, string>;
}

const ROWS_STORAGE_KEY = `${STORAGE_PREFIX}take_rate_rows_v2`;
const MARGIN_STORAGE_KEY = `${STORAGE_PREFIX}take_rate_margin_catalog_v1`;
const MARGIN_FILE_NAME_STORAGE_KEY = `${STORAGE_PREFIX}take_rate_margin_file_name_v1`;

const createEmptyRow = (): TakeRateMappingRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  label: '',
  family: '',
  linkedImports: [],
  costHt: '',
  sellPriceHt: '',
  marginPercent: '',
  marginEuro: '',
  marginSource: '',
  matchedMarginLabel: '',
  matchedMarginSheet: '',
});

const normalize = (value: string) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) => normalize(value).split(' ').filter(Boolean);

const parseCsvLine = (line: string, delimiter: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
};

const detectDelimiter = (input: string) => {
  const firstLine = input.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const candidates = [';', '\t', ','];
  let best = ';';
  let bestScore = -1;

  candidates.forEach((candidate) => {
    const score = firstLine.split(candidate).length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
};

const pickPreferredLabelColumn = (header: string[]) => {
  const exactPriority = [
    'libelle',
    'libellé',
    'label',
    'designation',
    'désignation',
    'article',
    'nom',
    'item',
  ].map(normalize);

  for (const preferred of exactPriority) {
    const exactIndex = header.findIndex((cell) => cell === preferred);
    if (exactIndex !== -1) return exactIndex;
  }

  const containsPriority = [
    'libelle',
    'libellé',
    'designation',
    'désignation',
    'article',
    'nom',
    'item',
    'produit',
  ].map(normalize);

  for (const preferred of containsPriority) {
    const containsIndex = header.findIndex((cell) => cell.includes(preferred));
    if (containsIndex !== -1) return containsIndex;
  }

  return 0;
};

const extractImportLabels = (content: string): string[] => {
  if (!content?.trim()) return [];

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(content);
  const header = parseCsvLine(lines[0], delimiter).map(normalize);
  const nameIndex = pickPreferredLabelColumn(header);

  const startIndex = lines.length > 1 ? 1 : 0;
  const labels: string[] = [];
  const seen = new Set<string>();

  for (let i = startIndex; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter);
    const label = String(cols[nameIndex] ?? '').trim();
    const normalized = normalize(label);
    if (!label || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    labels.push(label);
  }

  return labels;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\u00a0/g, ' ').replace(/€/g, '').replace(/%/g, '').replace(/\s/g, '').replace(',', '.');
  if (!cleaned || cleaned === '-') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDecimal = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '';
  return value.toFixed(2).replace('.', ',');
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '';
  const ratio = value <= 1 ? value * 100 : value;
  return ratio.toFixed(1).replace('.', ',');
};

const normalizeRow = (row: any): TakeRateMappingRow => ({
  id: String(row.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
  label: String(row.label ?? ''),
  family: String(row.family ?? ''),
  linkedImports: Array.isArray(row.linkedImports) ? row.linkedImports.map(String) : [],
  costHt: String(row.costHt ?? ''),
  sellPriceHt: String(row.sellPriceHt ?? ''),
  marginPercent: String(row.marginPercent ?? ''),
  marginEuro: String(row.marginEuro ?? ''),
  marginSource: row.marginSource === 'manual' || row.marginSource === 'auto' ? row.marginSource : '',
  matchedMarginLabel: String(row.matchedMarginLabel ?? ''),
  matchedMarginSheet: String(row.matchedMarginSheet ?? ''),
});

const GENERIC_MARGIN_TOKENS = new Set([
  'menu',
  'menus',
  'carte',
  'formule',
  'formules',
  'supp',
  'sup',
  'sauce',
  'poivre',
  'roquefort',
  'emporter',
  'hors',
  'take',
  'away',
  'avec',
  'sans',
  'plat',
  'plats',
  'dessert',
  'desserts',
]);

const scoreMatch = (label: string, item: MarginCatalogItem) => {
  const a = normalize(label);
  const b = item.normalized;
  if (!a || !b) return -1;
  if (a === b) return 1000;

  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (aTokens.length === 0 || bTokens.length === 0) return -1;

  const strongATokens = aTokens.filter((token) => !GENERIC_MARGIN_TOKENS.has(token));
  const strongBTokens = bTokens.filter((token) => !GENERIC_MARGIN_TOKENS.has(token));
  const effectiveATokens = strongATokens.length > 0 ? strongATokens : aTokens;
  const effectiveBTokens = strongBTokens.length > 0 ? strongBTokens : bTokens;

  const strongIntersection = effectiveATokens.filter((token) => effectiveBTokens.includes(token));
  if (strongIntersection.length === 0) return -1;

  const allIntersection = aTokens.filter((token) => bTokens.includes(token));
  const uniqueStrong = new Set([...effectiveATokens, ...effectiveBTokens]).size;
  const coverage = strongIntersection.length / Math.max(effectiveATokens.length, effectiveBTokens.length);
  const containmentBonus =
    strongIntersection.length === effectiveATokens.length || strongIntersection.length === effectiveBTokens.length ? 35 : 0;
  const exactStrongBonus = effectiveATokens.join(' ') === effectiveBTokens.join(' ') ? 250 : 0;
  const genericOnlyPenalty = allIntersection.every((token) => GENERIC_MARGIN_TOKENS.has(token)) ? 120 : 0;

  return coverage * 140 + (strongIntersection.length / uniqueStrong) * 80 + containmentBonus + exactStrongBonus - genericOnlyPenalty;
};

const findBestMarginMatch = (label: string, catalog: MarginCatalogItem[]) => {
  let best: MarginCatalogItem | null = null;
  let bestScore = -1;

  catalog.forEach((item) => {
    const score = scoreMatch(label, item);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  });

  if (bestScore < 60) return null;
  return best;
};

const buildMarginCatalogFromWorkbook = async (file: File): Promise<MarginCatalogItem[]> => {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sources = [
    { name: 'FOOD', productCol: 2, costCol: 6, sellCol: 8, marginCol: 13, startRow: 9 },
    { name: 'BOEUF ', productCol: 2, costCol: 9, sellCol: 11, marginCol: 16, startRow: 9 },
    { name: 'BOISSONS', productCol: 2, costCol: 5, sellCol: 8, marginCol: 13, startRow: 8 },
    { name: 'VINS_2025_-_2026', productCol: 2, costCol: 10, sellCol: 11, marginCol: 12, startRow: 9 },
    { name: 'FORMULES', productCol: 3, costCol: 6, sellCol: 8, marginCol: 11, startRow: 5 },
  ];

  const map = new Map<string, MarginCatalogItem>();

  sources.forEach((source) => {
    const sheet = workbook.Sheets[source.name];
    if (!sheet) return;

    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    for (let i = source.startRow; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const label = String(row[source.productCol] ?? '').trim();
      const normalized = normalize(label);
      if (!label || !normalized) continue;

      const costHt = toNumber(row[source.costCol]);
      const sellPriceHt = toNumber(row[source.sellCol]);
      const marginPercent = toNumber(row[source.marginCol]);
      const marginEuro =
        sellPriceHt !== null && costHt !== null ? sellPriceHt - costHt : null;

      if (costHt === null && sellPriceHt === null && marginPercent === null && marginEuro === null) continue;

      const existing = map.get(normalized);
      const candidate: MarginCatalogItem = {
        label,
        normalized,
        costHt,
        sellPriceHt,
        marginPercent,
        marginEuro,
        sourceSheet: source.name.trim(),
      };

      const existingScore = existing
        ? Number(existing.sellPriceHt !== null) + Number(existing.costHt !== null) + Number(existing.marginPercent !== null)
        : -1;
      const candidateScore = Number(candidate.sellPriceHt !== null) + Number(candidate.costHt !== null) + Number(candidate.marginPercent !== null);

      if (!existing || candidateScore >= existingScore) {
        map.set(normalized, candidate);
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
};

const TakeRatePage: React.FC<TakeRatePageProps> = ({ setView, prepImportsByMonth }) => {
  const [rows, setRows] = useState<TakeRateMappingRow[]>([]);
  const [searchByRow, setSearchByRow] = useState<Record<string, string>>({});
  const [openSearchRow, setOpenSearchRow] = useState<string | null>(null);
  const [openLinkedRow, setOpenLinkedRow] = useState<string | null>(null);
  const [marginCatalog, setMarginCatalog] = useState<MarginCatalogItem[]>([]);
  const [marginFileName, setMarginFileName] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [isImportingMargin, setIsImportingMargin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROWS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRows(parsed.map(normalizeRow));
          return;
        }
      }

      const legacyRaw = localStorage.getItem(`${STORAGE_PREFIX}take_rate_rows_v1`);
      if (legacyRaw) {
        const parsedLegacy = JSON.parse(legacyRaw);
        if (Array.isArray(parsedLegacy)) {
          setRows(parsedLegacy.map(normalizeRow));
        }
      }
    } catch (_error) {}
  }, []);

  useEffect(() => {
    localStorage.setItem(ROWS_STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MARGIN_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setMarginCatalog(parsed as MarginCatalogItem[]);
      }
      const storedName = localStorage.getItem(MARGIN_FILE_NAME_STORAGE_KEY) ?? '';
      setMarginFileName(storedName);
    } catch (_error) {}
  }, []);

  const availableImports = useMemo(() => {
    const unique = new Set<string>();
    MONTHS_DISPLAY_CONFIG.forEach(({ key }) => {
      extractImportLabels(prepImportsByMonth[key] ?? '').forEach((label) => unique.add(label));
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [prepImportsByMonth]);

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  const updateRow = (rowId: string, patch: Partial<TakeRateMappingRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, ...patch };
        if ('costHt' in patch || 'sellPriceHt' in patch || 'marginPercent' in patch || 'marginEuro' in patch) {
          next.marginSource = 'manual';
          return next;
        }
        if ('label' in patch && next.marginSource !== 'manual' && marginCatalog.length > 0) {
          return applyAutoMarginToRow(next);
        }
        return next;
      })
    );
  };

  const applyAutoMarginToRow = (row: TakeRateMappingRow) => {
    const match = findBestMarginMatch(row.label, marginCatalog);
    if (!match) {
      return {
        ...row,
        matchedMarginLabel: row.marginSource === 'manual' ? row.matchedMarginLabel : '',
        matchedMarginSheet: row.marginSource === 'manual' ? row.matchedMarginSheet : '',
      };
    }

    return {
      ...row,
      costHt: formatDecimal(match.costHt),
      sellPriceHt: formatDecimal(match.sellPriceHt),
      marginPercent: formatPercent(match.marginPercent),
      marginEuro: formatDecimal(match.marginEuro),
      marginSource: 'auto' as const,
      matchedMarginLabel: match.label,
      matchedMarginSheet: match.sourceSheet,
    };
  };

  const autoMatchAllRows = () => {
    if (marginCatalog.length === 0) return;
    setRows((prev) =>
      prev.map((row) => {
        if (!row.label.trim()) return row;
        if (row.marginSource === 'manual') return row;
        return applyAutoMarginToRow(row);
      })
    );
  };

  useEffect(() => {
    if (marginCatalog.length === 0) return;
    setRows((prev) =>
      prev.map((row) => {
        if (!row.label.trim()) return row;
        if (row.marginSource === 'manual') return row;
        return applyAutoMarginToRow(row);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marginCatalog]);

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
    setSearchByRow((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    if (openSearchRow === rowId) setOpenSearchRow(null);
    if (openLinkedRow === rowId) setOpenLinkedRow(null);
  };

  const addImportToRow = (rowId: string, importLabel: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId || row.linkedImports.includes(importLabel)) return row;
        return { ...row, linkedImports: [...row.linkedImports, importLabel] };
      })
    );
  };

  const removeImportFromRow = (rowId: string, importLabel: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, linkedImports: row.linkedImports.filter((item) => item !== importLabel) } : row
      )
    );
  };

  const filteredImportsByRow = useMemo(() => {
    const result: Record<string, string[]> = {};
    rows.forEach((row) => {
      const query = normalize(searchByRow[row.id] ?? '');
      const base = availableImports.filter((item) => !row.linkedImports.includes(item));
      result[row.id] = query ? base.filter((item) => normalize(item).includes(query)).slice(0, 50) : base.slice(0, 30);
    });
    return result;
  }, [availableImports, rows, searchByRow]);

  const linkedCount = rows.reduce((sum, row) => sum + row.linkedImports.length, 0);
  const autoMarginCount = rows.filter((row) => row.marginSource === 'auto').length;

  const handleImportMarginFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingMargin(true);
    setImportMessage('');

    try {
      const catalog = await buildMarginCatalogFromWorkbook(file);
      setMarginCatalog(catalog);
      setMarginFileName(file.name);
      localStorage.setItem(MARGIN_STORAGE_KEY, JSON.stringify(catalog));
      localStorage.setItem(MARGIN_FILE_NAME_STORAGE_KEY, file.name);
      setImportMessage(`${catalog.length} références marge chargées.`);
    } catch (_error) {
      setImportMessage('Import marge impossible. Vérifie le fichier ou la librairie xlsx.');
    } finally {
      setIsImportingMargin(false);
      if (event.target) event.target.value = '';
    }
  };

  return (
    <div className="flex h-full min-h-screen bg-[#EDE2D6] text-[#4B2D22]">
      <aside className="hidden w-[250px] shrink-0 border-r border-[#D2B8A1] bg-[linear-gradient(180deg,#F4E8DC_0%,#E9D8C8_100%)] px-4 py-5 xl:flex xl:flex-col xl:gap-4">
        <div className="overflow-hidden rounded-[26px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] shadow-[0_10px_20px_rgba(30,96,68,0.18)]">
          <div className="h-1.5 bg-gradient-to-r from-[#D4F3E4] via-[#8AE0B9] to-[#239062]" />
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#E7FFF3]">Paramétrage</p>
            <h1 className="mt-2 text-[21px] font-black leading-none text-white xl:text-[23px]">
              Taux
              <br />
              de prise
            </h1>
          </div>
        </div>

        <button
          onClick={() => setView('stats')}
          className="rounded-[22px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]"
        >
          Retour paramètres
        </button>

        <button
          onClick={() => setView('take_rate_sheet')}
          className="rounded-[22px] border border-[#B69034] bg-[linear-gradient(180deg,#E5B548_0%,#CC9530_100%)] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#9A691B] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#9A691B]"
        >
          Voir la feuille
        </button>

        <div className="rounded-[22px] border border-[#D7BFAB] bg-[#FFF8F1] px-4 py-4 shadow-[0_8px_18px_rgba(96,56,34,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#93644D]">Résumé</p>
          <div className="mt-3 space-y-2 text-[13px] font-semibold text-[#6E4736]">
            <div className="flex items-center justify-between gap-3"><span>Lignes</span><span>{rows.length}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Liens import</span><span>{linkedCount}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Marges auto</span><span>{autoMarginCount}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Réfs marge</span><span>{marginCatalog.length}</span></div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 xl:p-5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D8BEA8] bg-[#FFF8F1] shadow-[0_18px_40px_rgba(104,63,39,0.10)]">
          <div className="border-b border-[#E6D4C4] bg-[linear-gradient(180deg,#FBF4EC_0%,#F5EADD_100%)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.20em] text-[#8F624B]">Préparation manuelle</p>
                <h2 className="mt-1 text-[21px] font-black text-[#582F21]">Paramétrage taux de prise</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportMarginFile}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-[16px] border border-[#B55A3C] bg-[#F7E8DE] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-[#8D4F35] transition hover:bg-[#F2DDCF]"
                >
                  {isImportingMargin ? 'Import...' : 'Importer fichier marge'}
                </button>
                <button
                  type="button"
                  onClick={autoMatchAllRows}
                  className="rounded-[16px] border border-[#D2B39C] bg-[#F8EDE1] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-[#7F563F] transition hover:bg-[#F2E2D0]"
                >
                  Auto-remplir marges
                </button>
                <button
                  onClick={addRow}
                  className="rounded-[16px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-white shadow-[0_4px_0_#196A48] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#196A48]"
                >
                  Ajouter une ligne
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold text-[#7A5240]">
              <span>{marginFileName ? `Fichier marge : ${marginFileName}` : 'Aucun fichier marge chargé'}</span>
              {importMessage ? <span className="text-[#9A4F33]">• {importMessage}</span> : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[#F7F0E7]">
            <table className="w-full min-w-[1540px] table-fixed border-separate border-spacing-0">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[4%]" />
              </colgroup>

              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EADACA] text-[#71402D]">
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Produit affiché</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Famille</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Recherche import</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Produits liés</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">CM HT</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">PV HT</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Marge €</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Marge %</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-center text-[12px] font-black uppercase tracking-[0.07em]">—</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-[14px] font-semibold text-[#8B6650]">
                      Aucune ligne pour le moment. Ajoute un produit final puis rattache les références import correspondantes.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIndex) => {
                    const searchValue = searchByRow[row.id] ?? '';
                    const suggestions = filteredImportsByRow[row.id] ?? [];
                    const isSearchOpen = openSearchRow === row.id;
                    const isLinkedOpen = openLinkedRow === row.id;

                    return (
                      <tr key={row.id} className={rowIndex % 2 === 0 ? 'bg-[#FFF9F2]' : 'bg-[#FCF4EB]'}>
                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={row.label}
                              onChange={(e) => updateRow(row.id, { label: e.target.value, matchedMarginLabel: '', matchedMarginSheet: '', marginSource: row.marginSource === 'manual' ? 'manual' : '' })}
                              placeholder="Ex. Steak au poivre"
                              className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                            />
                            {row.matchedMarginLabel ? (
                              <div className="rounded-[12px] border border-[#D7BEA9] bg-[#FAF1E7] px-2.5 py-2 text-[11px] font-semibold text-[#7A5240]">
                                {row.marginSource === 'manual' ? 'Saisie manuelle' : `Auto : ${row.matchedMarginLabel}`}
                                {row.matchedMarginSheet ? ` • ${row.matchedMarginSheet}` : ''}
                              </div>
                            ) : null}
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.family}
                            onChange={(e) => updateRow(row.id, { family: e.target.value })}
                            placeholder="Ex. Desserts"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setOpenSearchRow((prev) => (prev === row.id ? null : row.id))}
                                className="rounded-[12px] border border-[#B55A3C] bg-[#F7E8DE] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#8D4F35] transition hover:bg-[#F2DDCF]"
                              >
                                Rechercher
                              </button>

                              <input
                                type="text"
                                value={searchValue}
                                onChange={(e) => {
                                  setSearchByRow((prev) => ({ ...prev, [row.id]: e.target.value }));
                                  setOpenSearchRow(row.id);
                                }}
                                placeholder="Nom import..."
                                className="min-w-0 flex-1 rounded-[12px] border border-[#D7BEA9] bg-white px-3 py-2 text-[12px] font-medium text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                              />
                            </div>

                            {isSearchOpen && (
                              <div className="max-h-44 overflow-auto rounded-[16px] border border-[#DCC5B1] bg-[#FFFDF9] p-2 shadow-[0_12px_24px_rgba(87,52,33,0.10)]">
                                {suggestions.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {suggestions.map((item) => (
                                      <button
                                        key={item}
                                        type="button"
                                        onClick={() => addImportToRow(row.id, item)}
                                        className="flex w-full items-center justify-between rounded-[12px] border border-[#E8D8C8] bg-white px-3 py-2 text-left text-[12px] font-semibold text-[#5B3728] transition hover:border-[#B55A3C] hover:bg-[#FFF4EC]"
                                      >
                                        <span className="pr-3">{item}</span>
                                        <span className="text-[10px] font-black uppercase tracking-[0.06em] text-[#A15839]">Ajouter</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="px-2 py-3 text-[12px] font-medium text-[#8B6650]">Aucun résultat.</div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setOpenLinkedRow((prev) => (prev === row.id ? null : row.id))}
                              className="rounded-[12px] border border-[#D2B39C] bg-[#F8EDE1] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#7F563F] transition hover:bg-[#F2E2D0]"
                            >
                              {row.linkedImports.length} lié{row.linkedImports.length > 1 ? 's' : ''}
                            </button>

                            {isLinkedOpen && (
                              <div className="space-y-1.5 rounded-[16px] border border-[#DCC5B1] bg-[#FFFDF9] p-2 shadow-[0_12px_24px_rgba(87,52,33,0.10)]">
                                {row.linkedImports.length > 0 ? (
                                  row.linkedImports.map((item) => (
                                    <div
                                      key={item}
                                      className="flex items-center justify-between gap-2 rounded-[12px] border border-[#E8D8C8] bg-white px-3 py-2"
                                    >
                                      <span className="text-[12px] font-semibold text-[#5B3728]">{item}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeImportFromRow(row.id, item)}
                                        className="rounded-[10px] border border-[#E6B9A5] bg-[#FCEEE7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.05em] text-[#A24E30] transition hover:bg-[#F9E2D6]"
                                      >
                                        Retirer
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-2 py-3 text-[12px] font-medium text-[#8B6650]">Aucun produit lié.</div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.costHt ?? ''}
                            onChange={(e) => updateRow(row.id, { costHt: e.target.value, matchedMarginLabel: row.matchedMarginLabel || row.label, matchedMarginSheet: row.matchedMarginSheet || '' })}
                            placeholder="0,00"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.sellPriceHt ?? ''}
                            onChange={(e) => updateRow(row.id, { sellPriceHt: e.target.value, matchedMarginLabel: row.matchedMarginLabel || row.label, matchedMarginSheet: row.matchedMarginSheet || '' })}
                            placeholder="0,00"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.marginEuro ?? ''}
                            onChange={(e) => updateRow(row.id, { marginEuro: e.target.value, matchedMarginLabel: row.matchedMarginLabel || row.label, matchedMarginSheet: row.matchedMarginSheet || '' })}
                            placeholder="0,00"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.marginPercent ?? ''}
                            onChange={(e) => updateRow(row.id, { marginPercent: e.target.value, matchedMarginLabel: row.matchedMarginLabel || row.label, matchedMarginSheet: row.matchedMarginSheet || '' })}
                            placeholder="0,0"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-2 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#D8B39E] bg-[#F6E7DA] text-[#A5502F] transition hover:bg-[#EFDCC8]"
                            title="Supprimer la ligne"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.8" d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TakeRatePage;
