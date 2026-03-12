import React from 'react';
import type { AppState } from '../hooks/useAppState';
import { View } from '../constants';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../components/Toast';
import {
  createSiteBackup,
  listSiteBackups,
  restoreSiteBackup,
  type SiteBackupRow,
} from '../utils/supabase';
import {
  createInitialProducts,
  mergeSupplierConfigsWithDefaults,
  saveState,
} from '../hooks/appStateHelpers';
import { ProductWithHistory } from '../data';
import { SupplierConfig } from '../types';
import { DailyCoversState } from '../utils/dateHelpers';

type SiteBackupsPageProps = {
  setView: (v: View) => void;
  state: AppState;
};

type BackupSnapshot = Record<string, unknown>;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
};

const buildSnapshot = (state: AppState): BackupSnapshot => ({
  covers: state.covers,
  dailyCovers: state.dailyCovers,
  orderStates: state.orderStates,
  inventory: state.detailedInventory,
  salesHtByMonth: state.salesHtByMonth,
  costMatterByMonth: state.costMatterByMonth,
  validatedMonths: state.validatedMonths,
  supplierConfigs: state.supplierConfigs,
  deliveryDateBySupplier: state.deliveryDateBySupplier,
  nextDeliveryDateBySupplier: state.nextDeliveryDateBySupplier,
  products: state.products,
});

const countSnapshotKeys = (snapshot: BackupSnapshot) => Object.keys(snapshot ?? {}).length;

const SiteBackupsPage: React.FC<SiteBackupsPageProps> = ({ setView, state }) => {
  const { activeSiteId, allowedSites } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [backups, setBackups] = React.useState<SiteBackupRow[]>([]);

  const activeSite = React.useMemo(
    () => allowedSites.find((site) => site.id === activeSiteId) ?? null,
    [allowedSites, activeSiteId]
  );

  const applySnapshotLocally = React.useCallback((snapshot: BackupSnapshot) => {
    if (!activeSiteId) return;

    const covers = (snapshot.covers ?? {}) as Record<string, number>;
    const dailyCovers = (snapshot.dailyCovers ?? {}) as DailyCoversState;
    const orderStates = (snapshot.orderStates ?? {}) as AppState['orderStates'];
    const inventory = (snapshot.inventory ?? {}) as Record<string, string>;
    const salesHtByMonth = (snapshot.salesHtByMonth ?? {}) as Record<string, number>;
    const costMatterByMonth = (snapshot.costMatterByMonth ?? {}) as Record<string, number>;
    const validatedMonths = (snapshot.validatedMonths ?? {}) as Record<string, boolean>;
    const supplierConfigs = mergeSupplierConfigsWithDefaults(
      (snapshot.supplierConfigs ?? {}) as Record<string, SupplierConfig>
    );
    const deliveryDateBySupplier = (snapshot.deliveryDateBySupplier ?? {}) as Record<string, string>;
    const nextDeliveryDateBySupplier = (snapshot.nextDeliveryDateBySupplier ?? {}) as Record<string, string>;
    const products = createInitialProducts((snapshot.products ?? []) as ProductWithHistory[]);

    state.setCovers(covers);
    state.setDailyCovers(dailyCovers);
    state.setOrderStates(orderStates);
    state.setDetailedInventory(inventory);
    state.setSalesHtByMonth(salesHtByMonth);
    state.setCostMatterByMonth(costMatterByMonth);
    state.setValidatedMonths(validatedMonths);
    state.setSupplierConfigs(supplierConfigs);
    state.setDeliveryDateBySupplier(deliveryDateBySupplier);
    state.setNextDeliveryDateBySupplier(nextDeliveryDateBySupplier);
    state.setProducts(products);

    saveState('covers', covers, undefined, activeSiteId);
    saveState('dailyCovers', dailyCovers, undefined, activeSiteId);
    saveState('orderStates', orderStates, undefined, activeSiteId);
    saveState('inventory', inventory, undefined, activeSiteId);
    saveState('salesHtByMonth', salesHtByMonth, undefined, activeSiteId);
    saveState('costMatterByMonth', costMatterByMonth, undefined, activeSiteId);
    saveState('validatedMonths', validatedMonths, undefined, activeSiteId);
    saveState('supplierConfigs', supplierConfigs, undefined, activeSiteId);
    saveState('deliveryDateBySupplier', deliveryDateBySupplier, undefined, activeSiteId);
    saveState('nextDeliveryDateBySupplier', nextDeliveryDateBySupplier, undefined, activeSiteId);
    saveState('products', products, undefined, activeSiteId);
  }, [activeSiteId, state]);

  const reloadBackups = React.useCallback(async () => {
    if (!activeSiteId) {
      setBackups([]);
      return;
    }
    setRefreshing(true);
    const data = await listSiteBackups(activeSiteId);
    setBackups(data ?? []);
    setRefreshing(false);
  }, [activeSiteId]);

  React.useEffect(() => {
    void reloadBackups();
  }, [reloadBackups]);

  const handleCreateBackup = async () => {
    if (!activeSiteId || !activeSite) {
      showToast('Aucun site actif détecté.', 'error');
      return;
    }

    setLoading(true);
    const snapshot = buildSnapshot(state);
    const success = await createSiteBackup(activeSiteId, snapshot, 'manual', note.trim() || undefined);
    setLoading(false);

    if (!success) {
      showToast('Sauvegarde impossible. Vérifie Supabase.', 'error');
      return;
    }

    setNote('');
    showToast(`Sauvegarde créée pour ${activeSite.name}.`, 'success');
    await reloadBackups();
  };

  const handleRestore = async (backup: SiteBackupRow) => {
    if (!activeSiteId || !activeSite) {
      showToast('Aucun site actif détecté.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Restaurer la sauvegarde du ${formatDateTime(backup.created_at)} pour ${activeSite.name} ?\n\n` +
      `Les données actuelles du site actif seront remplacées.`
    );
    if (!confirmed) return;

    setLoading(true);
    const success = await restoreSiteBackup(activeSiteId, backup.snapshot);
    if (success) {
      applySnapshotLocally(backup.snapshot);
      showToast(`Sauvegarde restaurée pour ${activeSite.name}.`, 'success');
      await reloadBackups();
    } else {
      showToast('Restauration impossible. Vérifie Supabase.', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#1a0f0a] p-4 sm:p-8 lg:p-12 relative overflow-hidden text-white">
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between mb-10">
          <div>
            <div className="text-white/50 font-black uppercase tracking-[0.35em] text-xs">Admin dashboard</div>
            <h1 className="text-[#ffd700] text-5xl sm:text-6xl font-black uppercase tracking-tighter leading-none mt-2">
              Sauvegardes
            </h1>
            <p className="mt-3 text-white/75 font-semibold max-w-3xl">
              Crée une sauvegarde manuelle du site actif et restaure une version précédente si besoin.
              Les sauvegardes sont isolées par site.
            </p>
          </div>
          <button
            onClick={() => setView('admin_dashboard')}
            className="px-8 py-4 bg-white/5 text-white border border-white/10 rounded-2xl hover:bg-white/10 font-black uppercase text-xs tracking-widest transition-all"
          >
            Retour dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-8">
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
            <div className="text-white/50 font-black uppercase tracking-[0.25em] text-[11px]">Site actif</div>
            <div className="mt-2 text-3xl font-black uppercase text-[#ffd700] leading-tight">
              {activeSite?.name ?? 'Aucun site'}
            </div>
            <div className="mt-6 text-white/50 font-black uppercase tracking-[0.25em] text-[11px]">Nouvelle sauvegarde</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note optionnelle : avant gros import, avant modif fournisseurs, etc."
              rows={4}
              className="mt-3 w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm font-semibold text-white placeholder:text-white/30 outline-none focus:border-[#ffd700] resize-none"
            />
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
                <div className="text-white/40 uppercase tracking-[0.2em] text-[10px] font-black">Type</div>
                <div className="mt-1 font-black uppercase">Manuelle</div>
              </div>
              <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
                <div className="text-white/40 uppercase tracking-[0.2em] text-[10px] font-black">Contenu</div>
                <div className="mt-1 font-black uppercase">{countSnapshotKeys(buildSnapshot(state))} blocs</div>
              </div>
            </div>
            <button
              onClick={handleCreateBackup}
              disabled={loading || !activeSiteId}
              className="mt-6 w-full rounded-2xl bg-[#ffd700] text-[#1a0f0a] font-black uppercase tracking-[0.2em] text-sm py-4 disabled:opacity-50 hover:brightness-95 transition"
            >
              {loading ? 'Traitement…' : 'Créer une sauvegarde'}
            </button>
            <p className="mt-4 text-white/45 text-xs font-semibold leading-relaxed">
              Cette page gère la sauvegarde manuelle du site actif. La sauvegarde automatique quotidienne sera ajoutée dans l’étape suivante.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <div className="text-white/50 font-black uppercase tracking-[0.25em] text-[11px]">Historique</div>
                <div className="mt-1 text-2xl font-black uppercase">Sauvegardes récentes</div>
              </div>
              <button
                onClick={() => void reloadBackups()}
                disabled={refreshing}
                className="px-4 py-3 rounded-2xl bg-white/10 border border-white/10 text-white font-black uppercase tracking-[0.2em] text-[11px] hover:bg-white/15 disabled:opacity-50"
              >
                {refreshing ? 'Actualisation…' : 'Actualiser'}
              </button>
            </div>

            {backups.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/15 bg-black/10 p-8 text-center text-white/55 font-semibold">
                Aucune sauvegarde enregistrée pour ce site pour le moment.
              </div>
            ) : (
              <div className="space-y-4">
                {backups.map((backup) => (
                  <div key={backup.id} className="rounded-[28px] bg-black/20 border border-white/10 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-[#ffd700] font-black uppercase tracking-[0.2em] text-[11px]">
                          {backup.backup_type === 'auto' ? 'Automatique' : 'Manuelle'}
                        </div>
                        <div className="mt-2 text-xl font-black">{formatDateTime(backup.created_at)}</div>
                        <div className="mt-2 text-white/65 text-sm font-semibold">
                          {backup.note?.trim() ? backup.note : 'Aucune note'}
                        </div>
                        <div className="mt-3 text-white/40 uppercase tracking-[0.2em] text-[10px] font-black">
                          {countSnapshotKeys(backup.snapshot)} blocs sauvegardés
                        </div>
                      </div>
                      <button
                        onClick={() => void handleRestore(backup)}
                        disabled={loading}
                        className="px-5 py-3 rounded-2xl bg-white text-[#1a0f0a] font-black uppercase tracking-[0.2em] text-[11px] hover:opacity-95 disabled:opacity-50"
                      >
                        Restaurer ce site
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteBackupsPage;
