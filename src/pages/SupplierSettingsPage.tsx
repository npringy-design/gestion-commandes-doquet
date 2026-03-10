// =============================================================
// pages/SupplierSettingsPage.tsx
// Page paramètres fournisseurs (admin)
// =============================================================

import React from 'react';
import { View, DAYS_OF_WEEK } from '../constants';
import { SupplierConfig, DeliveryRule } from '../types';
import { getSupplierVisual, SUPPLIER_VISUAL_PRESETS } from '../lib/supplierVisuals';

interface SupplierSettingsPageProps {
  setView:    (v: View) => void;
  configs:    Record<string, SupplierConfig>;
  setConfigs: React.Dispatch<React.SetStateAction<Record<string, SupplierConfig>>>;
}

const SupplierSettingsPage: React.FC<SupplierSettingsPageProps> = ({
  setView, configs, setConfigs,
}) => {
  const updateSupplier = (supplierId: string, patch: Partial<SupplierConfig>) => {
    setConfigs(prev => ({ ...prev, [supplierId]: { ...prev[supplierId], ...patch } }));
  };

  const getRules = (config: SupplierConfig): DeliveryRule[] => {
    if (config.deliveryRules && config.deliveryRules.length > 0) return config.deliveryRules;
    return [{ cutoffDay: config.cutoffDay, deliveryDay: config.deliveryDay }];
  };

  const updateRule = (config: SupplierConfig, idx: number, patch: Partial<DeliveryRule>) => {
    const rules = [...getRules(config)];
    rules[idx] = { ...rules[idx], ...patch };
    updateSupplier(config.id, {
      deliveryRules: rules,
      cutoffDay: rules[0].cutoffDay,
      deliveryDay: rules[0].deliveryDay,
    });
  };

  const addRule = (config: SupplierConfig) => {
    const rules = [...getRules(config)];
    const last = rules[rules.length - 1] ?? { cutoffDay: config.cutoffDay, deliveryDay: config.deliveryDay };
    rules.push({ ...last });
    updateSupplier(config.id, {
      deliveryRules: rules,
      cutoffDay: rules[0].cutoffDay,
      deliveryDay: rules[0].deliveryDay,
    });
  };

  const removeRule = (config: SupplierConfig, idx: number) => {
    const rules = [...getRules(config)];
    rules.splice(idx, 1);
    const safe = rules.length > 0 ? rules : [{ cutoffDay: config.cutoffDay, deliveryDay: config.deliveryDay }];
    updateSupplier(config.id, {
      deliveryRules: safe,
      cutoffDay: safe[0].cutoffDay,
      deliveryDay: safe[0].deliveryDay,
    });
  };

  return (
    <div className="min-h-screen bg-[#1a0f0a] p-4 sm:p-8 lg:p-12 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}
      />
      <div className="max-w-7xl mx-auto relative z-10">

        <div className="flex justify-between items-center mb-12 gap-4">
          <h1 className="text-[#ffd700] text-4xl font-black uppercase">Paramètres fournisseurs</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setView('admin_dashboard')}
              className="px-6 py-3 bg-white/5 text-white border border-white/10 rounded-2xl hover:bg-white/10 font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              Retour
            </button>
            <button
              onClick={() => setView('home')}
              className="px-6 py-3 bg-[#ffd700] text-[#1a0f0a] border border-[#ffd700] rounded-2xl hover:bg-[#ffed4a] font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              Accueil
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {Object.values(configs).map((config: SupplierConfig) => {
            const rules = getRules(config);
            const visual = getSupplierVisual(config.visualKey);
            return (
              <div
                key={config.id}
                className="bg-white/5 border border-white/10 p-4 sm:p-6 lg:p-8 rounded-[40px]"
              >
                <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6 xl:gap-8">
                  <div>
                    <div
                      className="relative h-[240px] rounded-[28px] overflow-hidden border border-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.28)]"
                      style={visual.cardStyle}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/15 to-black/75" />
                      <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${visual.accentClassName}`} />
                      <div className="absolute inset-x-0 bottom-0 p-5 z-10">
                        <div className="inline-flex items-center rounded-full bg-black/30 border border-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/85 mb-3 backdrop-blur-sm">
                          {config.subtitle || 'Fournisseur'}
                        </div>
                        <div className="text-white text-3xl font-black uppercase leading-none tracking-[-0.04em] drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]">
                          {config.name}
                        </div>
                      </div>
                    </div>
                    <p className="text-white/55 text-xs mt-3 leading-relaxed">
                      Visuel carte sélectionné : <span className="text-white font-semibold">{visual.name}</span>
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-4 items-end">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block">
                          <span className="text-white/70 text-xs font-black uppercase tracking-widest mb-2 block">Nom fournisseur</span>
                          <input
                            type="text"
                            value={config.name}
                            onChange={e => updateSupplier(config.id, { name: e.target.value })}
                            className="w-full bg-white/10 text-white px-4 py-3 rounded-2xl border border-white/10 outline-none focus:border-[#ffd700] font-bold text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-white/70 text-xs font-black uppercase tracking-widest mb-2 block">Sous-titre carte</span>
                          <input
                            type="text"
                            value={config.subtitle || ''}
                            onChange={e => updateSupplier(config.id, { subtitle: e.target.value })}
                            className="w-full bg-white/10 text-white px-4 py-3 rounded-2xl border border-white/10 outline-none focus:border-[#ffd700] font-bold text-sm"
                          />
                        </label>
                      </div>

                      <label className="block">
                        <span className="text-white/70 text-xs font-black uppercase tracking-widest mb-2 block">Heure cut-off</span>
                        <input
                          type="time"
                          value={config.cutoffTime}
                          onChange={e => updateSupplier(config.id, { cutoffTime: e.target.value })}
                          className="w-full bg-white/10 text-white px-4 py-3 rounded-2xl border border-white/10 outline-none focus:border-[#ffd700] font-bold text-sm"
                        />
                      </label>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-[#ffd700] font-black uppercase text-sm tracking-widest">Visuel de la carte</span>
                        <span className="text-white/45 text-[11px] uppercase tracking-[0.18em]">Choisis le fond affiché sur la page fournisseurs</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {SUPPLIER_VISUAL_PRESETS.map((preset) => {
                          const active = preset.key === visual.key;
                          return (
                            <button
                              type="button"
                              key={preset.key}
                              onClick={() => updateSupplier(config.id, { visualKey: preset.key })}
                              className={`group rounded-[22px] overflow-hidden border transition-all text-left ${active ? 'border-[#ffd700] shadow-[0_0_0_1px_rgba(255,215,0,0.35)]' : 'border-white/10 hover:border-white/25'}`}
                            >
                              <div className="h-28" style={preset.thumbStyle} />
                              <div className="bg-black/35 px-3 py-3">
                                <div className="text-white text-sm font-black leading-tight">{preset.name}</div>
                                <div className="text-white/55 text-[11px] leading-snug mt-1 min-h-[30px]">{preset.description}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-white/10">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="bg-white/10 text-white/80 uppercase text-[11px] tracking-widest">
                          <tr>
                            <th className="px-4 py-3 text-left">Cut-off jour</th>
                            <th className="px-4 py-3 text-left">Heure</th>
                            <th className="px-4 py-3 text-left">Livraison jour</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rules.map((rule, idx) => (
                            <tr key={`${config.id}-${idx}`} className="border-t border-white/10">
                              <td className="px-4 py-3">
                                <select
                                  value={rule.cutoffDay}
                                  onChange={e => updateRule(config, idx, { cutoffDay: Number(e.target.value) })}
                                  className="w-full bg-white/10 text-white p-2 rounded-xl border border-white/10 outline-none focus:border-[#ffd700] font-bold"
                                >
                                  {DAYS_OF_WEEK.map((d, i) => (
                                    <option key={i} value={i} className="text-black">{d}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="time"
                                  value={config.cutoffTime}
                                  onChange={e => updateSupplier(config.id, { cutoffTime: e.target.value })}
                                  className="w-full bg-white/10 text-white p-2 rounded-xl border border-white/10 outline-none focus:border-[#ffd700] font-bold"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={rule.deliveryDay}
                                  onChange={e => updateRule(config, idx, { deliveryDay: Number(e.target.value) })}
                                  className="w-full bg-white/10 text-white p-2 rounded-xl border border-white/10 outline-none focus:border-[#ffd700] font-bold"
                                >
                                  {DAYS_OF_WEEK.map((d, i) => (
                                    <option key={i} value={i} className="text-black">{d}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => removeRule(config, idx)}
                                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-200 border border-red-300/20 text-xs font-black uppercase tracking-wide hover:bg-red-500/30"
                                  disabled={rules.length === 1}
                                >
                                  Suppr.
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => addRule(config)}
                        className="px-4 py-2 rounded-xl bg-[#ffd700] text-[#1a0f0a] font-black uppercase text-xs tracking-widest hover:bg-[#ffed4a]"
                      >
                        + Ajouter une règle
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SupplierSettingsPage;
