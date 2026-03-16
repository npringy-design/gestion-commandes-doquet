import React from 'react';
import type { View } from '../constants';
import type { PrepBatch, PrepCategory, PrepItem } from '../types';
import type { DailyCoversState } from '../utils/dateHelpers';

const CATEGORY_ORDER: PrepCategory[] = ['poste_chaud', 'poste_entree', 'poste_dessert', 'decongelation'];
const CATEGORY_LABELS: Record<PrepCategory, string> = {
  poste_chaud: 'Poste chaud',
  poste_entree: 'Poste entrée',
  poste_dessert: 'Poste dessert',
  decongelation: 'Décongélation',
};
const CATEGORY_ACCENTS: Record<PrepCategory, string> = {
  poste_chaud: 'from-[#A93E2A] to-[#7A231A]',
  poste_entree: 'from-[#B36A28] to-[#8C4C12]',
  poste_dessert: 'from-[#8F3D74] to-[#5F2455]',
  decongelation: 'from-[#2F6DA5] to-[#1C4E78]',
};

interface PrepSheetPageProps {
  setView: (v: View) => void;
  prepItems: PrepItem[];
  prepBatches: PrepBatch[];
  setPrepBatches: React.Dispatch<React.SetStateAction<PrepBatch[]>>;
  dailyCovers: DailyCoversState;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const dtLocalValue = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const parseDate = (value: string) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? new Date() : d; };
const formatDateTime = (value: string) => parseDate(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const monthKeys = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const getCoversForDate = (dailyCovers: DailyCoversState, dateValue: string) => {
  const date = parseDate(dateValue);
  const monthKey = monthKeys[date.getMonth()];
  const day = date.getDate() - 1;
  const line = dailyCovers[monthKey]?.[day];
  if (!line) return 0;
  return (Number(line.midi) || 0) + (Number(line.soir) || 0);
};

const PrepSheetPage: React.FC<PrepSheetPageProps> = ({ setView, prepItems, prepBatches, setPrepBatches, dailyCovers }) => {
  const [selectedDate, setSelectedDate] = React.useState(todayIso());
  const [search, setSearch] = React.useState('');
  const [draftQty, setDraftQty] = React.useState<Record<string, string>>({});
  const [draftProducedAt, setDraftProducedAt] = React.useState<Record<string, string>>({});
  const nowTs = Date.now();
  const forecast = React.useMemo(() => getCoversForDate(dailyCovers, selectedDate), [dailyCovers, selectedDate]);

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return prepItems
      .filter((item) => item.isActive)
      .filter((item) => !q || item.name.toLowerCase().includes(q) || item.searchName.toLowerCase().includes(q))
      .map((item) => {
        const lots = prepBatches.filter((batch) => batch.productId === item.id);
        const usableQty = lots.reduce((sum, batch) => {
          if (batch.remainingQty <= 0) return sum;
          if (new Date(batch.expiresAt).getTime() < nowTs) return sum;
          return sum + batch.remainingQty;
        }, 0);
        const monthRatios = Object.values(item.ratioHistory || {}).filter((v) => Number(v) > 0).map(Number);
        const ratio = monthRatios.length ? monthRatios.reduce((a, b) => a + b, 0) / monthRatios.length : 0;
        const need = ratio * forecast;
        const buffer = Number(item.targetBuffer || 0);
        const dlc = Number(item.secondaryDlcHours || 0);
        const toProduce = Math.max(0, Math.ceil(need - usableQty + buffer));
        return { item, lots, ratio, usableQty, need, buffer, dlc, toProduce };
      });
  }, [forecast, nowTs, prepBatches, prepItems, search]);

  const groupedRows = React.useMemo(() => CATEGORY_ORDER.map((category) => ({ category, rows: rows.filter((row) => row.item.category === category) })).filter((group) => group.rows.length > 0), [rows]);
  const totalUsable = rows.reduce((sum, row) => sum + row.usableQty, 0);
  const totalToProduce = rows.reduce((sum, row) => sum + row.toProduce, 0);

  const createBatch = (itemId: string, dlcHours: number) => {
    const quantity = Number(draftQty[itemId] || 0);
    if (quantity <= 0) return;
    const producedAtValue = draftProducedAt[itemId] || dtLocalValue(new Date());
    const producedAt = new Date(producedAtValue);
    const expiresAt = new Date(producedAt.getTime() + Math.max(0, dlcHours) * 60 * 60 * 1000);
    setPrepBatches((prev) => [...prev, { id: `prep-batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, productId: itemId, quantity, remainingQty: quantity, producedAt: producedAt.toISOString(), expiresAt: expiresAt.toISOString() }]);
    setDraftQty((prev) => ({ ...prev, [itemId]: '' }));
    setDraftProducedAt((prev) => ({ ...prev, [itemId]: dtLocalValue(new Date()) }));
  };

  const consumeBatch = (batchId: string, amount: number) => setPrepBatches((prev) => prev.map((batch) => batch.id === batchId ? { ...batch, remainingQty: Math.max(0, batch.remainingQty - amount) } : batch));
  const deleteBatch = (batchId: string) => setPrepBatches((prev) => prev.filter((batch) => batch.id !== batchId));

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F6EFE6_0%,#F2E8DD_45%,#EBDDCE_100%)] text-slate-900">
      <div className="mx-auto max-w-[1920px] p-3 lg:p-4 space-y-4">
        <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm p-5 lg:p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Production terrain</div>
              <h1 className="text-2xl lg:text-4xl font-black uppercase tracking-tighter text-slate-900">Feuille de mise en place</h1>
              <p className="mt-1 text-sm text-slate-500 font-semibold">La feuille reprend uniquement les productions actives du calcul prod ratio, avec le prévi couverts du jour lié au journalier.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setView('home')} className="px-4 py-3 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest shadow">Accueil</button>
              <button onClick={() => setView('prep_ratios')} className="px-4 py-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-black uppercase tracking-widest">Calcul prod ratio</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-4">
          <div className="bg-white rounded-[26px] border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-black mb-2">Date</div>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none" />
          </div>
          <div className="bg-white rounded-[26px] border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-black mb-2">Prévi du jour</div>
            <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-3xl font-black tracking-tight text-slate-900">{forecast}</div>
            <div className="mt-2 text-[11px] text-slate-500 font-semibold">Valeur récupérée automatiquement depuis le journalier.</div>
          </div>
          <div className="bg-white rounded-[26px] border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-black mb-2">Qté utilisable</div>
            <div className="text-3xl font-black tracking-tight text-emerald-700">{totalUsable}</div>
            <div className="mt-2 text-[11px] text-slate-500 font-semibold">Lots encore valides selon la DLC secondaire</div>
          </div>
          <div className="bg-white rounded-[26px] border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-black mb-2">À produire</div>
            <div className="text-3xl font-black tracking-tight text-[#A93E2A]">{totalToProduce}</div>
            <div className="mt-2 text-[11px] text-slate-500 font-semibold">Besoin théorique - quantité utilisable + buffer</div>
          </div>
        </div>

        <div className="bg-white rounded-[26px] border border-slate-200 p-4 shadow-sm">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une production..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none" />
        </div>

        {groupedRows.length === 0 ? (
          <div className="bg-white rounded-[26px] border border-dashed border-slate-300 p-10 text-center text-slate-500 font-semibold">Aucune production active. Va dans <span className="font-black text-slate-800">Calcul prod ratio</span> pour créer et activer tes lignes.</div>
        ) : groupedRows.map((group) => (
          <section key={group.category} className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
            <div className={`px-5 py-4 bg-gradient-to-r ${CATEGORY_ACCENTS[group.category]} text-white`}>
              <div className="text-[10px] uppercase tracking-[0.24em] font-black text-white/80">Mise en place</div>
              <h2 className="text-2xl font-black uppercase tracking-tight">{CATEGORY_LABELS[group.category]}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1320px] w-full">
                <thead className="bg-[#F4E4D2] text-[#6C3C2B]">
                  <tr>
                    <th className="px-4 py-3 text-left font-black uppercase">Production</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Ratio</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Besoin théo</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Utilisable</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Buffer</th>
                    <th className="px-4 py-3 text-center font-black uppercase">À produire</th>
                    <th className="px-4 py-3 text-center font-black uppercase">DLC</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Nouveau lot</th>
                    <th className="px-4 py-3 text-left font-black uppercase">Lots existants</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, idx) => (
                    <tr key={row.item.id} className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 align-top"><div className="font-black uppercase text-[#4D2B18]">{row.item.name}</div>{row.item.notes ? <div className="mt-1 text-[11px] font-semibold text-slate-500">{row.item.notes}</div> : null}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 text-center font-black">{row.ratio.toFixed(3)}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 text-center font-black">{row.need.toFixed(1)}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 text-center font-black text-emerald-700">{row.usableQty}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 text-center font-black">{row.buffer}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 text-center"><span className="inline-flex items-center justify-center rounded-full bg-[#A93E2A] px-4 py-1.5 text-white font-black text-sm min-w-[70px]">{row.toProduce}</span></td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 text-center font-black">{row.dlc} h</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3">
                        <div className="grid grid-cols-[90px_1fr_auto] gap-2 items-center">
                          <input type="number" min="0" placeholder="Qté" value={draftQty[row.item.id] || ''} onChange={(e) => setDraftQty((prev) => ({ ...prev, [row.item.id]: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center font-bold outline-none" />
                          <input type="datetime-local" value={draftProducedAt[row.item.id] || dtLocalValue(new Date())} onChange={(e) => setDraftProducedAt((prev) => ({ ...prev, [row.item.id]: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none" />
                          <button onClick={() => createBatch(row.item.id, row.dlc)} className="rounded-xl bg-emerald-600 px-3 py-2 text-white font-black uppercase tracking-wider">Ajouter</button>
                        </div>
                      </td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 align-top">
                        <div className="space-y-2 min-w-[420px]">
                          {row.lots.length === 0 ? <div className="text-xs font-semibold text-slate-400">Aucun lot enregistré</div> : row.lots.map((lot) => {
                            const expired = new Date(lot.expiresAt).getTime() < nowTs;
                            return (
                              <div key={lot.id} className={`rounded-2xl border px-3 py-2 ${expired ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-[11px] font-black uppercase text-slate-700">Restant {lot.remainingQty} / {lot.quantity}</div>
                                    <div className="text-[11px] font-semibold text-slate-500">Prod. {formatDateTime(lot.producedAt)} • Exp. {formatDateTime(lot.expiresAt)}</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => consumeBatch(lot.id, 1)} className="rounded-lg border border-slate-200 px-2 py-1 font-black">-1</button>
                                    <button onClick={() => consumeBatch(lot.id, 5)} className="rounded-lg border border-slate-200 px-2 py-1 font-black">-5</button>
                                    <button onClick={() => deleteBatch(lot.id)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 font-black text-red-700">Suppr.</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default PrepSheetPage;
