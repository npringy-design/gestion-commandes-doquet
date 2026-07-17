import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MONTHS_DISPLAY_CONFIG, View } from '../constants';
import AppNavTile from '../components/AppNavTile';
import AiAssistantDrawer from '../components/AiAssistantDrawer';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { loadAllFromSupabase, saveToSupabaseDebounced } from '../utils/supabase';
import { buildMarginCatalogFromWorkbook } from '../utils/takeRateMarginParser.js';
import { resolveTakeRateMonthCovers } from '../utils/takeRateSnapshot';
import { normalizeTakeRateKey as normalize } from '../utils/takeRateResultsModel';

interface MarginCatalogItem {
  label: string;
  normalized: string;
  costHt: number | null;
  sellPriceHt: number | null;
  marginPercent: number | null;
  marginEuro: number | null;
  sourceSheet: string;
  section: string;
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
  covers: Record<string, number>;
}

type RowStatus = 'ok' | 'review';

interface TakeRateMonthSnapshot {
  rows: TakeRateMappingRow[];
  marginCatalog: MarginCatalogItem[];
  marginFileName: string;
  salesByImport?: Record<string, number>;
  covers?: number;
  frozenAt?: string;
}

const TAKE_RATE_BASE_ROWS_CLOUD_KEY = 'takeRateBaseRows';
const TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY = 'takeRateMarginCatalog';
const TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY = 'takeRateMarginFileName';
const TAKE_RATE_FROZEN_CLOUD_KEY = 'takeRateFrozenMonths';

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
  return [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0] ?? ';';
};

const parseNumber = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickImportColumn = (headers: string[], preferred: string[]) => {
  for (const name of preferred) {
    const exactIndex = headers.findIndex((cell) => cell === normalize(name));
    if (exactIndex !== -1) return exactIndex;
  }
  for (const name of preferred) {
    const includesIndex = headers.findIndex((cell) => cell.includes(normalize(name)));
    if (includesIndex !== -1) return includesIndex;
  }
  return -1;
};

const buildImportRows = (content: string) => {
  if (!content?.trim()) return [] as { label: string; normalized: string; quantity: number }[];
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(content);
  const headers = parseCsvLine(lines[0], delimiter).map(normalize);
  const nameIndex = pickImportColumn(headers, ['libelle', 'libellé', 'designation', 'désignation', 'produit', 'article', 'nom']);
  const qtyIndex = pickImportColumn(headers, [
    'nombre',
    'nb',
  ]);
  if (nameIndex === -1 || qtyIndex === -1) return [];

  const byLabel = new Map<string, { label: string; normalized: string; quantity: number }>();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter);
    const label = String(cols[nameIndex] ?? '').trim();
    const normalized = normalize(label);
    if (!label || !normalized) continue;
    const quantity = parseNumber(cols[qtyIndex] ?? '0');
    const existing = byLabel.get(normalized);
    if (existing) {
      existing.quantity += quantity;
    } else {
      byLabel.set(normalized, { label, normalized, quantity });
    }
  }
  return Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
};

const buildSalesObject = (items: { normalized: string; quantity: number }[]) =>
  Object.fromEntries(items.map((item) => [item.normalized, item.quantity]));

const GENERIC_MATCH_TOKENS = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'a', 'au', 'aux', 'avec', 'sans', 'menu', 'formule']);
const strongTokens = (value: string) => {
  const tokens = normalize(value).split(' ').filter(Boolean);
  const strong = tokens.filter((token) => !GENERIC_MATCH_TOKENS.has(token));
  return strong.length > 0 ? strong : tokens;
};

const scoreImportMatch = (productLabel: string, importLabel: string) => {
  const product = normalize(productLabel);
  const imported = normalize(importLabel);
  if (!product || !imported) return -1;
  if (product === imported) return 1000;
  const productTokens = strongTokens(productLabel);
  const importTokens = strongTokens(importLabel);
  const intersection = productTokens.filter((token) => importTokens.includes(token));
  if (intersection.length === 0) return -1;
  if (!productTokens.every((token) => importTokens.includes(token))) return -1;
  const coverage = intersection.length / Math.max(productTokens.length, 1);
  const substringBonus = imported.includes(product) ? 70 : 0;
  return coverage * 160 + intersection.length * 25 + substringBonus - Math.max(importTokens.length - productTokens.length, 0) * 12;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\u00a0/g, ' ').replace(/€/g, '').replace(/%/g, '').replace(/\s/g, '').replace(',', '.');
  if (!cleaned || cleaned === '-') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDecimal = (value: number | null) => (value === null || !Number.isFinite(value) ? '' : value.toFixed(2).replace('.', ','));
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

const readStoredBaseRows = () => {
  return [];
};

const isMarginBaseRow = (row: TakeRateMappingRow) =>
  Boolean(
    row.matchedMarginLabel ||
      row.matchedMarginSheet ||
      row.marginSource ||
      row.costHt ||
      row.sellPriceHt ||
      row.marginEuro ||
      row.marginPercent
  );

const readStoredMarginCatalog = () => {
  return [];
};

const readStoredMarginFileName = () => {
  return '';
};

const generateRowsFromMarginCatalog = (catalog: MarginCatalogItem[], existingRows: TakeRateMappingRow[]) => {
  void existingRows;

  return catalog.map((item, index) =>
    normalizeRow({
      id: `margin-${index + 1}-${item.normalized}`,
      label: item.label,
      family: item.section,
      linkedImports: [],
      costHt: formatDecimal(item.costHt),
      sellPriceHt: formatDecimal(item.sellPriceHt),
      marginPercent: formatPercent(item.marginPercent),
      marginEuro: formatDecimal(item.marginEuro),
      marginSource: 'auto',
      matchedMarginLabel: item.label,
      matchedMarginSheet: item.sourceSheet,
    })
  );
};

const getLinkedSales = (row: TakeRateMappingRow, salesByImport: Record<string, number>) =>
  row.linkedImports.reduce((sum, label) => sum + (salesByImport[normalize(label)] ?? 0), 0);

const getRowStatus = (row: TakeRateMappingRow, salesByImport: Record<string, number>): RowStatus => {
  if (!row.label.trim() || !row.family.trim()) return 'review';
  if (row.linkedImports.length === 0) return 'review';
  if (getLinkedSales(row, salesByImport) <= 0) return 'review';
  return 'ok';
};

const statusMeta: Record<RowStatus, { label: string; pill: string; rowRing: string }> = {
  ok: {
    label: 'OK',
    pill: 'border-[#B9DEC9] bg-[#EAF7EF] text-[#1F7A4D]',
    rowRing: 'shadow-[inset_4px_0_0_#2E8D63]',
  },
  review: {
    label: 'À vérifier',
    pill: 'border-[#E5C27A] bg-[#FFF6DE] text-[#9A6A13]',
    rowRing: 'shadow-[inset_4px_0_0_#D79A1E]',
  },
};

const TakeRatePage: React.FC<TakeRatePageProps> = ({ setView, prepImportsByMonth, covers }) => {
  const [baseRows, setBaseRows] = useState<TakeRateMappingRow[]>(readStoredBaseRows);
  const [rows, setRows] = useState<TakeRateMappingRow[]>(readStoredBaseRows);
  const [marginCatalog, setMarginCatalog] = useState<MarginCatalogItem[]>(readStoredMarginCatalog);
  const [marginFileName, setMarginFileName] = useState(readStoredMarginFileName);
  const [frozenMonths, setFrozenMonths] = useState<Record<string, TakeRateMonthSnapshot>>({});
  const [activePopover, setActivePopover] = useState<{ rowId: string; mode: 'picker' | 'selected' } | null>(null);
  const [importSearchByRow, setImportSearchByRow] = useState<Record<string, string>>({});
  const [pendingImportsByRow, setPendingImportsByRow] = useState<Record<string, string[]>>({});
  const [importMessage, setImportMessage] = useState('');
  const [isImportingMargin, setIsImportingMargin] = useState(false);
  const [familyFilter, setFamilyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | RowStatus>('all');
  const [productSearch, setProductSearch] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const baseRowsRef = useRef<TakeRateMappingRow[]>(readStoredBaseRows());
  const cloudTsRef = useRef<Record<string, string>>({});
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  const persistBaseRows = (value: TakeRateMappingRow[]) => {
    baseRowsRef.current = value;

    if (!isSupabaseConfigured()) return;
    const ts = new Date().toISOString();
    saveToSupabaseDebounced(
      TAKE_RATE_BASE_ROWS_CLOUD_KEY,
      value,
      ts,
      (key) => cloudTsRef.current[key],
      (confirmedKey, confirmedTs) => {
        cloudTsRef.current[confirmedKey] = confirmedTs;
      },
      2500,
    );
  };

  const persistMarginBase = (catalog: MarginCatalogItem[], fileName: string) => {
    if (!isSupabaseConfigured()) return;
    const ts = new Date().toISOString();
    saveToSupabaseDebounced(TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY, catalog, ts, (key) => cloudTsRef.current[key], (confirmedKey, confirmedTs) => {
      cloudTsRef.current[confirmedKey] = confirmedTs;
    }, 2500);
    saveToSupabaseDebounced(TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY, fileName, ts, (key) => cloudTsRef.current[key], (confirmedKey, confirmedTs) => {
      cloudTsRef.current[confirmedKey] = confirmedTs;
    }, 2500);
  };

  const persistTakeRateCollection = (cloudKey: string, value: Record<string, TakeRateMonthSnapshot>) => {
    if (!isSupabaseConfigured()) return;
    const ts = new Date().toISOString();
    saveToSupabaseDebounced(
      cloudKey,
      value,
      ts,
      (key) => cloudTsRef.current[key],
      (confirmedKey, confirmedTs) => {
        cloudTsRef.current[confirmedKey] = confirmedTs;
      },
      2500,
    );
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      let nextBaseRows = readStoredBaseRows();
      let nextMarginCatalog = readStoredMarginCatalog();
      let nextMarginFileName = readStoredMarginFileName();
      let nextFrozen: Record<string, TakeRateMonthSnapshot> = {};

      if (isSupabaseConfigured()) {
        try {
          const cloud = await loadAllFromSupabase();
          if (!cancelled && Array.isArray(cloud)) {
            cloud.forEach((row: any) => {
              if (row?.key === TAKE_RATE_BASE_ROWS_CLOUD_KEY && Array.isArray(row.value)) {
                nextBaseRows = row.value.map(normalizeRow).filter(isMarginBaseRow);
                cloudTsRef.current[TAKE_RATE_BASE_ROWS_CLOUD_KEY] = row.updated_at;
              }
              if (row?.key === TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY && Array.isArray(row.value)) {
                nextMarginCatalog = row.value as MarginCatalogItem[];
                cloudTsRef.current[TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY] = row.updated_at;
              }
              if (row?.key === TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY && typeof row.value === 'string') {
                nextMarginFileName = row.value;
                cloudTsRef.current[TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY] = row.updated_at;
              }
              if (row?.key === TAKE_RATE_FROZEN_CLOUD_KEY && row.value && typeof row.value === 'object') {
                nextFrozen = row.value as Record<string, TakeRateMonthSnapshot>;
                cloudTsRef.current[TAKE_RATE_FROZEN_CLOUD_KEY] = row.updated_at;
              }
            });
          }
        } catch (error) {
          console.error('[TakeRate Supabase load exception]', error);
        }
      }

      if (nextBaseRows.length === 0 && Array.isArray(nextMarginCatalog) && nextMarginCatalog.length > 0) {
        nextBaseRows = generateRowsFromMarginCatalog(nextMarginCatalog, []).map((row) => ({ ...row, linkedImports: [] }));
      }

      if (cancelled) return;

      baseRowsRef.current = nextBaseRows;
      setBaseRows(nextBaseRows);
      setRows(nextBaseRows);
      setMarginCatalog(nextMarginCatalog);
      setMarginFileName(nextMarginFileName);
      setFrozenMonths(nextFrozen && typeof nextFrozen === 'object' ? nextFrozen : {});
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    baseRowsRef.current = baseRows;
  }, [baseRows]);

  const defaultDisplayMonth = useMemo(
    () => MONTHS_DISPLAY_CONFIG.find((month) => !frozenMonths[month.key])?.key ?? MONTHS_DISPLAY_CONFIG[0].key,
    [frozenMonths]
  );
  const [selectedMonth, setSelectedMonth] = useState(defaultDisplayMonth);

  useEffect(() => {
    if (!MONTHS_DISPLAY_CONFIG.some((month) => month.key === selectedMonth)) setSelectedMonth(defaultDisplayMonth);
  }, [defaultDisplayMonth, selectedMonth]);

  const importRows = useMemo(() => buildImportRows(prepImportsByMonth[selectedMonth] ?? ''), [prepImportsByMonth, selectedMonth]);
  const importSalesByName = useMemo(() => {
    const frozenSales = frozenMonths[selectedMonth]?.salesByImport;
    if (frozenSales && Object.keys(frozenSales).length > 0) return frozenSales;
    return buildSalesObject(importRows);
  }, [frozenMonths, importRows, selectedMonth]);
  const isMonthFrozen = Boolean(frozenMonths[selectedMonth]);
  const monthCovers = resolveTakeRateMonthCovers(
    frozenMonths[selectedMonth]?.covers,
    covers[selectedMonth],
  );

  useEffect(() => {
    const snapshot = frozenMonths[selectedMonth];
    setRows(snapshot?.rows ? snapshot.rows.map(normalizeRow) : baseRows);
  }, [baseRows, frozenMonths, selectedMonth]);

  useEffect(() => {
    if (isMonthFrozen || importRows.length === 0 || rows.length === 0) return;

    let changed = false;
    const nextRows = rows.map((row) => {
      if (row.linkedImports.length > 0 || !row.label.trim()) return row;
      let best: { label: string; score: number } | null = null;
      importRows.forEach((item) => {
        const score = scoreImportMatch(row.label, item.label);
        if (!best || score > best.score) best = { label: item.label, score };
      });
      if (!best || best.score < 155) return row;
      changed = true;
      return { ...row, linkedImports: [best.label] };
    });

    if (!changed) return;
    setRows(nextRows);
    setBaseRows(nextRows);
    persistBaseRows(nextRows);
  }, [importRows, isMonthFrozen, rows, selectedMonth]);

  const familyOptions = useMemo(() => {
    const unique = new Set<string>();
    rows.forEach((row) => {
      const value = row.family.trim();
      if (value) unique.add(value);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedProductSearch = normalize(productSearch);

    return rows.filter((row) => {
      const rowStatus = getRowStatus(row, importSalesByName);
      const familyValue = row.family.trim();

      const familyMatches =
        familyFilter === 'all'
          ? true
          : familyFilter === '__none__'
            ? familyValue === ''
            : familyValue === familyFilter;

      const statusMatches = statusFilter === 'all' ? true : rowStatus === statusFilter;
      const productMatches =
        !normalizedProductSearch ||
        normalize(row.label).includes(normalizedProductSearch) ||
        normalize(row.matchedMarginLabel ?? '').includes(normalizedProductSearch);

      return familyMatches && statusMatches && productMatches;
    });
  }, [rows, familyFilter, statusFilter, productSearch, importSalesByName]);

  useEffect(() => {
    setSelectedRowIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
  }, [rows]);

  const addRow = () => {
    const row = createEmptyRow();
    setBaseRows((prev) => {
      const next = [...prev, row];
      persistBaseRows(next);
      return next;
    });
    setRows((prev) => [...prev, row]);
  };

  const toggleRowSelection = (rowId: string) => {
    setSelectedRowIds((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
  };

  const toggleSelectAllVisibleRows = () => {
    const visibleIds = filteredRows.map((row) => row.id);
    if (visibleIds.length === 0) return;

    setSelectedRowIds((prev) => {
      const allVisibleSelected = visibleIds.every((id) => prev.includes(id));
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const removeSelectedRows = () => {
    if (selectedRowIds.length === 0) return;
    const selectedSet = new Set<string>(selectedRowIds);

    setRows((prev) => prev.filter((row) => !selectedSet.has(row.id)));
    setBaseRows((prev) => {
      const next = prev.filter((row) => !selectedSet.has(row.id));
      persistBaseRows(next);
      return next;
    });
    setSelectedRowIds([]);
  };

  const updateRow = (rowId: string, patch: Partial<TakeRateMappingRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = normalizeRow({ ...row, ...patch });
        if ('costHt' in patch || 'sellPriceHt' in patch || 'marginPercent' in patch || 'marginEuro' in patch) {
          next.marginSource = 'manual';
        }
        return next;
      })
    );
    setBaseRows((prev) => {
      const nextRows = prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = normalizeRow({ ...row, ...patch });
        if ('costHt' in patch || 'sellPriceHt' in patch || 'marginPercent' in patch || 'marginEuro' in patch) {
          next.marginSource = 'manual';
        }
        return next;
      });
      persistBaseRows(nextRows);
      return nextRows;
    });
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
    setBaseRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      persistBaseRows(next);
      return next;
    });
  };

  const updateRowsAndBase = (updater: (prev: TakeRateMappingRow[]) => TakeRateMappingRow[]) => {
    setRows((prev) => {
      const next = updater(prev);
      setBaseRows(next);
      persistBaseRows(next);
      return next;
    });
  };

  const addImportToRow = (rowId: string, importLabel: string) => {
    updateRowsAndBase((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (row.linkedImports.includes(importLabel)) return row;
        return { ...row, linkedImports: [...row.linkedImports, importLabel] };
      })
    );
    setActivePopover(null);
  };

  const togglePendingImport = (rowId: string, importLabel: string) => {
    setPendingImportsByRow((prev) => {
      const current = prev[rowId] ?? [];
      const nextForRow = current.includes(importLabel)
        ? current.filter((item) => item !== importLabel)
        : [...current, importLabel];
      if (nextForRow.length === 0) {
        const next = { ...prev };
        delete next[rowId];
        return next;
      }
      return { ...prev, [rowId]: nextForRow };
    });
  };

  const validatePendingImports = (rowId: string) => {
    const pending = pendingImportsByRow[rowId] ?? [];
    if (pending.length === 0) return;
    updateRowsAndBase((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        return { ...row, linkedImports: Array.from(new Set([...row.linkedImports, ...pending])) };
      })
    );
    setPendingImportsByRow((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setActivePopover({ rowId, mode: 'selected' });
  };

  const removeImportFromRow = (rowId: string, importLabel: string) => {
    updateRowsAndBase((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, linkedImports: row.linkedImports.filter((item) => item !== importLabel) } : row))
    );
  };

  const toggleFreezeSelectedMonth = () => {
    if (isMonthFrozen) {
      setFrozenMonths((prev) => {
        const next = { ...prev };
        delete next[selectedMonth];
        persistTakeRateCollection(TAKE_RATE_FROZEN_CLOUD_KEY, next);
        return next;
      });
      return;
    }

    const snapshot: TakeRateMonthSnapshot = {
      rows,
      marginCatalog,
      marginFileName,
      salesByImport: buildSalesObject(importRows),
      covers: resolveTakeRateMonthCovers(undefined, covers[selectedMonth]),
      frozenAt: new Date().toISOString(),
    };
    setFrozenMonths((prev) => {
      const next = { ...prev, [selectedMonth]: snapshot };
      persistTakeRateCollection(TAKE_RATE_FROZEN_CLOUD_KEY, next);
      return next;
    });
  };

  const handleDeleteMarginImport = () => {
    setBaseRows([]);
    baseRowsRef.current = [];
    setRows([]);
    setMarginCatalog([]);
    setMarginFileName('');
    setSelectedRowIds([]);

    persistBaseRows([]);
    persistMarginBase([], '');
    setImportMessage('Base marge supprimée.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportMarginFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingMargin(true);
    setImportMessage('');

    try {
      const catalog = await buildMarginCatalogFromWorkbook(file);
      const generatedBase = generateRowsFromMarginCatalog(catalog, []).map((row) => ({ ...row, linkedImports: [] }));
      const sectionCount = new Set(catalog.map((item) => item.section.trim()).filter(Boolean)).size;

      setBaseRows(generatedBase);
      baseRowsRef.current = generatedBase;
      setMarginCatalog(catalog);
      setMarginFileName(file.name);
      setRows(generatedBase);
      persistBaseRows(generatedBase);
      persistMarginBase(catalog, file.name);
      setImportMessage(`${catalog.length} produits marge générés • ${sectionCount} sections détectées.`);
    } catch (_error) {
      setImportMessage('Import marge impossible. Vérifie le fichier ou la librairie xlsx.');
    } finally {
      setIsImportingMargin(false);
      if (event.target) event.target.value = '';
    }
  };

  const visibleRowIds = filteredRows.map((row) => row.id);
  const visibleSelectedCount = visibleRowIds.filter((id) => selectedRowIds.includes(id)).length;
  const allVisibleRowsSelected = visibleRowIds.length > 0 && visibleSelectedCount === visibleRowIds.length;
  const okCount = rows.filter((row) => getRowStatus(row, importSalesByName) === 'ok').length;
  const reviewCount = rows.filter((row) => getRowStatus(row, importSalesByName) === 'review').length;
  const withoutLinkCount = rows.filter((row) => row.linkedImports.length === 0).length;
  const hasMarginImport = marginCatalog.length > 0 || Boolean(marginFileName);
  const getRowSales = (row: TakeRateMappingRow) => getLinkedSales(row, importSalesByName);
  const availableImportRows = importRows;
  const getAiContext = React.useCallback(() => {
    const monthLabel = MONTHS_DISPLAY_CONFIG.find((month) => month.key === selectedMonth)?.label ?? selectedMonth;
    const sampleRows = rows.slice(0, 80).map((row) => {
      const sales = getRowSales(row);
      const takeRate = monthCovers > 0 ? (sales / monthCovers) * 100 : 0;
      return `${row.label || 'Produit sans nom'}: famille=${row.family || 'n/a'}, liens=${row.linkedImports.length}, ventes=${sales}, taux=${takeRate.toFixed(2)}%, statut=${getRowStatus(row, importSalesByName)}`;
    });

    return [
      'Page: Paramétrage Taux de prise.',
      'Source utilisée: base marge importée + import production du mois ouvert; snapshot pour mois figés.',
      `Mois de travail: ${monthLabel}; figé=${isMonthFrozen ? 'oui' : 'non'}; couverts=${monthCovers}.`,
      `Lignes=${rows.length}; affichées=${filteredRows.length}; liées=${okCount}; à vérifier=${reviewCount}; sans lien=${withoutLinkCount}.`,
      `Import marge=${hasMarginImport ? 'présent' : 'absent'}; refs marge=${marginCatalog.length}; produits import prod disponibles=${availableImportRows.length}.`,
      'Extrait lignes:',
      ...sampleRows,
    ].join('\n');
  }, [availableImportRows.length, filteredRows.length, hasMarginImport, importSalesByName, marginCatalog.length, monthCovers, okCount, reviewCount, rows, selectedMonth, withoutLinkCount]);

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#FFF7EA_0%,#F8E6C7_54%,#E9C38B_100%)] text-[#2E1B12]">
      <div className="mx-auto flex h-screen max-w-[1920px] flex-col gap-3 p-2 sm:p-3">
      <aside className="hidden">
        <AppNavTile
          onClick={() => setView('stats')}
          eyebrow="Retour"
          icon="settings"
          size="lg"
          tone="gold"
          className="w-full"
        >
          Paramètres
        </AppNavTile>

        <AppNavTile
          onClick={() => setView('take_rate_sheet')}
          eyebrow="Ouvrir"
          icon="sheet"
          size="lg"
          className="w-full"
        >
          Voir la feuille
        </AppNavTile>

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

        <div className="rounded-[22px] border border-[#D7BFAB] bg-[#FFF8F1] px-4 py-4 shadow-[0_8px_18px_rgba(96,56,34,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#93644D]">Résumé</p>
          <div className="mt-3 space-y-2 text-[13px] font-semibold text-[#6E4736]">
            <div className="flex items-center justify-between gap-3"><span>Produits</span><span>{rows.length}</span></div>
            <div className="flex items-center justify-between gap-3"><span>OK</span><span>{okCount}</span></div>
            <div className="flex items-center justify-between gap-3"><span>À vérifier</span><span>{reviewCount}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Non liés</span><span>{withoutLinkCount}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Réfs marge</span><span>{marginCatalog.length}</span></div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1">
        <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-[#EBC28A] bg-[#FFFDF8]/96 shadow-[0_18px_38px_rgba(66,42,24,0.14)]">
          <div className="border-b border-[#8B431C] bg-[#2F1D14] px-4 py-3 shadow-[0_14px_28px_rgba(66,42,24,0.20)] sm:px-5">
              <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3">
                <AppNavTile onClick={() => setView('home')} eyebrow="Retour" icon="home" size="sm" tone="cream">Accueil</AppNavTile>
                <AppNavTile onClick={() => setView('stats')} eyebrow="Retour" icon="settings" size="sm" tone="cream">Parametres</AppNavTile>
                <div className="hidden h-12 w-px bg-[#EBC28A]/45 xl:block" />
                <div className="min-w-0">
                  <h2 className="text-3xl font-black leading-none text-[#FFF7EA]">Taux de prise</h2>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#F7C05B]">Parametrage</p>
                </div>
                <AiAssistantDrawer placement="inline" title="Assistant IA - Paramétrage taux de prise" getContext={getAiContext} />
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportMarginFile} />
                <div className="ml-auto flex flex-wrap gap-2">

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`min-h-[42px] rounded-2xl border px-4 py-2 text-[11px] font-black uppercase tracking-[0.10em] shadow-sm transition ${
                    hasMarginImport
                      ? 'border-[#9ED9B6] bg-[#EAF8EF] text-[#176A43] hover:bg-[#F4FFF8]'
                      : 'border-[#EBC28A] bg-[#FFF7EA] text-[#2F1D14] hover:bg-white'
                  }`}
                >
                  {isImportingMargin ? 'Import...' : hasMarginImport ? 'Import marge present' : 'Importer fichier marge'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteMarginImport}
                  disabled={marginCatalog.length === 0 && rows.length === 0 && !marginFileName}
                  className="min-h-[42px] rounded-2xl border border-[#EBC28A] bg-[#FFF7EA] px-4 py-2 text-[11px] font-black uppercase tracking-[0.10em] text-[#7A2E1E] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Supprimer import marge
                </button>
            </div>
          </div>
          </div>
            <div className="border-b border-[#EBC28A] bg-[#FFF7EA] px-4 py-3 sm:px-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8A5A2F]">Figer les mois du taux de prise</p>
                <label className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8A5A2F]">Mois affiché</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="rounded-xl border border-[#EBC28A] bg-white px-3 py-1.5 text-xs font-black text-[#2F1D14] outline-none"
                  >
                    {MONTHS_DISPLAY_CONFIG.map((month) => (
                      <option key={`take-rate-display-${month.key}`} value={month.key}>{month.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-6 gap-1.5 xl:grid-cols-12">
                {MONTHS_DISPLAY_CONFIG.map((month) => {
                  const locked = Boolean(frozenMonths[month.key]);
                  const active = selectedMonth === month.key;
                  return (
                    <button
                      key={`take-rate-month-${month.key}`}
                      type="button"
                      onClick={() => {
                        const snapshot = frozenMonths[month.key];
                        if (snapshot) {
                          setFrozenMonths((prev) => {
                            const next = { ...prev };
                            delete next[month.key];
                            persistTakeRateCollection(TAKE_RATE_FROZEN_CLOUD_KEY, next);
                            return next;
                          });
                          return;
                        }
                        const rowsToFreeze = month.key === selectedMonth ? rows : baseRows;
                        const monthImportRows = buildImportRows(prepImportsByMonth[month.key] ?? '');
                        const nextSnapshot: TakeRateMonthSnapshot = {
                          rows: rowsToFreeze,
                          marginCatalog,
                          marginFileName,
                          salesByImport: buildSalesObject(monthImportRows),
                          covers: resolveTakeRateMonthCovers(undefined, covers[month.key]),
                          frozenAt: new Date().toISOString(),
                        };
                        setFrozenMonths((prev) => {
                          const next = { ...prev, [month.key]: nextSnapshot };
                          persistTakeRateCollection(TAKE_RATE_FROZEN_CLOUD_KEY, next);
                          return next;
                        });
                      }}
                      className={`min-h-[42px] rounded-xl border px-2 py-1 text-[10px] font-black uppercase tracking-[0.07em] transition ${
                        locked
                          ? 'border-emerald-700 bg-emerald-600 text-white shadow-sm'
                          : active
                            ? 'border-[#D8A640] bg-[#FFE8A8] text-[#5B321E]'
                            : 'border-[#EBC28A] bg-[#FFF7EA] text-[#2F1D14] hover:bg-white'
                      }`}
                    >
                      <span className="block text-xs">{month.label.slice(0, 3)}</span>
                      <span className="block text-[8px]">{locked ? 'Figé' : 'Ouvert'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="hidden mt-3 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ['Produits', rows.length],
                ['OK', okCount],
                ['A verifier', reviewCount],
                ['Refs marge', marginCatalog.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2 shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#A85F2A]">{label}</p>
                  <p className="mt-1 text-sm font-black text-[#2F1D14]">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3 border-b border-[#EBC28A] bg-[#FFF7EA] px-4 py-3 sm:px-5">
              <label className="min-w-[260px] flex-1">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.10em] text-[#8A5A2F]">Recherche produit</span>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-[13px] font-semibold text-[#2F1D14] outline-none transition focus:border-[#D8A640] focus:ring-2 focus:ring-[#E8B59E]"
                />
              </label>

              <button
                type="button"
                onClick={addRow}
                disabled={isMonthFrozen}
                className="min-h-[42px] rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.10em] text-[#2F1D14] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                Ajouter ligne
              </button>

              <button
                type="button"
                onClick={removeSelectedRows}
                disabled={isMonthFrozen || selectedRowIds.length === 0}
                className="min-h-[42px] rounded-xl border border-[#E7B6A4] bg-[#FFF1EA] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.10em] text-[#8E321F] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                Supprimer ligne
              </button>

              <label className="min-w-[180px]">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.10em] text-[#8A5A2F]">Famille</span>
                <select
                  value={familyFilter}
                  onChange={(e) => setFamilyFilter(e.target.value)}
                  className="w-full rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-[13px] font-semibold text-[#2F1D14] outline-none transition focus:border-[#D8A640] focus:ring-2 focus:ring-[#E8B59E]"
                >
                  <option value="all">Toutes</option>
                  <option value="__none__">Sans famille</option>
                  {familyOptions.map((family) => (
                    <option key={family} value={family}>{family}</option>
                  ))}
                </select>
              </label>

              <label className="min-w-[180px]">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.10em] text-[#8A5A2F]">Etat</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | RowStatus)}
                  className="w-full rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-[13px] font-semibold text-[#2F1D14] outline-none transition focus:border-[#D8A640] focus:ring-2 focus:ring-[#E8B59E]"
                >
                  <option value="all">Tous</option>
                  <option value="ok">OK</option>
                  <option value="review">À vérifier</option>
                </select>
              </label>

            </div>

          <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#FFFDF8]">
            <table className="w-full table-fixed border-separate border-spacing-0">
              <colgroup>
                <col className="w-[3%]" />
                <col className="w-[6%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[16%]" />
                <col className="w-[5%]" />
                <col className="w-[5%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#F8E0B8] text-[#2E1B12]">
                  <th className="border-b border-[#EBC28A] px-2 py-4 text-center text-[12px] font-black uppercase tracking-[0.07em]">
                    <input
                      type="checkbox"
                      checked={allVisibleRowsSelected}
                      onChange={toggleSelectAllVisibleRows}
                      disabled={isMonthFrozen}
                      aria-label="Sélectionner toutes les lignes visibles"
                      className="h-4 w-4 rounded border-[#B98D76] text-[#A24E30] focus:ring-[#D9A58F]"
                    />
                  </th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">État</th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Produit marge</th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Famille</th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">CR €</th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Prix TTC €</th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Marge €</th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Marge %</th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Recherche import</th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Ventes</th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Taux</th>
                  <th className="border-b border-[#EBC28A] px-3 py-4 text-center text-[12px] font-black uppercase tracking-[0.07em]">Suppr.</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-10 text-center text-[14px] font-semibold text-[#8B6650]">
                      Aucune ligne pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, rowIndex) => {
                    const status = getRowStatus(row, importSalesByName);
                    const meta = statusMeta[status];
                    const rowSales = getRowSales(row);
                    const takeRate = monthCovers > 0 ? (rowSales / monthCovers) * 100 : 0;
                    const popoverQuery = normalize(importSearchByRow[row.id] ?? '');
                    const selectedImportSet = new Set(row.linkedImports.map(normalize));
                    const pendingImports = pendingImportsByRow[row.id] ?? [];
                    const pendingImportSet = new Set(pendingImports);
                    const suggestedImports = availableImportRows
                      .filter((item) => !selectedImportSet.has(item.normalized))
                      .filter((item) => !popoverQuery || normalize(item.label).includes(popoverQuery))
                      .slice(0, 60);

                    return (
                      <tr key={row.id} className={`${rowIndex % 2 === 0 ? 'bg-[#FFFDF8]' : 'bg-[#FFF7EA]'} ${meta.rowRing}`}>
                        <td className="border-b border-[#E8D8C8] px-2 py-3 align-top text-center">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.includes(row.id)}
                            onChange={() => toggleRowSelection(row.id)}
                            disabled={isMonthFrozen}
                            aria-label={`Sélectionner ${row.label || 'la ligne'}`}
                            className="mt-1 h-4 w-4 rounded border-[#B98D76] text-[#A24E30] focus:ring-[#D9A58F]"
                          />
                        </td>
                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${meta.pill}`}>
                              {meta.label}
                            </span>
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={row.label}
                              onChange={(e) => updateRow(row.id, { label: e.target.value })}
                              disabled={isMonthFrozen}
                              placeholder="Ex. Steak au poivre"
                              className="w-full rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-[13px] font-semibold text-[#2F1D14] outline-none transition focus:border-[#D8A640] focus:ring-2 focus:ring-[#E8B59E]"
                            />
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.family}
                            onChange={(e) => updateRow(row.id, { family: e.target.value })}
                            disabled={isMonthFrozen}
                            placeholder="Ex. Dessert"
                            className="w-full rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-[13px] font-semibold text-[#2F1D14] outline-none transition focus:border-[#D8A640] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.costHt ?? ''}
                            onChange={(e) => updateRow(row.id, { costHt: e.target.value })}
                            disabled={isMonthFrozen}
                            placeholder="0,00"
                            className="w-full rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-[13px] font-semibold text-[#2F1D14] outline-none transition focus:border-[#D8A640] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.sellPriceHt ?? ''}
                            onChange={(e) => updateRow(row.id, { sellPriceHt: e.target.value })}
                            disabled={isMonthFrozen}
                            placeholder="0,00"
                            className="w-full rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-[13px] font-semibold text-[#2F1D14] outline-none transition focus:border-[#D8A640] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.marginEuro ?? ''}
                            onChange={(e) => updateRow(row.id, { marginEuro: e.target.value })}
                            disabled={isMonthFrozen}
                            placeholder="0,00"
                            className="w-full rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-[13px] font-semibold text-[#2F1D14] outline-none transition focus:border-[#D8A640] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.marginPercent ?? ''}
                            onChange={(e) => updateRow(row.id, { marginPercent: e.target.value })}
                            disabled={isMonthFrozen}
                            placeholder="0,0"
                            className="w-full rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-[13px] font-semibold text-[#2F1D14] outline-none transition focus:border-[#D8A640] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="relative border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className={`flex h-10 min-w-0 items-center gap-1.5 rounded-xl border px-1.5 ${row.linkedImports.length > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                            <button
                              type="button"
                              disabled={isMonthFrozen || availableImportRows.length === 0}
                              onClick={() => setActivePopover(activePopover?.rowId === row.id && activePopover.mode === 'picker' ? null : { rowId: row.id, mode: 'picker' })}
                              className="h-8 rounded-lg border border-[#D0B08D] bg-white px-2 text-[10px] font-black uppercase tracking-[0.10em] text-[#A05A28] disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              Ajouter
                            </button>
                            <button
                              type="button"
                              disabled={row.linkedImports.length === 0}
                              onClick={() => setActivePopover(activePopover?.rowId === row.id && activePopover.mode === 'selected' ? null : { rowId: row.id, mode: 'selected' })}
                              className="min-w-0 truncate rounded-lg px-1.5 py-1 text-left text-[11px] font-bold text-slate-600 transition hover:bg-white disabled:cursor-default disabled:hover:bg-transparent"
                            >
                              {row.linkedImports.length > 0 ? `${row.linkedImports.length} produit${row.linkedImports.length > 1 ? 's' : ''}` : 'Aucun lien'}
                            </button>
                          </div>
                          {activePopover?.rowId === row.id && (
                            <div className="absolute right-3 top-[calc(100%+8px)] z-[999] w-[320px] rounded-2xl border border-[#D0B08D] bg-[#FFF8EF] p-3 shadow-[0_18px_36px_rgba(72,35,19,0.22)]">
                              {activePopover.mode === 'picker' ? (
                                <>
                                  <input
                                    value={importSearchByRow[row.id] ?? ''}
                                    onChange={(e) => setImportSearchByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                    placeholder="Filtrer les produits import..."
                                    className="mb-2 w-full rounded-xl border border-[#EBC28A] bg-white px-3 py-2 text-sm font-semibold outline-none"
                                  />
                                  <div className="max-h-[240px] space-y-1 overflow-y-auto">
                                    {suggestedImports.length === 0 ? (
                                      <p className="px-2 py-3 text-sm font-semibold text-[#8B6650]">Aucun produit trouvé.</p>
                                    ) : (
                                      suggestedImports.map((item) => {
                                        const checked = pendingImportSet.has(item.label);
                                        return (
                                        <label
                                          key={`${row.id}-${item.normalized}`}
                                          className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#2F1D14] hover:bg-[#F4ECDD] ${checked ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''}`}
                                        >
                                          <span className="flex min-w-0 items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() => togglePendingImport(row.id, item.label)}
                                              disabled={isMonthFrozen}
                                              className="h-4 w-4 shrink-0 accent-emerald-600"
                                            />
                                            <span className="min-w-0 truncate">{item.label}</span>
                                          </span>
                                          <span className="shrink-0 text-xs font-black text-emerald-700">{item.quantity}</span>
                                        </label>
                                      )})
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isMonthFrozen || pendingImports.length === 0}
                                    onClick={() => validatePendingImports(row.id)}
                                    className="mt-3 w-full rounded-xl border border-emerald-700 bg-emerald-600 px-3 py-2 text-[11px] font-black uppercase tracking-[0.10em] text-white disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Ajouter la sélection{pendingImports.length > 0 ? ` (${pendingImports.length})` : ''}
                                  </button>
                                </>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8A5A2F]">Produits liés</p>
                                  {row.linkedImports.map((label) => (
                                    <div key={`${row.id}-${label}`} className="flex items-center justify-between gap-2 rounded-xl bg-[#F4ECDD] px-3 py-2 text-sm font-semibold">
                                      <span className="min-w-0 truncate">{label}</span>
                                      <button type="button" disabled={isMonthFrozen} onClick={() => removeImportFromRow(row.id, label)} className="h-7 w-7 rounded-lg bg-white text-[#A5502F] disabled:opacity-40">×</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button type="button" onClick={() => setActivePopover(null)} className="mt-3 w-full rounded-xl border border-[#D0B08D] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.10em] text-[#2F1D14]">Fermer</button>
                            </div>
                          )}
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-sm font-black text-[#2F1D14]">{rowSales}</div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 text-sm font-black text-[#2F1D14]">{takeRate.toFixed(2)}</div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-2 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            disabled={isMonthFrozen}
                            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#D8B39E] bg-[#F6E7DA] text-[#A5502F] transition hover:bg-[#EFDCC8] disabled:cursor-not-allowed disabled:opacity-40"
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
    </div>
  );
};

export default TakeRatePage;


