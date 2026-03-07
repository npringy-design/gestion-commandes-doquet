// =============================================================
// pages/SupplierSettingsPage.tsx
// Page paramètres des rotations fournisseurs (admin)
// Extraite de App.tsx
// =============================================================

import React from 'react';
import { View, DAYS_OF_WEEK } from '../constants';
import { SupplierConfig, DeliveryRule } from '../types';

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
    updateSupplier(config.id, { deliveryRules: rules, cutoffDay: rules[0].cutoffDay, deliveryDay: rules[0].deliveryDay });
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
      <div className="max-w-6xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-[#ffd700] text-4xl font-black uppercase">Rotation Fournisseurs</h1>
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

        {/* Liste des fournisseurs */}
        <div className="space-y-6">
          {Object.values(configs).map((config: SupplierConfig) => {
            const rules = getRules(config);
            return (
              <div
                key={config.id}
                className="bg-white/5 border border-white/10 p-4 sm:p-6 lg:p-8 rounded-[40px]"
              >
                <div className="flex items-center justify-between gap-4 mb-5">
                  <span className="text-[#ffd700] font-black uppercase text-2xl">{config.name}</span>
                  <div className="flex items-center gap-3">
                    <label className="text-white/70 text-xs font-black uppercase tracking-widest">Heure cut-off</label>
                    <input
                      type="time"
                      value={config.cutoffTime}
                      onChange={e => updateSupplier(config.id, { cutoffTime: e.target.value })}
                      className="bg-white/10 text-white px-3 py-2 rounded-xl border border-white/10 outline-none focus:border-[#ffd700] font-bold text-sm"
                    />
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

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => addRule(config)}
                    className="px-4 py-2 rounded-xl bg-[#ffd700] text-[#1a0f0a] font-black uppercase text-xs tracking-widest hover:bg-[#ffed4a]"
                  >
                    + Ajouter une règle
                  </button>
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
