import React from 'react';
import { isSupabaseConfigured } from '../utils/supabase';
import { isSupabaseConfigured as isAuthConfigured } from '../lib/supabaseClient';
import { useAuth } from '../auth/AuthProvider';

import HomePage from '../pages/HomePage';
import AdminDashboard from '../pages/AdminDashboard';
import CostAnalysisPage from '../pages/CostAnalysisPage';
import StatsPage from '../pages/StatsPage';
import DailyForecastPage from '../pages/DailyForecastPage';
import SupplierSettingsPage from '../pages/SupplierSettingsPage';
import SuppliersPage from '../pages/SuppliersPage';
import SupplierOrderPage from '../pages/SupplierOrderPage';
import RatiosPage from '../pages/RatiosPage';

interface AppRouterProps {
  state: any; // Passe 1 : on garde le comportement, typage fin en passe 2
  ratiosScrollRef: any;
  ratiosBottomScrollRef: any;
  ratiosScrollWidth: number;
  syncRatiosScroll: (source: "main" | "bottom") => void;
}

const AppRouter: React.FC<AppRouterProps> = ({
  state,
  ratiosScrollRef,
  ratiosBottomScrollRef,
  ratiosScrollWidth,
  syncRatiosScroll,
}) => {
  const { view, setView } = state;
  const { user, signOut } = useAuth();

  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 1023px)').matches);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Badge Cloud Sync supprimé (inutile pour l'utilisateur final)
  const SyncBadge = null;

  // ── Bouton logout (visible si Auth activée + user connecté) ─
  // Pas de logout sur l’accueil (évite les clics accidentels sur le terrain)
  const LogoutButton = (isAuthConfigured() && user && view === 'home') ? (
    <button
      onClick={async () => {
        await signOut();
        try { setView('home'); } catch (_e) {}
      }}
      className="fixed top-4 right-4 z-[9999] bg-white/90 backdrop-blur border border-slate-200 rounded-full px-3 py-2 shadow-md text-[10px] font-black uppercase tracking-widest text-slate-700 hover:opacity-95"
      title="Se déconnecter"
    >
      Déconnexion
    </button>
  ) : null;

const MobileBlocked: React.FC<{ title: string }> = ({ title }) => (
  <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center justify-center p-6 text-center">
    <div className="max-w-md bg-white rounded-3xl p-6 shadow-2xl border-4 border-red-600">
      <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800 mb-2">{title}</h2>
      <p className="text-slate-600 text-sm font-semibold">
        Cette section est volontairement désactivée sur téléphone pour éviter les réglages accidentels.
        Utilise un PC pour modifier les paramètres.
      </p>
      <button
        onClick={() => setView('home')}
        className="mt-5 w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-3 rounded-2xl hover:opacity-95"
      >
        Retour à l’accueil
      </button>
    </div>
  </div>
);

  if (view === 'home') return <><HomePage setView={setView} />{SyncBadge}{LogoutButton}</>;

  if (view === 'admin_dashboard') return <><AdminDashboard setView={setView} />{SyncBadge}{LogoutButton}</>;

  if (view === 'cost_analysis') {
    return (
      <>
      <CostAnalysisPage
        setView={setView}
        detailedInventory={state.detailedInventory}
        covers={state.covers}
        costMatterByMonth={state.costMatterByMonth}
        salesHtByMonth={state.salesHtByMonth}
      />
      {SyncBadge}{LogoutButton}
      </>
    );
  }

  if (view === 'stats' && isMobile) return <><MobileBlocked title="Paramètres" />{SyncBadge}{LogoutButton}</>;

  if (view === 'stats') {
    return (
      <>
      <StatsPage
        setView={setView}
        covers={state.covers}
        setCovers={state.setCovers}
        salesHtByMonth={state.salesHtByMonth}
        setSalesHtByMonth={state.setSalesHtByMonth}
        costMatterByMonth={state.costMatterByMonth}
        setCostMatterByMonth={state.setCostMatterByMonth}
        detailedInventory={state.detailedInventory}
        setDetailedInventory={state.setDetailedInventory}
        validatedMonths={state.validatedMonths}
      />
      {SyncBadge}{LogoutButton}
      </>
    );
  }

  if (view === 'daily_forecast') {
    return (
      <>
      <DailyForecastPage
        setView={setView}
        dailyCovers={state.dailyCovers}
        setDailyCovers={state.setDailyCovers}
      />
      {SyncBadge}{LogoutButton}
      </>
    );
  }

  if (view === 'supplier_settings' && isMobile) return <><MobileBlocked title="Paramètres fournisseurs" />{SyncBadge}{LogoutButton}</>;

  if (view === 'supplier_settings') {
    return (
      <>
      <SupplierSettingsPage
        setView={setView}
        configs={state.supplierConfigs}
        setConfigs={state.setSupplierConfigs}
      />
      {SyncBadge}{LogoutButton}
      </>
    );
  }

  if (view === 'suppliers') return <><SuppliersPage setView={setView} />{SyncBadge}{LogoutButton}</>;

  if (['doquet', 'vins', 'viandes', 'domafrais', 'domafrais_bof', 'domafrais_surgele', 'pomona_episaveurs'].includes(view)) {
    return <><SupplierOrderPage state={state} />{SyncBadge}{LogoutButton}</>;
  }

  if (view === 'ratios') {
    return (
      <>
      <RatiosPage
        state={state}
        ratiosScrollRef={ratiosScrollRef}
        ratiosBottomScrollRef={ratiosBottomScrollRef}
        ratiosScrollWidth={ratiosScrollWidth}
        syncRatiosScroll={syncRatiosScroll}
      />
      {SyncBadge}{LogoutButton}
      </>
    );
  }

  return <><HomePage setView={setView} />{SyncBadge}{LogoutButton}</>;
};

export default AppRouter;
