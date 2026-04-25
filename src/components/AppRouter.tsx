import React, { Suspense, lazy } from 'react';
import { isSupabaseConfigured as isAuthConfigured } from '../lib/supabaseClient';
import { useAuth } from '../auth/AuthProvider';
import { canAccessAdminDashboard, canAccessDailyForecast, canAccessRatiosPage, canAccessStatsPage, canAccessSupplierSettings, canAccessUserManagement } from '../lib/permissions';
import type { View } from '../constants';
import type { AppState } from '../hooks/useAppState';

import HomePage from '../pages/HomePage';
import SuppliersPage from '../pages/SuppliersPage';

const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));
const CostAnalysisPage = lazy(() => import('../pages/CostAnalysisPage'));
const StatsPage = lazy(() => import('../pages/StatsPage'));
const DailyForecastPage = lazy(() => import('../pages/DailyForecastPage'));
const SupplierSettingsPage = lazy(() => import('../pages/SupplierSettingsPage'));
const SupplierOrderPage = lazy(() => import('../pages/SupplierOrderPage'));
const RatiosPage = lazy(() => import('../pages/RatiosPage'));
const UserManagementPage = lazy(() => import('../pages/UserManagementPage'));
const PrepSheetPage = lazy(() => import('../pages/PrepSheetPage'));
const PrepRatiosPage = lazy(() => import('../pages/PrepRatiosPage'));
const TakeRatePage = lazy(() => import('../pages/TakeRatePage'));
const TakeRateResultsPage = lazy(() => import('../pages/TakeRateResultsPage'));
const ProductMixPage = lazy(() => import('../pages/ProductMixPage'));

type ScrollSyncSource = 'main' | 'bottom';

interface AppRouterProps {
  state: AppState;
  ratiosScrollRef: React.RefObject<HTMLDivElement | null>;
  ratiosBottomScrollRef: React.RefObject<HTMLDivElement | null>;
  ratiosScrollWidth: number;
  syncRatiosScroll: (source: ScrollSyncSource) => void;
}

const PageLoader: React.FC<{ label?: string }> = ({ label = 'Chargement…' }) => (
  <div className="min-h-screen bg-[#1a0f0a] flex items-center justify-center p-6">
    <div className="bg-white rounded-3xl px-6 py-5 shadow-2xl border border-slate-200 text-center">
      <div className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">Application</div>
      <div className="mt-2 text-base font-extrabold text-slate-800">{label}</div>
    </div>
  </div>
);

const AppRouter: React.FC<AppRouterProps> = ({
  state,
  ratiosScrollRef,
  ratiosBottomScrollRef,
  ratiosScrollWidth,
  syncRatiosScroll,
}) => {
  const { view, setView } = state;
  const { user, signOut, isAdmin, profile } = useAuth();

  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 1023px)').matches);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const SupplierViews: View[] = (Object.values(state.supplierConfigs) as import('../types').SupplierConfig[])
    .filter((config) => !config.isArchived)
    .map((config) => config.id as View);

  const renderWithShell = (node: React.ReactNode) => (
    <>
      {node}
      {LogoutButton}
    </>
  );

  const renderLazyPage = (node: React.ReactNode, label?: string) =>
    renderWithShell(<Suspense fallback={<PageLoader label={label} />}>{node}</Suspense>);

  const LogoutButton = isAuthConfigured() && user && view === 'home' ? (
    <button
      onClick={async () => {
        await signOut();
        try {
          setView('home');
        } catch (_e) {}
      }}
      className="fixed right-5 top-5 z-[9999] inline-flex items-center gap-2 rounded-lg border border-[#D99A4A] bg-[#FFF2CF] px-4 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#512A16] shadow-[0_10px_22px_rgba(26,13,8,0.18)] transition hover:bg-white"
      title="Se déconnecter"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M15.75 9V5.75A2.75 2.75 0 0013 3H6.75A2.75 2.75 0 004 5.75v12.5A2.75 2.75 0 006.75 21H13a2.75 2.75 0 002.75-2.75V15" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 12h8m0 0l-3-3m3 3l-3 3" />
      </svg>
      Déconnexion
    </button>
  ) : null;


  const AccessDenied: React.FC<{ title?: string; message?: string }> = ({
    title = 'Accès refusé',
    message = 'Cette section est réservée aux administrateurs actifs.',
  }) => (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md bg-white rounded-3xl p-6 shadow-2xl border-4 border-red-600">
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-600 text-sm font-semibold">{message}</p>
        <button
          onClick={() => setView('home')}
          className="mt-5 w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-3 rounded-2xl hover:opacity-95"
        >
          Retour à l’accueil
        </button>
      </div>
    </div>
  );
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

  if (view === 'home') return renderWithShell(<HomePage setView={setView} />);

  if (view === 'admin_dashboard') {
    if (!canAccessAdminDashboard(profile)) {
      return renderWithShell(<AccessDenied message="Cette section est réservée aux rôles autorisés pour ce module." />);
    }
    return renderLazyPage(<AdminDashboard setView={setView} profile={profile} />, 'Chargement du tableau de bord…');
  }

  if (view === 'cost_analysis') {
    return renderLazyPage(
      <CostAnalysisPage
        setView={setView}
        detailedInventory={state.detailedInventory}
        covers={state.covers}
        costMatterByMonth={state.costMatterByMonth}
        salesHtByMonth={state.salesHtByMonth}
      />,
      'Chargement de l’analyse CM…'
    );
  }

  if (view === 'stats' && isMobile) return renderWithShell(<MobileBlocked title="Paramètres" />);

  if (view === 'stats') {
    if (!canAccessStatsPage(profile)) {
      return renderWithShell(<AccessDenied message="Cette section est réservée aux rôles autorisés pour ce module." />);
    }
    return renderLazyPage(
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
        prepImportsByMonth={state.prepImportsByMonth}
        setPrepImportsByMonth={state.setPrepImportsByMonth}
        validatedMonths={state.validatedMonths}
      />,
      'Chargement des paramètres…'
    );
  }

  if (view === 'daily_forecast') {
    if (!canAccessDailyForecast(profile)) {
      return renderWithShell(<AccessDenied message="Cette section est réservée aux rôles autorisés pour ce module." />);
    }
    return renderLazyPage(
      <DailyForecastPage
        setView={setView}
        dailyCovers={state.dailyCovers}
        setDailyCovers={state.setDailyCovers}
      />,
      'Chargement du journalier…'
    );
  }

  if (view === 'prep_sheet') {
    return renderLazyPage(
      <PrepSheetPage
        setView={setView}
        prepItems={state.prepItems}
        dailyCovers={state.dailyCovers}
        covers={state.covers}
        prepImportsByMonth={state.prepImportsByMonth}
      />,
      'Chargement de la feuille de mise en place…'
    );
  }

  if (view === 'prep_ratios' && isMobile) return renderWithShell(<MobileBlocked title="Calcul prod ratio" />);

  if (view === 'prep_ratios') {
    if (!canAccessRatiosPage(profile)) {
      return renderWithShell(<AccessDenied message="Cette section est réservée aux rôles autorisés pour ce module." />);
    }
    return renderLazyPage(
      <PrepRatiosPage
        setView={setView}
        covers={state.covers}
        prepValidatedMonths={state.prepValidatedMonths}
        togglePrepValidateMonth={state.togglePrepValidateMonth}
        prepItems={state.prepItems}
        setPrepItems={state.setPrepItems}
        prepImportsByMonth={state.prepImportsByMonth}
      />,
      'Chargement du calcul prod ratio…'
    );
  }

  if (view === 'take_rate') {
    if (!canAccessRatiosPage(profile)) {
      return renderWithShell(<AccessDenied message="Cette section est réservée aux rôles autorisés pour ce module." />);
    }
    return renderLazyPage(
      <TakeRatePage
        setView={setView}
        prepImportsByMonth={state.prepImportsByMonth}
      />,
      'Chargement du paramétrage taux de prise…'
    );
  }

  if (view === 'take_rate_sheet') {
    if (!canAccessRatiosPage(profile)) {
      return renderWithShell(<AccessDenied message="Cette section est réservée aux rôles autorisés pour ce module." />);
    }
    return renderLazyPage(
      <TakeRateResultsPage
        setView={setView}
        prepImportsByMonth={state.prepImportsByMonth}
        covers={state.covers}
      />,
      'Chargement de la feuille taux de prise…'
    );
  }

  if (view === 'supplier_settings' && isMobile) {
    return renderWithShell(<MobileBlocked title="Paramètres fournisseurs" />);
  }

  if (view === 'supplier_settings') {
    if (!canAccessSupplierSettings(profile)) {
      return renderWithShell(<AccessDenied message="Cette section est réservée aux rôles autorisés pour ce module." />);
    }
    return renderLazyPage(
      <SupplierSettingsPage
        setView={setView}
        configs={state.supplierConfigs}
        setConfigs={state.setSupplierConfigs}
      />,
      'Chargement des fournisseurs…'
    );
  }

  if (view === 'user_management') {
    if (!canAccessUserManagement(profile)) {
      return renderWithShell(<AccessDenied message="Cette section est réservée aux rôles autorisés de gestion utilisateurs." />);
    }

    return renderLazyPage(
      <UserManagementPage setView={setView} />,
      'Chargement des utilisateurs…'
    );
  }

  if (view === 'suppliers') return renderWithShell(<SuppliersPage setView={setView} supplierConfigs={state.supplierConfigs} />);

  if (SupplierViews.includes(view)) {
    return renderLazyPage(<SupplierOrderPage state={state} />, 'Chargement de la commande…');
  }

  if (view === 'ratios') {
    if (!canAccessRatiosPage(profile)) {
      return renderWithShell(<AccessDenied message="Cette section est réservée aux rôles autorisés pour ce module." />);
    }
    return renderLazyPage(
      <RatiosPage
        state={state}
        ratiosScrollRef={ratiosScrollRef}
        ratiosBottomScrollRef={ratiosBottomScrollRef}
        ratiosScrollWidth={ratiosScrollWidth}
        syncRatiosScroll={syncRatiosScroll}
      />,
      'Chargement des ratios…'
    );
  }

  if (view === 'product_mix') {
    return renderLazyPage(
      <ProductMixPage
        setView={setView}
        salesHtByMonth={state.salesHtByMonth}
      />,
      'Chargement du mix produit…'
    );
  }

  return renderWithShell(<HomePage setView={setView} />);
};

export default AppRouter;
