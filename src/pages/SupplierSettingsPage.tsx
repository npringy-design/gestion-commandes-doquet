// =============================================================
// pages/SupplierSettingsPage.tsx
// Page paramètres des rotations fournisseurs (admin)
// =============================================================

import React from 'react';
import { View, DAYS_OF_WEEK, slugifySupplierId } from '../constants';
import { SupplierConfig, DeliveryRule } from '../types';

interface SupplierSettingsPageProps {
  setView:    (v: View) => void;
  configs:    Record<string, SupplierConfig>;
  setConfigs: React.Dispatch<React.SetStateAction<Record<string, SupplierConfig>>>;
}

interface CreateSupplierForm {
  name: string;
  subtitle: string;
  cutoffTime: string;
  cutoffDay: number;
  deliveryDay: number;
}

const INITIAL_FORM: CreateSupplierForm = {
  name: '',
  subtitle: '',
  cutoffTime: '10:00',
  cutoffDay: 2,
  deliveryDay: 3,
};

const SupplierSettingsPage: React.FC<SupplierSettingsPageProps> = ({
  setView, configs, setConfigs,
}) => {
  const [showCreate, setShowCreate] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [form, setForm] = React.useState<CreateSupplierForm>(INITIAL_FORM);
  const [formError, setFormError] = React.useState('');

  const visibleConfigs = React.useMemo(
    () => Object.values(configs).filter((config) => !config.isArchived),
    [configs],
  );

  const archivedConfigs = React.useMemo(
    () => Object.values(configs).filter((config) => config.isArchived),
    [configs],
  );

  const updateSupplier = (supplierId: string, patch: Partial<SupplierConfig>) => {
    setConfigs(prev => ({ ...prev, [supplierId]: { ...prev[supplierId], ...patch } }));
  };

  const getRules = (config: SupplierConfig): DeliveryRule[] => {
    return config.deliveryRules ?? [];
  };

  const updateRule = (config: SupplierConfig, idx: number, patch: Partial<DeliveryRule>) => {
    const rules = [...getRules(config)];
    if (!rules[idx]) return;
    rules[idx] = { ...rules[idx], ...patch };
    updateSupplier(config.id, {
      deliveryRules: rules,
      cutoffDay: rules[0]?.cutoffDay ?? config.cutoffDay,
      deliveryDay: rules[0]?.deliveryDay ?? config.deliveryDay,
    });
  };

  const addRule = (config: SupplierConfig) => {
    const rules = [...getRules(config)];
    const last = rules[rules.length - 1] ?? { cutoffDay: config.cutoffDay, deliveryDay: config.deliveryDay };
    rules.push({ ...last });
    updateSupplier(config.id, {
      deliveryRules: rules,
      cutoffDay: rules[0]?.cutoffDay ?? config.cutoffDay,
      deliveryDay: rules[0]?.deliveryDay ?? config.deliveryDay,
    });
  };

  const removeRule = (config: SupplierConfig, idx: number) => {
    const rules = [...getRules(config)];
    if (!rules[idx]) return;
    rules.splice(idx, 1);
    updateSupplier(config.id, {
      deliveryRules: rules,
      cutoffDay: rules[0]?.cutoffDay ?? config.cutoffDay,
      deliveryDay: rules[0]?.deliveryDay ?? config.deliveryDay,
    });
  };

  const archiveSupplier = (config: SupplierConfig) => {
    const confirmation = window.confirm(
      `Archiver le fournisseur "${config.name}" ?\n\nIl disparaîtra des pages Commande et Calcul ratio, mais restera récupérable depuis la section Archives.`
    );
    if (!confirmation) return;
    updateSupplier(config.id, { isArchived: true });
  };

  const restoreSupplier = (config: SupplierConfig) => {
    updateSupplier(config.id, { isArchived: false });
  };

  const deleteSupplierPermanently = (config: SupplierConfig) => {
    const confirmation = window.confirm(
      `Supprimer définitivement le fournisseur "${config.name}" ?

Cette action est irréversible.`
    );
    if (!confirmation) return;

    setConfigs((prev) => {
      const next = { ...prev };
      delete next[config.id];
      return next;
    });
  };

  const createSupplier = () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError('Le nom du fournisseur est obligatoire.');
      return;
    }

    const generatedId = slugifySupplierId(trimmedName);
    if (!generatedId) {
      setFormError('Impossible de générer un identifiant fournisseur valide.');
      return;
    }

    if (configs[generatedId] && !configs[generatedId].isArchived) {
      setFormError('Un fournisseur actif avec ce nom existe déjà.');
      return;
    }

    const newSupplier: SupplierConfig = {
      id: generatedId,
      name: trimmedName,
      subtitle: form.subtitle.trim() || 'Nouveau fournisseur',
      cutoffTime: form.cutoffTime,
      cutoffDay: form.cutoffDay,
      deliveryDay: form.deliveryDay,
      deliveryRules: [{ cutoffDay: form.cutoffDay, deliveryDay: form.deliveryDay }],
      isArchived: false,
      createdAt: new Date().toISOString(),
    };

    setConfigs(prev => ({
      ...prev,
      [generatedId]: newSupplier,
    }));

    setShowCreate(false);
    setForm(INITIAL_FORM);
    setFormError('');
  };

  return (
    <div className="min-h-screen bg-[#1a0f0a] p-4 sm:p-8 lg:p-12 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}
      />
      <div className="max-w-6xl mx-auto relative z-10">

        <div className="flex flex-col gap-4 mb-10">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <h1 className="text-[#ffd700] text-4xl font-black uppercase">Paramètres Fournisseurs</h1>
            <div className="flex gap-4 flex-wrap justify-end">
              <button
                onClick={() => setShowCreate(v => !v)}
                className="px-6 py-3 bg-[#ffd700] text-[#1a0f0a] border border-[#ffd700] rounded-2xl hover:bg-[#ffed4a] font-black uppercase text-xs tracking-widest transition-all"
              >
                + Créer un fournisseur
              </button>
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

          {showCreate && (
            <div className="bg-white/5 border border-white/10 p-5 rounded-[32px]">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
                <div className="xl:col-span-2">
                  <label className="block text-white/70 text-xs font-black uppercase tracking-widest mb-2">Nom fournisseur</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/10 text-white px-4 py-3 rounded-2xl border border-white/10 outline-none focus:border-[#ffd700] font-bold"
                    placeholder="Ex. C10"
                  />
                </div>
                <div className="xl:col-span-1">
                  <label className="block text-white/70 text-xs font-black uppercase tracking-widest mb-2">Sous-titre</label>
                  <input
                    value={form.subtitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                    className="w-full bg-white/10 text-white px-4 py-3 rounded-2xl border border-white/10 outline-none focus:border-[#ffd700] font-bold"
                    placeholder="Boissons • Softs"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-xs font-black uppercase tracking-widest mb-2">Cut-off jour</label>
                  <select
                    value={form.cutoffDay}
                    onChange={(e) => setForm((prev) => ({ ...prev, cutoffDay: Number(e.target.value) }))}
                    className="w-full bg-white/10 text-white px-4 py-3 rounded-2xl border border-white/10 outline-none focus:border-[#ffd700] font-bold"
                  >
                    {DAYS_OF_WEEK.map((d, i) => (
                      <option key={i} value={i} className="text-black">{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/70 text-xs font-black uppercase tracking-widest mb-2">Livraison jour</label>
                  <select
                    value={form.deliveryDay}
                    onChange={(e) => setForm((prev) => ({ ...prev, deliveryDay: Number(e.target.value) }))}
                    className="w-full bg-white/10 text-white px-4 py-3 rounded-2xl border border-white/10 outline-none focus:border-[#ffd700] font-bold"
                  >
                    {DAYS_OF_WEEK.map((d, i) => (
                      <option key={i} value={i} className="text-black">{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/70 text-xs font-black uppercase tracking-widest mb-2">Heure cut-off</label>
                  <input
                    type="time"
                    value={form.cutoffTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, cutoffTime: e.target.value }))}
                    className="w-full bg-white/10 text-white px-4 py-3 rounded-2xl border border-white/10 outline-none focus:border-[#ffd700] font-bold"
                  />
                </div>
              </div>

              {formError && <div className="mt-3 text-sm font-bold text-red-300">{formError}</div>}

              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => { setShowCreate(false); setForm(INITIAL_FORM); setFormError(''); }}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white font-black uppercase text-xs tracking-widest"
                >
                  Annuler
                </button>
                <button
                  onClick={createSupplier}
                  className="px-5 py-2 rounded-xl bg-[#ffd700] text-[#1a0f0a] font-black uppercase text-xs tracking-widest hover:bg-[#ffed4a]"
                >
                  Créer et activer
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {visibleConfigs.map((config: SupplierConfig) => {
            const rules = getRules(config);
            return (
              <div
                key={config.id}
                className="bg-white/5 border border-white/10 p-4 sm:p-6 lg:p-8 rounded-[40px]"
              >
                <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
                  <div className="flex-1 min-w-[280px] max-w-xl">
                    <label className="block text-white/70 text-xs font-black uppercase tracking-widest mb-2">Nom fournisseur</label>
                    <input
                      value={config.name}
                      onChange={e => updateSupplier(config.id, { name: e.target.value })}
                      className="w-full bg-white/10 text-[#ffd700] px-4 py-3 rounded-2xl border border-white/10 outline-none focus:border-[#ffd700] font-black uppercase text-xl"
                      placeholder="Nom du fournisseur"
                    />
                    <div className="mt-3">
                      <label className="block text-white/50 text-[11px] font-black uppercase tracking-widest mb-2">Sous-titre</label>
                      <input
                        value={config.subtitle || ''}
                        onChange={e => updateSupplier(config.id, { subtitle: e.target.value })}
                        className="w-full bg-white/10 text-white px-4 py-2.5 rounded-2xl border border-white/10 outline-none focus:border-[#ffd700] font-bold"
                        placeholder="Ex. Boissons • Softs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    <label className="text-white/70 text-xs font-black uppercase tracking-widest">Heure cut-off</label>
                    <input
                      type="time"
                      value={config.cutoffTime}
                      onChange={e => updateSupplier(config.id, { cutoffTime: e.target.value })}
                      className="bg-white/10 text-white px-3 py-2 rounded-xl border border-white/10 outline-none focus:border-[#ffd700] font-bold text-sm"
                    />
                    <button
                      onClick={() => archiveSupplier(config)}
                      className="px-4 py-2 rounded-xl bg-red-500/20 text-red-200 border border-red-300/20 text-xs font-black uppercase tracking-wide hover:bg-red-500/30"
                    >
                      Archiver
                    </button>
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
                      {rules.length === 0 ? (
                        <tr className="border-t border-white/10">
                          <td colSpan={4} className="px-4 py-5 text-center text-white/55 font-semibold">
                            Aucune règle pour ce fournisseur. Clique sur <span className="text-[#ffd700]">+ Ajouter une règle</span>.
                          </td>
                        </tr>
                      ) : (
                        rules.map((rule, idx) => (
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

        <div className="mt-10 bg-white/5 border border-white/10 rounded-[32px] p-5 sm:p-6">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <div>
              <div className="text-white font-black uppercase tracking-widest text-sm">Archives fournisseurs</div>
              <div className="text-white/55 text-sm mt-1">
                {archivedConfigs.length > 0
                  ? `${archivedConfigs.length} fournisseur${archivedConfigs.length > 1 ? 's' : ''} archivé${archivedConfigs.length > 1 ? 's' : ''}`
                  : 'Aucun fournisseur archivé'}
              </div>
            </div>
            <div className="text-[#ffd700] font-black text-xl">{showArchived ? '−' : '+'}</div>
          </button>

          {showArchived && archivedConfigs.length > 0 && (
            <div className="mt-5 space-y-4">
              {archivedConfigs.map((config) => (
                <div
                  key={config.id}
                  className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4 flex items-center justify-between gap-4 flex-wrap"
                >
                  <div>
                    <div className="text-[#ffd700] font-black uppercase text-lg">{config.name}</div>
                    <div className="text-white/60 text-sm font-semibold">{config.subtitle || 'Fournisseur archivé'}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    <button
                      onClick={() => restoreSupplier(config)}
                      className="px-4 py-2 rounded-xl bg-[#ffd700] text-[#1a0f0a] font-black uppercase text-xs tracking-widest hover:bg-[#ffed4a]"
                    >
                      Restaurer
                    </button>
                    <button
                      onClick={() => deleteSupplierPermanently(config)}
                      className="px-4 py-2 rounded-xl bg-red-500/20 text-red-200 border border-red-300/20 text-xs font-black uppercase tracking-wide hover:bg-red-500/30"
                    >
                      Supprimer définitivement
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierSettingsPage;
