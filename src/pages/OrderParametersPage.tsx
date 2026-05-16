import React from 'react';
import { View } from '../constants';
import AppNavTile from '../components/AppNavTile';
import type { OrderParameterRow } from '../types';

interface OrderParametersPageProps {
  setView: (v: View) => void;
  rows: OrderParameterRow[];
  setRows: React.Dispatch<React.SetStateAction<OrderParameterRow[]>>;
}

type NumericColumn = 'packaging' | 'unitValue';
type NumericDraftKey = `${string}-${NumericColumn}`;

const createEmptyRow = (): OrderParameterRow => ({
  id: `order-param-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  product: '',
  packaging: '',
  unitValue: '',
});

const parseNumberInput = (value: string): number | '' => {
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return '';
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : '';
};

const formatNumberInput = (value: number | '') => (value === '' ? '' : String(value).replace('.', ','));

const OrderParametersPage: React.FC<OrderParametersPageProps> = ({ setView, rows, setRows }) => {
  const [numericDrafts, setNumericDrafts] = React.useState<Record<NumericDraftKey, string>>({});
  const visibleRows = rows.length > 0 ? rows : [];

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const updateText = (rowId: string, product: string) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, product } : row)));
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(245,166,58,0.28),transparent_30%),linear-gradient(180deg,#FFF7EA_0%,#F3DDC0_46%,#C97933_100%)] text-[#2F1D14]">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-4 rounded-[24px] border border-[#C89245]/55 bg-[linear-gradient(135deg,#3A2116_0%,#69331F_58%,#A85F2A_100%)] p-4 shadow-[0_18px_42px_rgba(54,24,12,0.18)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <h1 className="text-3xl font-black tracking-tight text-[#FFF7EA]">Paramètre commandes</h1>
            <AppNavTile
              type="button"
              onClick={() => setView('stats')}
              eyebrow="Retour"
              icon="back"
              tone="dark"
              size="md"
            >
              Paramètres
            </AppNavTile>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="rounded-xl border-2 border-[#D9A72B] bg-[linear-gradient(180deg,#F7D66A_0%,#E5AF2F_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.1em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]"
          >
            + Ajouter une ligne
          </button>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[#D8A96E] bg-[#FFFDF8] shadow-[0_18px_36px_rgba(54,24,12,0.16)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-[#3A2116] text-[#FFF7EA]">
                <tr>
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.16em]">Produit</th>
                  <th className="w-44 px-4 py-4 text-xs font-black uppercase tracking-[0.16em]">Colisage</th>
                  <th className="w-44 px-4 py-4 text-xs font-black uppercase tracking-[0.16em]">Valeur unité</th>
                  <th className="w-36 px-4 py-4 text-right text-xs font-black uppercase tracking-[0.16em]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm font-bold text-[#6A432D]">
                      Aucune ligne pour le moment.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.id} className="border-t border-[#E8D8C8]">
                      <td className="px-4 py-3">
                        <input
                          value={row.product}
                          onChange={(event) => updateText(row.id, event.target.value)}
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
