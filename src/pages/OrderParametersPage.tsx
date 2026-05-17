import React from 'react';
import { View } from '../constants';
import AppNavTile from '../components/AppNavTile';
import { useToast } from '../components/Toast';
import type { OrderParameterRow, SupplierConfig } from '../types';

interface OrderParametersPageProps {
  setView: (v: View) => void;
  rows: OrderParameterRow[];
  setRows: React.Dispatch<React.SetStateAction<OrderParameterRow[]>>;
  supplierConfigs: Record<string, SupplierConfig>;
}

type NumericColumn = 'packaging' | 'unitValue';
type NumericDraftKey = `${string}-${NumericColumn}`;

const createRowId = () => `order-param-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyRow = (supplierId: string): OrderParameterRow => ({
  id: createRowId(),
  supplierId,
  product: '',
  packaging: '',
  unitValue: '',
  countingUnit: '',
});

const createImportedRow = (
  supplierId: string,
  product: string,
  packaging: number | '',
  unitValue: number | '',
  countingUnit = ''
): OrderParameterRow => ({
  id: createRowId(),
  supplierId,
  product,
  packaging,
  unitValue,
  countingUnit,
});

const parseNumberInput = (value: string): number | '' => {
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return '';
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : '';
};

const formatNumberInput = (value: number | '') => (value === '' ? '' : String(value).replace('.', ','));

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const getCellString = (value: unknown) => String(value ?? '').trim();

const getCellNumber = (value: unknown): number | '' => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return parseNumberInput(String(value ?? ''));
};

const findHeaderIndex = (headers: unknown[], aliases: string[]) => {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  return headers.findIndex((header) => normalizedAliases.has(normalizeHeader(header)));
};

const OrderParametersPage: React.FC<OrderParametersPageProps> = ({ setView, rows, setRows, supplierConfigs }) => {
  const { showToast } = useToast();
  const supplierOptions = React.useMemo(
    () => Object.values(supplierConfigs).filter((supplier) => !supplier.isArchived),
    [supplierConfigs]
  );
  const [activeSupplierId, setActiveSupplierId] = React.useState(() => supplierOptions[0]?.id ?? 'doquet');
  const [numericDrafts, setNumericDrafts] = React.useState<Record<NumericDraftKey, string>>({});
  const [isImporting, setIsImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const activeSupplier = supplierOptions.find((supplier) => supplier.id === activeSupplierId) ?? supplierOptions[0];
  const resolvedActiveSupplierId = activeSupplier?.id ?? activeSupplierId;
  const visibleRows = rows.filter((row) => (row.supplierId ?? resolvedActiveSupplierId) === resolvedActiveSupplierId);

  React.useEffect(() => {
    if (supplierOptions.length === 0) return;
    if (!supplierOptions.some((supplier) => supplier.id === activeSupplierId)) {
      setActiveSupplierId(supplierOptions[0].id);
    }
  }, [activeSupplierId, supplierOptions]);

  React.useEffect(() => {
    if (!resolvedActiveSupplierId) return;
    if (!rows.some((row) => !row.supplierId)) return;
    setRows((prev) => prev.map((row) => (row.supplierId ? row : { ...row, supplierId: resolvedActiveSupplierId })));
  }, [resolvedActiveSupplierId, rows, setRows]);

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow(resolvedActiveSupplierId)]);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const updateText = (rowId: string, column: 'product' | 'countingUnit', value: string) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, [column]: value } : row)));
  };

  const updateNumber = (rowId: string, column: NumericColumn, value: string) => {
    setNumericDrafts((prev) => ({ ...prev, [`${rowId}-${column}`]: value }));
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [column]: parseNumberInput(value) } : row))
    );
  };

  const clearNumericDraft = (rowId: string, column: NumericColumn) => {
    setNumericDrafts((prev) => {
      const next = { ...prev };
      delete next[`${rowId}-${column}`];
      return next;
    });
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsImporting(true);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error('Aucun onglet lisible dans le fichier.');
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
        header: 1,
        raw: true,
        defval: '',
      });

      if (rawRows.length === 0) {
        throw new Error('Le fichier est vide.');
      }

      const headerRowIndex = rawRows.findIndex((row) => row.some((cell) => getCellString(cell) !== ''));
      if (headerRowIndex === -1) {
        throw new Error('Impossible de trouver les en-tetes.');
      }

      const headers = rawRows[headerRowIndex];
      const productIndex = findHeaderIndex(headers, ['produit', 'product', 'article', 'nom', 'designation', 'libelle']);
      const packagingIndex = findHeaderIndex(headers, ['colisage', 'packaging', 'conditionnement', 'colis', 'pcb', 'pack']);
      const unitValueIndex = findHeaderIndex(headers, ['valeur unite', 'valeur unitaire', 'unit value', 'unitvalue', 'pu']);
      const countingUnitIndex = findHeaderIndex(headers, [
        'unite de comptage',
        'unité de comptage',
        'unite comptage',
        'comptage',
        'unite inventaire',
        'unité inventaire',
        'unite stock',
        'unité stock',
        'counting unit',
      ]);

      const resolvedProductIndex = productIndex >= 0 ? productIndex : 0;
      const resolvedPackagingIndex = packagingIndex >= 0 ? packagingIndex : 1;
      const resolvedUnitValueIndex = unitValueIndex >= 0 ? unitValueIndex : 2;

      const importedRows = rawRows
        .slice(headerRowIndex + 1)
        .map((row) => {
          const product = getCellString(row[resolvedProductIndex]);
          const packaging = getCellNumber(row[resolvedPackagingIndex]);
          const unitValue = getCellNumber(row[resolvedUnitValueIndex]);
          const countingUnit = countingUnitIndex >= 0 ? getCellString(row[countingUnitIndex]) : '';
          return createImportedRow(resolvedActiveSupplierId, product, packaging, unitValue, countingUnit);
        })
        .filter((row) => row.product || row.packaging !== '' || row.unitValue !== '' || row.countingUnit);

      if (importedRows.length === 0) {
        throw new Error('Aucune ligne exploitable trouvee.');
      }

      setRows((prev) => [
        ...prev.filter((row) => row.supplierId !== resolvedActiveSupplierId),
        ...importedRows,
      ]);
      setNumericDrafts({});
      showToast(`${importedRows.length} ligne(s) importee(s) pour ${activeSupplier?.name ?? 'ce fournisseur'}`, 'success');
    } catch (error) {
      showToast(`Import impossible: ${(error as Error).message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(245,166,58,0.28),transparent_30%),linear-gradient(180deg,#FFF7EA_0%,#F3DDC0_46%,#C97933_100%)] text-[#2F1D14]">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-4 rounded-[24px] border border-[#C89245]/55 bg-[linear-gradient(135deg,#3A2116_0%,#69331F_58%,#A85F2A_100%)] p-4 shadow-[0_18px_42px_rgba(54,24,12,0.18)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <h1 className="text-3xl font-black tracking-tight text-[#FFF7EA]">Parametre commandes</h1>
            <AppNavTile
              type="button"
              onClick={() => setView('stats')}
              eyebrow="Retour"
              icon="back"
              tone="dark"
              size="md"
            >
              Parametres
            </AppNavTile>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="rounded-xl border-2 border-[#E2BE7F] bg-[#FFF7EA] px-5 py-3 text-sm font-black uppercase tracking-[0.1em] text-[#4D2B18] shadow-[0_4px_0_#C89245] transition hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#C89245] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isImporting ? 'Import...' : 'Importer Excel'}
            </button>
            <button
              type="button"
              onClick={addRow}
              className="rounded-xl border-2 border-[#D9A72B] bg-[linear-gradient(180deg,#F7D66A_0%,#E5AF2F_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.1em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]"
            >
              + Ajouter une ligne
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-[22px] border border-[#D8A96E] bg-[#FFFDF8]/95 p-3 shadow-[0_12px_28px_rgba(54,24,12,0.12)]">
          <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#6A432D]">Fournisseur actif</div>
          <div className="flex flex-wrap gap-2">
            {supplierOptions.length === 0 ? (
              <span className="rounded-xl border border-[#D8A96E] bg-white px-4 py-2 text-sm font-black text-[#4D2B18]">
                Aucun fournisseur actif
              </span>
            ) : (
              supplierOptions.map((supplier) => {
                const isActive = supplier.id === resolvedActiveSupplierId;
                const count = rows.filter((row) => row.supplierId === supplier.id).length;
                return (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => setActiveSupplierId(supplier.id)}
                    className={`rounded-xl border-2 px-4 py-2 text-sm font-black uppercase tracking-[0.08em] transition ${
                      isActive
                        ? 'border-[#3A2116] bg-[#3A2116] text-[#FFF7EA] shadow-[0_4px_0_#A85F2A]'
                        : 'border-[#D8A96E] bg-white text-[#4D2B18] hover:bg-[#FFF7EA]'
                    }`}
                  >
                    {supplier.name}
                    <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[11px]">{count}</span>
                  </button>
                );
              })
            )}
          </div>
          <p className="mt-3 text-xs font-semibold text-[#6A432D]">
            L'import Excel remplace uniquement les lignes du fournisseur actif.
          </p>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[#D8A96E] bg-[#FFFDF8] shadow-[0_18px_36px_rgba(54,24,12,0.16)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-[#3A2116] text-[#FFF7EA]">
                <tr>
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.16em]">Produit</th>
                  <th className="w-44 px-4 py-4 text-xs font-black uppercase tracking-[0.16em]">Colisage</th>
                  <th className="w-44 px-4 py-4 text-xs font-black uppercase tracking-[0.16em]">Valeur unite</th>
                  <th className="w-56 px-4 py-4 text-xs font-black uppercase tracking-[0.16em]">Unite de comptage</th>
                  <th className="w-36 px-4 py-4 text-right text-xs font-black uppercase tracking-[0.16em]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm font-bold text-[#6A432D]">
                      Aucune ligne pour ce fournisseur.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.id} className="border-t border-[#E8D8C8]">
                      <td className="px-4 py-3">
                        <input
                          value={row.product}
                          onChange={(event) => updateText(row.id, 'product', event.target.value)}
                          className="w-full rounded-xl border border-[#D8A96E] bg-white px-3 py-2 text-sm font-bold text-[#2F1D14] outline-none transition focus:border-[#A85F2A] focus:ring-2 focus:ring-[#F7D66A]/40"
                          placeholder="Nom du produit"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          inputMode="decimal"
                          value={numericDrafts[`${row.id}-packaging`] ?? formatNumberInput(row.packaging)}
                          onChange={(event) => updateNumber(row.id, 'packaging', event.target.value)}
                          onBlur={() => clearNumericDraft(row.id, 'packaging')}
                          className="w-full rounded-xl border border-[#D8A96E] bg-white px-3 py-2 text-sm font-bold text-[#2F1D14] outline-none transition focus:border-[#A85F2A] focus:ring-2 focus:ring-[#F7D66A]/40"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          inputMode="decimal"
                          value={numericDrafts[`${row.id}-unitValue`] ?? formatNumberInput(row.unitValue)}
                          onChange={(event) => updateNumber(row.id, 'unitValue', event.target.value)}
                          onBlur={() => clearNumericDraft(row.id, 'unitValue')}
                          className="w-full rounded-xl border border-[#D8A96E] bg-white px-3 py-2 text-sm font-bold text-[#2F1D14] outline-none transition focus:border-[#A85F2A] focus:ring-2 focus:ring-[#F7D66A]/40"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={row.countingUnit ?? ''}
                          onChange={(event) => updateText(row.id, 'countingUnit', event.target.value)}
                          className="w-full rounded-xl border border-[#D8A96E] bg-white px-3 py-2 text-sm font-bold text-[#2F1D14] outline-none transition focus:border-[#A85F2A] focus:ring-2 focus:ring-[#F7D66A]/40"
                          placeholder="ex : kg, sachet, pièce"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                        >
                          Suppr.
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderParametersPage;