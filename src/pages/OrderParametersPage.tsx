import React from 'react';
import { View } from '../constants';
import AppNavTile from '../components/AppNavTile';
import { useToast } from '../components/Toast';
import { DEFAULT_SUPPLIER_CONFIGS } from '../hooks/appStateHelpers';
import type { OrderParameterRow, SupplierConfig } from '../types';

interface OrderParametersPageProps {
  setView: (v: View) => void;
  rows: OrderParameterRow[];
  setRows: React.Dispatch<React.SetStateAction<OrderParameterRow[]>>;
  supplierConfigs?: Record<string, SupplierConfig>;
}

type NumericColumn = 'packaging' | 'unitValue';
const id = () => `order-param-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const toNumber = (value: string): number | '' => {
  const parsed = Number(value.trim().replace(/\s/g, '').replace(',', '.'));
  return value.trim() && Number.isFinite(parsed) ? parsed : '';
};
const toInput = (value: number | '') => (value === '' ? '' : String(value).replace('.', ','));
const clean = (value: unknown) => String(value ?? '').trim();
const norm = (value: unknown) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const findCol = (headers: unknown[], names: string[]) => {
  const wanted = new Set(names.map(norm));
  return headers.findIndex((header) => wanted.has(norm(header)));
};
const cellNumber = (value: unknown): number | '' => typeof value === 'number' && Number.isFinite(value) ? value : toNumber(String(value ?? ''));

const COUNTING_UNIT_OPTIONS = [
  '',
  'Pièce',
  'Bouteille',
  'Kg',
  'Litre',
  'Carton',
  'Sachet',
  'Barquette',
  'Seau',
  'Bidon',
  'Pack',
  'Caisse',
  'Boîte',
  'Bac',
  'Fût',
];

const getCountingUnitOptions = (value?: string) => {
  const current = clean(value);
  if (!current || COUNTING_UNIT_OPTIONS.includes(current)) return COUNTING_UNIT_OPTIONS;
  return ['', current, ...COUNTING_UNIT_OPTIONS.filter(Boolean)];
};

const normalizeImportedCountingUnit = (value: unknown) => {
  const raw = clean(value);
  if (!raw) return '';
  return COUNTING_UNIT_OPTIONS.find((option) => option && norm(option) === norm(raw)) ?? raw;
};

const OrderParametersPage: React.FC<OrderParametersPageProps> = ({
  setView,
  rows,
  setRows,
  supplierConfigs = DEFAULT_SUPPLIER_CONFIGS,
}) => {
  const { showToast } = useToast();
  const suppliers = React.useMemo(() => Object.values(supplierConfigs).filter((s) => !s.isArchived), [supplierConfigs]);
  const [supplierId, setSupplierId] = React.useState(() => suppliers[0]?.id ?? 'doquet');
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const activeSupplier = suppliers.find((s) => s.id === supplierId) ?? suppliers[0];
  const activeSupplierId = activeSupplier?.id ?? supplierId;
  const visibleRows = rows.filter((row) => (row.supplierId ?? activeSupplierId) === activeSupplierId);

  React.useEffect(() => {
    if (suppliers.length && !suppliers.some((supplier) => supplier.id === supplierId)) setSupplierId(suppliers[0].id);
  }, [supplierId, suppliers]);

  React.useEffect(() => {
    if (!activeSupplierId || !rows.some((row) => !row.supplierId)) return;
    setRows((prev) => prev.map((row) => row.supplierId ? row : { ...row, supplierId: activeSupplierId }));
  }, [activeSupplierId, rows, setRows]);

  const addRow = () => setRows((prev) => [...prev, { id: id(), supplierId: activeSupplierId, product: '', packaging: '', unitValue: '', countingUnit: '' }]);
  const removeRow = (rowId: string) => setRows((prev) => prev.filter((row) => row.id !== rowId));
  const updateText = (rowId: string, key: 'product' | 'countingUnit', value: string) =>
    setRows((prev) => prev.map((row) => row.id === rowId ? { ...row, [key]: value } : row));
  const updateNumber = (rowId: string, key: NumericColumn, value: string) => {
    setDrafts((prev) => ({ ...prev, [`${rowId}-${key}`]: value }));
    setRows((prev) => prev.map((row) => row.id === rowId ? { ...row, [key]: toNumber(value) } : row));
  };
  const clearDraft = (rowId: string, key: NumericColumn) => setDrafts((prev) => {
    const next = { ...prev };
    delete next[`${rowId}-${key}`];
    return next;
  });

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsImporting(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('Aucun onglet lisible dans le fichier.');
      const rawRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
      const headerIndex = rawRows.findIndex((row) => row.some((cell) => clean(cell)));
      if (headerIndex === -1) throw new Error('Impossible de trouver les en-tetes.');
      const headers = rawRows[headerIndex];
      const productCol = findCol(headers, ['produit', 'product', 'article', 'nom', 'designation', 'libelle']);
      const packagingCol = findCol(headers, ['colisage', 'packaging', 'conditionnement', 'colis', 'pcb', 'pack']);
      const unitValueCol = findCol(headers, ['valeur unite', 'valeur unitaire', 'unit value', 'unitvalue', 'pu']);
      const countingUnitCol = findCol(headers, ['unite de comptage', 'unite comptage', 'comptage', 'unite inventaire', 'unite stock', 'counting unit']);
      const importedRows: OrderParameterRow[] = rawRows.slice(headerIndex + 1).map((row) => ({
        id: id(),
        supplierId: activeSupplierId,
        product: clean(row[productCol >= 0 ? productCol : 0]),
        packaging: cellNumber(row[packagingCol >= 0 ? packagingCol : 1]),
        unitValue: cellNumber(row[unitValueCol >= 0 ? unitValueCol : 2]),
        countingUnit: countingUnitCol >= 0 ? normalizeImportedCountingUnit(row[countingUnitCol]) : '',
      })).filter((row) => row.product || row.packaging !== '' || row.unitValue !== '' || row.countingUnit);
      if (!importedRows.length) throw new Error('Aucune ligne exploitable trouvee.');
      setRows((prev) => [...prev.filter((row) => row.supplierId !== activeSupplierId), ...importedRows]);
      setDrafts({});
      showToast(`${importedRows.length} ligne(s) importee(s) pour ${activeSupplier?.name ?? 'ce fournisseur'}`, 'success');
    } catch (error) {
      showToast(`Import impossible: ${(error as Error).message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3DDC0] p-4 text-[#2F1D14] md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-col gap-4 rounded-3xl bg-[#3A2116] p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <h1 className="text-3xl font-black text-[#FFF7EA]">Parametre commandes</h1>
            <AppNavTile type="button" onClick={() => setView('stats')} eyebrow="Retour" icon="back" tone="dark" size="md">Parametres</AppNavTile>
          </div>
          <div className="flex flex-wrap gap-3">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importFile} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={isImporting} className="rounded-xl bg-[#FFF7EA] px-5 py-3 text-sm font-black uppercase text-[#4D2B18] disabled:opacity-70">{isImporting ? 'Import...' : 'Importer Excel'}</button>
            <button type="button" onClick={addRow} className="rounded-xl bg-[#F7D66A] px-5 py-3 text-sm font-black uppercase text-[#4D2B18]">+ Ajouter une ligne</button>
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-[#D8A96E] bg-[#FFFDF8] p-3 shadow">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-[#6A432D]">Fournisseur actif</div>
          <div className="flex flex-wrap gap-2">
            {suppliers.map((supplier) => {
              const active = supplier.id === activeSupplierId;
              const count = rows.filter((row) => row.supplierId === supplier.id).length;
              return <button key={supplier.id} type="button" onClick={() => setSupplierId(supplier.id)} className={`rounded-xl border-2 px-4 py-2 text-sm font-black uppercase ${active ? 'border-[#3A2116] bg-[#3A2116] text-[#FFF7EA]' : 'border-[#D8A96E] bg-white text-[#4D2B18]'}`}>{supplier.name}<span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[11px]">{count}</span></button>;
            })}
          </div>
          <p className="mt-3 text-xs font-semibold text-[#6A432D]">L'import Excel remplace uniquement les lignes du fournisseur actif.</p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-[#D8A96E] bg-[#FFFDF8] shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-[#3A2116] text-[#FFF7EA]"><tr><th className="px-4 py-4 text-xs font-black uppercase">Produit</th><th className="w-44 px-4 py-4 text-xs font-black uppercase">Colisage</th><th className="w-44 px-4 py-4 text-xs font-black uppercase">Valeur unite</th><th className="w-56 px-4 py-4 text-xs font-black uppercase">Unite de comptage</th><th className="w-36 px-4 py-4 text-right text-xs font-black uppercase">Actions</th></tr></thead>
              <tbody>
                {visibleRows.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-sm font-bold text-[#6A432D]">Aucune ligne pour ce fournisseur.</td></tr> : visibleRows.map((row) => (
                  <tr key={row.id} className="border-t border-[#E8D8C8]">
                    <td className="px-4 py-3"><input value={row.product} onChange={(e) => updateText(row.id, 'product', e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm font-bold" placeholder="Nom du produit" /></td>
                    <td className="px-4 py-3"><input inputMode="decimal" value={drafts[`${row.id}-packaging`] ?? toInput(row.packaging)} onChange={(e) => updateNumber(row.id, 'packaging', e.target.value)} onBlur={() => clearDraft(row.id, 'packaging')} className="w-full rounded-xl border px-3 py-2 text-sm font-bold" placeholder="0" /></td>
                    <td className="px-4 py-3"><input inputMode="decimal" value={drafts[`${row.id}-unitValue`] ?? toInput(row.unitValue)} onChange={(e) => updateNumber(row.id, 'unitValue', e.target.value)} onBlur={() => clearDraft(row.id, 'unitValue')} className="w-full rounded-xl border px-3 py-2 text-sm font-bold" placeholder="0" /></td>
                    <td className="px-4 py-3">
                      <select value={row.countingUnit ?? ''} onChange={(e) => updateText(row.id, 'countingUnit', e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 text-sm font-bold">
                        {getCountingUnitOptions(row.countingUnit).map((option) => (
                          <option key={option || 'empty'} value={option}>{option || 'À choisir'}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => removeRow(row.id)} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-black uppercase text-red-700">Suppr.</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderParametersPage;
