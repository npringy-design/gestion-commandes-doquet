import React from 'react';
import type { View } from '../constants';
import type { ProductWithHistory } from '../data';
import type { PrepCategory, PrepConfig } from '../types';
import { useAuth } from '../auth/AuthProvider';
import { canEditRatios } from '../lib/permissions';

const CATEGORY_OPTIONS: Array<{ value: PrepCategory; label: string }> = [
  { value: 'poste_chaud', label: 'Poste chaud' },
  { value: 'poste_entree', label: 'Poste entrée' },
  { value: 'poste_dessert', label: 'Poste dessert' },
  { value: 'decongelation', label: 'Décongélation' },
];

interface PrepRatiosPageProps {
  setView: (v: View) => void;
  products: ProductWithHistory[];
  prepConfigs: Record<string, PrepConfig>;
  setPrepConfigs: React.Dispatch<React.SetStateAction<Record<string, PrepConfig>>>;
  getProductStats: (product: ProductWithHistory) => { avgRatio: number };
}

const toNumber = (value: number | '' | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PrepRatiosPage: React.FC<PrepRatiosPageProps> = ({
  setView,
  products,
  prepConfigs,
  setPrepConfigs,
  getProductStats,
}) => {
  const { profile } = useAuth();
  const canEdit = canEditRatios(profile);
  const [search, setSearch] = React.useState('');
  const [onlyEnabled, setOnlyEnabled] = React.useState(false);

  const effectiveConfigs = React.useMemo(() => {
    const next: Record<string, PrepConfig> = {};
    products.forEach((product) => {
      const existing = prepConfigs[product.id];
      const avgRatio = getProductStats(product).avgRatio;
      next[product.id] = {
        enabled: existing?.enabled ?? false,
        category: existing?.category ?? 'poste_chaud',
        ratioPerCover: existing?.ratioPerCover ?? (avgRatio > 0 ? Number(avgRatio.toFixed(3)) : ''),
        secondaryDlcHours: existing?.secondaryDlcHours ?? 24,
        targetBuffer: existing?.targetBuffer ?? '',
        notes: existing?.notes ?? '',
      };
    });
    return next;
  }, [getProductStats, prepConfigs, products]);

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      const cfg = effectiveConfigs[product.id];
      if (onlyEnabled && !cfg.enabled) return false;
      if (!q) return true;
      return product.name.toLowerCase().includes(q) || product.searchName.toLowerCase().includes(q);
    });
  }, [effectiveConfigs, onlyEnabled, products, search]);

  const updateConfig = (productId: string, patch: Partial<PrepConfig>) => {
    setPrepConfigs((prev) => ({
      ...prev,
      [productId]: {
        ...effectiveConfigs[productId],
        ...patch,
      },
    }));
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#F6EFE6_0%,#F2E8DD_45%,#EBDDCE_100%)] text-[#34271F]">
      <div className="mx-auto flex h-screen max-w-[1920px] flex-col gap-3 p-2 sm:p-3 lg:flex-row lg:gap-4 lg:p-3">
        <aside className="w-full shrink-0 lg:w-[260px] xl:w-[280px]">
          <div className="flex flex-col gap-3 lg:sticky lg:top-3">
            <div className="overflow-hidden rounded-[24px] border border-[#B46E58] bg-[linear-gradient(135deg,#A93E2A_0%,#922F20_48%,#7A231A_100%)] shadow-[0_10px_20px_rgba(122,35,26,0.14)]">
              <div className="h-1.5 bg-gradient-to-r from-[#F1C15A] via-[#D86A2C] to-[#A93E2A]" />
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFE1B8]">Hippopotamus Thillois</p>
                <h1 className="mt-2 text-2xl font-black leading-none text-[#FFF9F3] xl:text-3xl">Calcul prod ratio</h1>
                <p className="mt-3 text-xs font-semibold text-[#FFE7CF]">Tu définis ici les produits de mise en place. La feuille de mise en place reprend automatiquement ces réglages.</p>
              </div>
            </div>

            <button
              onClick={() => setView('stats')}
              className="flex items-center justify-center gap-3 rounded-[20px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-4 text-center text-sm font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]"
            >
              Retour paramètres
            </button>

            <button
              onClick={() => setView('prep_sheet')}
              className="rounded-[20px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] px-4 py-5 text-center text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_0_#196A48] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#196A48]"
            >
              Ouvrir feuille de mise en place
            </button>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1">
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D7B79B] bg-[#FAF5EE] shadow-[0_16px_32px_rgba(145,105,75,0.10)]">
            <div className="border-b border-[#B45439] bg-[linear-gradient(180deg,#A93E2A_0%,#912F20_55%,#782219_100%)] px-5 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <h2 className="text-xl font-black uppercase tracking-[0.08em] text-[#FFF8F1]">Paramétrage des produits de mise en place</h2>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un produit..."
                    className="rounded-2xl border border-white/20 bg-white/95 px-4 py-2 text-sm font-bold text-slate-800 outline-none"
                  />
                  <label className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white">
                    <input type="checkbox" checked={onlyEnabled} onChange={(e) => setOnlyEnabled(e.target.checked)} className="h-4 w-4" />
                    Activés uniquement
                  </label>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-[1280px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#F4E4D2] text-[#6C3C2B]">
                  <tr>
                    <th className="px-4 py-3 text-left font-black uppercase">Actif</th>
                    <th className="px-4 py-3 text-left font-black uppercase">Produit</th>
                    <th className="px-4 py-3 text-left font-black uppercase">Poste</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Ratio / couvert</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Ratio moyen vente</th>
                    <th className="px-4 py-3 text-center font-black uppercase">DLC secondaire (h)</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Buffer</th>
                    <th className="px-4 py-3 text-left font-black uppercase">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((product, idx) => {
                    const cfg = effectiveConfigs[product.id];
                    const avgRatio = getProductStats(product).avgRatio;
                    return (
                      <tr key={product.id} className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                        <td className="border-t border-[#E0CCBA] px-4 py-3 align-middle text-center">
                          <input
                            type="checkbox"
                            checked={cfg.enabled}
                            disabled={!canEdit}
                            onChange={(e) => updateConfig(product.id, { enabled: e.target.checked })}
                            className="h-5 w-5"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3 align-middle">
                          <div className="font-black uppercase text-[#4D2B18]">{product.name}</div>
                          <div className="text-[11px] font-semibold text-slate-500">{product.searchName || '—'}</div>
                        </td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3 align-middle">
                          <select
                            value={cfg.category || 'poste_chaud'}
                            disabled={!canEdit}
                            onChange={(e) => updateConfig(product.id, { category: e.target.value as PrepCategory })}
                            className="w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 font-bold outline-none"
                          >
                            {CATEGORY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3 align-middle">
                          <input
                            type="number"
                            step="0.001"
                            value={cfg.ratioPerCover}
                            disabled={!canEdit}
                            onChange={(e) => updateConfig(product.id, { ratioPerCover: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })}
                            className="w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 text-center font-bold outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3 align-middle text-center font-black text-amber-700">{avgRatio.toFixed(3)}</td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3 align-middle">
                          <input
                            type="number"
                            min="0"
                            value={cfg.secondaryDlcHours}
                            disabled={!canEdit}
                            onChange={(e) => updateConfig(product.id, { secondaryDlcHours: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })}
                            className="w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 text-center font-bold outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3 align-middle">
                          <input
                            type="number"
                            min="0"
                            value={cfg.targetBuffer}
                            disabled={!canEdit}
                            onChange={(e) => updateConfig(product.id, { targetBuffer: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })}
                            className="w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 text-center font-bold outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3 align-middle">
                          <input
                            type="text"
                            value={cfg.notes || ''}
                            disabled={!canEdit}
                            onChange={(e) => updateConfig(product.id, { notes: e.target.value })}
                            className="w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 font-semibold outline-none"
                            placeholder="Info poste / quantité mini / remarque..."
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default PrepRatiosPage;
