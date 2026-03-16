import React from 'react';
import type { View } from '../constants';
import type { DailyCoversState } from '../utils/dateHelpers';
import type { ProductWithHistory } from '../data';
import type { PrepBatch, PrepConfig } from '../types';

interface PrepSheetPageProps {
  setView: (view: View) => void;
  dailyCovers: DailyCoversState;
  products: ProductWithHistory[];
  prepConfigs: Record<string, PrepConfig>;
  setPrepConfigs: React.Dispatch<React.SetStateAction<Record<string, PrepConfig>>>;
  prepBatches: PrepBatch[];
  setPrepBatches: React.Dispatch<React.SetStateAction<PrepBatch[]>>;
  getProductStats: (product: ProductWithHistory) => {
    avgRatio: number;
    mR: Record<string, number>;
    mS: Record<string, { value: number; isImported: boolean; isValidated: boolean }>;
  };
}

const DEFAULT_DLC_HOURS = 24;
const toNumber = (value: number | '' | undefined) => Number(value || 0);

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInputValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toDateTimeLocalValue = (date: Date) => `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getForecastForDate = (dateStr: string, dailyCovers: DailyCoversState) => {
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { midi: 0, soir: 0, total: 0 };
  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthKey = monthKeys[date.getMonth()];
  const day = dailyCovers[monthKey]?.[date.getDate() - 1];
  const midi = Number(day?.midi || 0);
  const soir = Number(day?.soir || 0);
  return { midi, soir, total: midi + soir };
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const PrepSheetPage: React.FC<PrepSheetPageProps> = ({
  setView,
  dailyCovers,
  products,
  prepConfigs,
  setPrepConfigs,
  prepBatches,
  setPrepBatches,
  getProductStats,
}) => {
  const [selectedDate, setSelectedDate] = React.useState(() => toDateInputValue(new Date()));
  const [search, setSearch] = React.useState('');
  const [showOnlyEnabled, setShowOnlyEnabled] = React.useState(true);
  const [draftLotQty, setDraftLotQty] = React.useState<Record<string, string>>({});
  const [draftLotProducedAt, setDraftLotProducedAt] = React.useState<Record<string, string>>({});
  const [draftLotNotes, setDraftLotNotes] = React.useState<Record<string, string>>({});

  const forecast = React.useMemo(() => getForecastForDate(selectedDate, dailyCovers), [selectedDate, dailyCovers]);
  const nowTs = Date.now();
  const selectedDayStart = startOfDay(new Date(`${selectedDate}T12:00:00`)).getTime();
  const selectedDayEnd = selectedDayStart + 24 * 60 * 60 * 1000 - 1;

  const effectiveConfigs = React.useMemo(() => {
    const map: Record<string, PrepConfig> = {};
    products.forEach((product) => {
      const existing = prepConfigs[product.id];
      const avgRatio = getProductStats(product).avgRatio;
      map[product.id] = {
        enabled: existing?.enabled ?? false,
        ratioPerCover: existing?.ratioPerCover ?? (avgRatio > 0 ? Number(avgRatio.toFixed(3)) : ''),
        secondaryDlcHours: existing?.secondaryDlcHours ?? DEFAULT_DLC_HOURS,
        targetBuffer: existing?.targetBuffer ?? '',
        notes: existing?.notes ?? '',
      };
    });
    return map;
  }, [products, prepConfigs, getProductStats]);

  const lotsByProduct = React.useMemo(() => {
    const map: Record<string, PrepBatch[]> = {};
    prepBatches.forEach((batch) => {
      if (!map[batch.productId]) map[batch.productId] = [];
      map[batch.productId].push(batch);
    });
    Object.values(map).forEach((batches) => {
      batches.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
    });
    return map;
  }, [prepBatches]);

  const filteredProducts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return products.filter((product) => {
      const cfg = effectiveConfigs[product.id];
      if (showOnlyEnabled && !cfg.enabled) return false;
      if (!normalizedSearch) return true;
      return product.name.toLowerCase().includes(normalizedSearch) || product.searchName.toLowerCase().includes(normalizedSearch);
    });
  }, [products, effectiveConfigs, search, showOnlyEnabled]);

  const rows = React.useMemo(() => filteredProducts.map((product) => {
    const config = effectiveConfigs[product.id];
    const lots = lotsByProduct[product.id] ?? [];

    const usableQty = lots
      .filter((batch) => batch.remainingQty > 0 && new Date(batch.expiresAt).getTime() >= nowTs)
      .reduce((sum, batch) => sum + batch.remainingQty, 0);

    const expiringTodayQty = lots
      .filter((batch) => batch.remainingQty > 0)
      .filter((batch) => {
        const expTs = new Date(batch.expiresAt).getTime();
        return expTs >= selectedDayStart && expTs <= selectedDayEnd;
      })
      .reduce((sum, batch) => sum + batch.remainingQty, 0);

    const expiredQty = lots
      .filter((batch) => batch.remainingQty > 0 && new Date(batch.expiresAt).getTime() < nowTs)
      .reduce((sum, batch) => sum + batch.remainingQty, 0);

    const ratio = toNumber(config.ratioPerCover);
    const targetBuffer = toNumber(config.targetBuffer);
    const theoreticalNeed = ratio * forecast.total;
    const recommendedProduction = Math.max(0, Math.ceil(theoreticalNeed + targetBuffer - usableQty));

    return {
      product,
      config,
      lots,
      ratio,
      usableQty,
      expiringTodayQty,
      expiredQty,
      theoreticalNeed,
      recommendedProduction,
      avgRatio: getProductStats(product).avgRatio,
    };
  }), [effectiveConfigs, filteredProducts, forecast.total, getProductStats, lotsByProduct, nowTs, selectedDayEnd, selectedDayStart]);

  const totalRecommended = rows.reduce((sum, row) => sum + row.recommendedProduction, 0);
  const totalUsable = rows.reduce((sum, row) => sum + row.usableQty, 0);
  const totalExpiring = rows.reduce((sum, row) => sum + row.expiringTodayQty, 0);

  const updateConfig = (productId: string, patch: Partial<PrepConfig>) => {
    setPrepConfigs((prev) => {
      const current = effectiveConfigs[productId];
      return {
        ...prev,
        [productId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const handleNumericConfigChange = (productId: string, field: keyof Pick<PrepConfig, 'ratioPerCover' | 'secondaryDlcHours' | 'targetBuffer'>, rawValue: string) => {
    updateConfig(productId, {
      [field]: rawValue === '' ? '' : Math.max(0, Number(rawValue) || 0),
    } as Partial<PrepConfig>);
  };

  const createLot = (productId: string) => {
    const qty = Math.max(0, Number(draftLotQty[productId] || 0));
    if (!qty) return;
    const config = effectiveConfigs[productId];
    const producedAt = draftLotProducedAt[productId] || toDateTimeLocalValue(new Date());
    const producedAtDate = new Date(producedAt);
    const expiresAt = new Date(producedAtDate.getTime() + toNumber(config.secondaryDlcHours || DEFAULT_DLC_HOURS) * 60 * 60 * 1000);

    const batch: PrepBatch = {
      id: `${productId}_${Date.now()}`,
      productId,
      quantity: qty,
      remainingQty: qty,
      producedAt: producedAtDate.toISOString(),
      expiresAt: expiresAt.toISOString(),
      note: (draftLotNotes[productId] || '').trim(),
    };

    setPrepBatches((prev) => [batch, ...prev]);
    setDraftLotQty((prev) => ({ ...prev, [productId]: '' }));
    setDraftLotProducedAt((prev) => ({ ...prev, [productId]: toDateTimeLocalValue(new Date()) }));
    setDraftLotNotes((prev) => ({ ...prev, [productId]: '' }));
  };

  const consumeLot = (batchId: string, amount: number) => {
    setPrepBatches((prev) => prev.map((batch) => (
      batch.id === batchId
        ? { ...batch, remainingQty: Math.max(0, batch.remainingQty - amount) }
        : batch
    )));
  };

  const removeBatch = (batchId: string) => {
    setPrepBatches((prev) => prev.filter((batch) => batch.id !== batchId));
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] p-3 lg:p-6 text-xs text-slate-800">
      <div className="max-w-[1700px] mx-auto space-y-4 lg:space-y-6">
        <div className="bg-white rounded-[28px] shadow-xl border border-slate-200 p-4 lg:p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Production terrain</div>
              <h1 className="text-2xl lg:text-4xl font-black uppercase tracking-tighter text-slate-900">Feuille de mise en place</h1>
              <p className="mt-1 text-sm text-slate-500 font-semibold">
                V1 : besoin journalier selon les couverts, ratio produit et DLC secondaire encore exploitable.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setView('home')}
                className="px-4 py-3 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest shadow"
              >
                Accueil
              </button>
              <button
                onClick={() => setView('daily_forecast')}
                className="px-4 py-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-black uppercase tracking-widest"
              >
                Journalier
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-4">
          <div className="bg-white rounded-[26px] border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-black mb-2">Date</div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none"
            />
          </div>
          <div className="bg-white rounded-[26px] border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-black mb-2">Prévi jour</div>
            <div className="text-3xl font-black tracking-tight text-slate-900">{forecast.total}</div>
            <div className="mt-2 text-[11px] text-slate-500 font-semibold">Midi {forecast.midi} • Soir {forecast.soir}</div>
          </div>
          <div className="bg-white rounded-[26px] border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-black mb-2">Qté utilisable</div>
            <div className="text-3xl font-black tracking-tight text-emerald-700">{totalUsable}</div>
            <div className="mt-2 text-[11px] text-slate-500 font-semibold">Lots encore valides à la minute</div>
          </div>
          <div className="bg-white rounded-[26px] border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-black mb-2">Prod conseillée</div>
            <div className="text-3xl font-black tracking-tight text-orange-600">{totalRecommended}</div>
            <div className="mt-2 text-[11px] text-slate-500 font-semibold">{totalExpiring} à écouler aujourd’hui</div>
          </div>
        </div>

        <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm p-4 lg:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
            />
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600">
              <input
                type="checkbox"
                checked={showOnlyEnabled}
                onChange={(e) => setShowOnlyEnabled(e.target.checked)}
                className="accent-emerald-600 w-4 h-4"
              />
              Seulement activés
            </label>
            <div className="text-[11px] font-bold text-slate-500">{rows.length} produit(s) affiché(s)</div>
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((row) => {
            const { product, config, lots, ratio, usableQty, theoreticalNeed, recommendedProduction, expiringTodayQty, expiredQty, avgRatio } = row;
            const lotDateDefault = draftLotProducedAt[product.id] || toDateTimeLocalValue(new Date());
            const activeLots = lots.filter((batch) => batch.remainingQty > 0);
            return (
              <div key={product.id} className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 lg:p-5 border-b border-slate-100">
                  <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-4">
                    <div className="min-w-0 2xl:w-[260px]">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={(e) => updateConfig(product.id, { enabled: e.target.checked })}
                          className="w-5 h-5 accent-emerald-600"
                        />
                        <div className="min-w-0">
                          <div className="font-black uppercase text-sm lg:text-base text-slate-900 truncate">{product.name}</div>
                          <div className="text-[11px] text-slate-400 font-semibold truncate">{product.searchName}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8 gap-3 flex-1">
                      <label className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Ratio/couvert</span>
                        <input
                          type="number"
                          step="0.001"
                          value={config.ratioPerCover}
                          onChange={(e) => handleNumericConfigChange(product.id, 'ratioPerCover', e.target.value)}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-black outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold">moy. histo {avgRatio.toFixed(3)}</span>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">DLC sec. (h)</span>
                        <input
                          type="number"
                          min="0"
                          value={config.secondaryDlcHours}
                          onChange={(e) => handleNumericConfigChange(product.id, 'secondaryDlcHours', e.target.value)}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-black outline-none"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Tampon</span>
                        <input
                          type="number"
                          min="0"
                          value={config.targetBuffer}
                          onChange={(e) => handleNumericConfigChange(product.id, 'targetBuffer', e.target.value)}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-black outline-none"
                        />
                      </label>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Besoin</div>
                        <div className="text-lg font-black text-slate-900">{theoreticalNeed.toFixed(1)}</div>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500">Utilisable</div>
                        <div className="text-lg font-black text-emerald-700">{usableQty}</div>
                      </div>

                      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-center">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500">À produire</div>
                        <div className="text-lg font-black text-orange-700">{recommendedProduction}</div>
                      </div>

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">Expire ajd</div>
                        <div className="text-lg font-black text-amber-700">{expiringTodayQty}</div>
                      </div>

                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-500">Périmé</div>
                        <div className="text-lg font-black text-rose-700">{expiredQty}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {config.enabled && (
                  <div className="p-4 lg:p-5 bg-[#fffdf8]">
                    <div className="grid grid-cols-1 2xl:grid-cols-[420px_1fr] gap-4">
                      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-3">Ajouter une production</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Qté produite</span>
                            <input
                              type="number"
                              min="0"
                              value={draftLotQty[product.id] ?? ''}
                              onChange={(e) => setDraftLotQty((prev) => ({ ...prev, [product.id]: e.target.value }))}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center font-black outline-none"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prod. le</span>
                            <input
                              type="datetime-local"
                              value={lotDateDefault}
                              onChange={(e) => setDraftLotProducedAt((prev) => ({ ...prev, [product.id]: e.target.value }))}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center font-black outline-none"
                            />
                          </label>
                        </div>
                        <label className="mt-3 flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Note</span>
                          <input
                            type="text"
                            value={draftLotNotes[product.id] ?? ''}
                            onChange={(e) => setDraftLotNotes((prev) => ({ ...prev, [product.id]: e.target.value }))}
                            placeholder="Ex: production midi, reste veille..."
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 font-semibold outline-none"
                          />
                        </label>
                        <button
                          onClick={() => createLot(product.id)}
                          className="mt-3 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-white font-black uppercase tracking-widest"
                        >
                          Enregistrer le lot
                        </button>
                        <div className="mt-2 text-[11px] text-slate-500 font-semibold">
                          Expiration calculée automatiquement selon la DLC secondaire du produit.
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-white p-4 overflow-x-auto">
                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-3">Lots actifs / historique court</div>
                        {activeLots.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-400">
                            Aucun lot saisi pour ce produit.
                          </div>
                        ) : (
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-slate-400 uppercase text-[10px] tracking-widest border-b border-slate-100">
                                <th className="text-left py-2 pr-3">Produit</th>
                                <th className="text-center py-2 px-3">Qté</th>
                                <th className="text-center py-2 px-3">Restant</th>
                                <th className="text-center py-2 px-3">Produit le</th>
                                <th className="text-center py-2 px-3">Expire le</th>
                                <th className="text-center py-2 px-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeLots.map((batch) => {
                                const isExpired = new Date(batch.expiresAt).getTime() < nowTs;
                                return (
                                  <tr key={batch.id} className="border-b border-slate-100 last:border-0">
                                    <td className="py-3 pr-3 font-bold text-slate-700">
                                      <div>{product.name}</div>
                                      {batch.note && <div className="text-[10px] text-slate-400 font-semibold">{batch.note}</div>}
                                    </td>
                                    <td className="py-3 px-3 text-center font-black">{batch.quantity}</td>
                                    <td className="py-3 px-3 text-center font-black text-emerald-700">{batch.remainingQty}</td>
                                    <td className="py-3 px-3 text-center font-semibold text-slate-500">{formatDateTime(batch.producedAt)}</td>
                                    <td className={`py-3 px-3 text-center font-semibold ${isExpired ? 'text-rose-600' : 'text-slate-500'}`}>{formatDateTime(batch.expiresAt)}</td>
                                    <td className="py-3 px-3">
                                      <div className="flex flex-wrap justify-center gap-2">
                                        <button onClick={() => consumeLot(batch.id, 1)} className="rounded-xl bg-slate-900 text-white px-2.5 py-1.5 font-black">-1</button>
                                        <button onClick={() => consumeLot(batch.id, 5)} className="rounded-xl bg-slate-200 text-slate-700 px-2.5 py-1.5 font-black">-5</button>
                                        <button onClick={() => removeBatch(batch.id)} className="rounded-xl bg-rose-100 text-rose-700 px-2.5 py-1.5 font-black">Suppr.</button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PrepSheetPage;
