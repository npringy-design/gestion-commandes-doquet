import React from 'react';
import type { View } from '../constants';
import type { ProductWithHistory } from '../data';
import type { PrepBatch, PrepCategory, PrepConfig, PrepForecastsByDate } from '../types';

const CATEGORY_ORDER: PrepCategory[] = ['poste_chaud', 'poste_entree', 'poste_dessert', 'decongelation'];
const CATEGORY_LABELS: Record<PrepCategory, string> = {
  poste_chaud: 'Poste chaud',
  poste_entree: 'Poste entrée',
  poste_dessert: 'Poste dessert',
  decongelation: 'Décongélation',
};
const CATEGORY_ACCENTS: Record<PrepCategory, string> = {
  poste_chaud: 'from-[#C85A35] to-[#A93E2A]',
  poste_entree: 'from-[#B57A37] to-[#8D5C24]',
  poste_dessert: 'from-[#8A5877] to-[#6B425C]',
  decongelation: 'from-[#468AA4] to-[#2F6D85]',
};

interface PrepSheetPageProps {
  setView: (v: View) => void;
  products: ProductWithHistory[];
  prepConfigs: Record<string, PrepConfig>;
  prepBatches: PrepBatch[];
  setPrepBatches: React.Dispatch<React.SetStateAction<PrepBatch[]>>;
  prepForecasts: PrepForecastsByDate;
  setPrepForecasts: React.Dispatch<React.SetStateAction<PrepForecastsByDate>>;
  getProductStats: (product: ProductWithHistory) => { avgRatio: number };
}

const toNumber = (value: number | '' | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const todayValue = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const dtLocalValue = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
};
const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const PrepSheetPage: React.FC<PrepSheetPageProps> = ({
  setView,
  products,
  prepConfigs,
  prepBatches,
  setPrepBatches,
  prepForecasts,
  setPrepForecasts,
  getProductStats,
}) => {
  const [selectedDate, setSelectedDate] = React.useState(todayValue());
  const [search, setSearch] = React.useState('');
  const [draftQty, setDraftQty] = React.useState<Record<string, string>>({});
  const [draftProducedAt, setDraftProducedAt] = React.useState<Record<string, string>>({});
  const nowTs = Date.now();
  const forecast = prepForecasts[selectedDate] ?? 0;

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .map((product) => {
        const cfg = prepConfigs[product.id];
        if (!cfg?.enabled) return null;
        if (q && !product.name.toLowerCase().includes(q) && !product.searchName.toLowerCase().includes(q)) return null;
        const ratio = toNumber(cfg.ratioPerCover || getProductStats(product).avgRatio || 0);
        const buffer = toNumber(cfg.targetBuffer);
        const dlc = Math.max(1, toNumber(cfg.secondaryDlcHours || 24));
        const category = cfg.category || 'poste_chaud';
        const lots = prepBatches
          .filter((batch) => batch.productId === product.id)
          .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
        const usableQty = lots.filter((batch) => batch.remainingQty > 0 && new Date(batch.expiresAt).getTime() >= nowTs)
          .reduce((sum, batch) => sum + batch.remainingQty, 0);
        const need = ratio * forecast;
        const toProduce = Math.max(0, Math.ceil(need + buffer - usableQty));
        return { product, cfg, category, ratio, buffer, dlc, lots, usableQty, need, toProduce };
      })
      .filter(Boolean) as Array<{ product: ProductWithHistory; cfg: PrepConfig; category: PrepCategory; ratio: number; buffer: number; dlc: number; lots: PrepBatch[]; usableQty: number; need: number; toProduce: number }>;
  }, [forecast, getProductStats, nowTs, prepBatches, prepConfigs, products, search]);

  const groupedRows = React.useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      rows: rows.filter((row) => row.category === category),
    })).filter((group) => group.rows.length > 0);
  }, [rows]);

  const updateForecast = (raw: string) => {
    const next = Math.max(0, Number(raw) || 0);
    setPrepForecasts((prev) => ({ ...prev, [selectedDate]: next }));
  };

  const createBatch = (productId: string, dlcHours: number) => {
    const quantity = Math.max(0, Number(draftQty[productId] || 0));
    if (!quantity) return;
    const producedAtRaw = draftProducedAt[productId] || dtLocalValue(new Date());
    const producedAt = new Date(producedAtRaw);
    const expiresAt = new Date(producedAt.getTime() + dlcHours * 60 * 60 * 1000);
    setPrepBatches((prev) => [
      {
        id: `${productId}_${Date.now()}`,
        productId,
        quantity,
        remainingQty: quantity,
        producedAt: producedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      ...prev,
    ]);
    setDraftQty((prev) => ({ ...prev, [productId]: '' }));
    setDraftProducedAt((prev) => ({ ...prev, [productId]: dtLocalValue(new Date()) }));
  };

  const consumeBatch = (batchId: string, amount: number) => {
    setPrepBatches((prev) => prev.map((batch) => batch.id === batchId ? { ...batch, remainingQty: Math.max(0, batch.remainingQty - amount) } : batch));
  };

  const deleteBatch = (batchId: string) => setPrepBatches((prev) => prev.filter((batch) => batch.id !== batchId));

  const totalToProduce = rows.reduce((sum, row) => sum + row.toProduce, 0);
  const totalUsable = rows.reduce((sum, row) => sum + row.usableQty, 0);

  return (
    <div className="min-h-screen bg-[#f5f1e8] p-3 lg:p-6 text-xs text-slate-800">
      <div className="max-w-[1750px] mx-auto space-y-4 lg:space-y-6">
        <div className="bg-white rounded-[28px] shadow-xl border border-slate-200 p-4 lg:p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Production terrain</div>
              <h1 className="text-2xl lg:text-4xl font-black uppercase tracking-tighter text-slate-900">Feuille de mise en place</h1>
              <p className="mt-1 text-sm text-slate-500 font-semibold">La feuille reprend les produits activés dans Calcul prod ratio et les regroupe par poste.</p>
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
            <input type="number" min="0" value={forecast} onChange={(e) => updateForecast(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-3xl font-black tracking-tight text-slate-900 outline-none" />
            <div className="mt-2 text-[11px] text-slate-500 font-semibold">Saisie directe dans la feuille, sans passer par le journalier.</div>
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
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit de mise en place..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none" />
        </div>

        {groupedRows.length === 0 ? (
          <div className="bg-white rounded-[26px] border border-dashed border-slate-300 p-10 text-center text-slate-500 font-semibold">
            Aucun produit activé pour la mise en place. Va dans <span className="font-black text-slate-800">Calcul prod ratio</span> pour en activer.
          </div>
        ) : groupedRows.map((group) => (
          <section key={group.category} className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
            <div className={`px-5 py-4 bg-gradient-to-r ${CATEGORY_ACCENTS[group.category]} text-white`}>
              <div className="text-[10px] uppercase tracking-[0.24em] font-black text-white/80">Mise en place</div>
              <h2 className="text-2xl font-black uppercase tracking-tight">{CATEGORY_LABELS[group.category]}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1450px] w-full">
                <thead className="bg-[#F4E4D2] text-[#6C3C2B]">
                  <tr>
                    <th className="px-4 py-3 text-left font-black uppercase">Produit</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Ratio</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Besoin théo</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Utilisable</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Buffer</th>
                    <th className="px-4 py-3 text-center font-black uppercase">À produire</th>
                    <th className="px-4 py-3 text-center font-black uppercase">DLC sec.</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Nouveau lot</th>
                    <th className="px-4 py-3 text-left font-black uppercase">Lots existants</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, idx) => (
                    <tr key={row.product.id} className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 align-top">
                        <div className="font-black uppercase text-[#4D2B18]">{row.product.name}</div>
                        {row.cfg.notes ? <div className="mt-1 text-[11px] font-semibold text-slate-500">{row.cfg.notes}</div> : null}
                      </td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 align-top text-center font-black">{row.ratio.toFixed(3)}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 align-top text-center font-black">{row.need.toFixed(1)}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 align-top text-center font-black text-emerald-700">{row.usableQty}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 align-top text-center font-black">{row.buffer}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 align-top text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-[#A93E2A] px-4 py-1.5 text-white font-black text-sm min-w-[70px]">{row.toProduce}</span>
                      </td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 align-top text-center font-black">{row.dlc} h</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-3 align-top">
                        <div className="grid grid-cols-[90px_1fr_auto] gap-2 items-center">
                          <input type="number" min="0" placeholder="Qté" value={draftQty[row.product.id] || ''} onChange={(e) => setDraftQty((prev) => ({ ...prev, [row.product.id]: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center font-bold outline-none" />
                          <input type="datetime-local" value={draftProducedAt[row.product.id] || dtLocalValue(new Date())} onChange={(e) => setDraftProducedAt((prev) => ({ ...prev, [row.product.id]: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none" />
                          <button onClick={() => createBatch(row.product.id, row.dlc)} className="rounded-xl bg-emerald-600 px-3 py-2 text-white font-black uppercase tracking-wider">Ajouter</button>
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
