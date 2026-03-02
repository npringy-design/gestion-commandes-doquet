import React from 'react';

import HomePage from '../pages/HomePage';
import AdminDashboard from '../pages/AdminDashboard';
import CostAnalysisPage from '../pages/CostAnalysisPage';
import StatsPage from '../pages/StatsPage';
import DailyForecastPage from '../pages/DailyForecastPage';
import SupplierSettingsPage from '../pages/SupplierSettingsPage';
import SuppliersPage from '../../pages/SuppliersPage';
import SupplierOrderPage from '../pages/SupplierOrderPage';
import RatiosPage from '../pages/RatiosPage';

interface AppRouterProps {
  state: any;
  ratiosScrollRef: any;
  ratiosBottomScrollRef: any;
  ratiosScrollWidth: number;
  syncRatiosScroll: (source: 'main' | 'bottom') => void;
}

const AppRouter: React.FC<AppRouterProps> = ({ state, ratiosScrollRef, ratiosBottomScrollRef, ratiosScrollWidth, syncRatiosScroll }) => {
  const { view, setView } = state;

  if (view === 'home') return <HomePage setView={setView} />;
  if (view === 'admin_dashboard') return <AdminDashboard setView={setView} />;
  if (view === 'cost_analysis') return (
    <CostAnalysisPage
      setView={setView}
      detailedInventory={state.detailedInventory}
      covers={state.covers}
      costMatterByMonth={state.costMatterByMonth}
      salesHtByMonth={state.salesHtByMonth}
    />
  );
  if (view === 'stats') return (
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
  );
  if (view === 'daily_forecast') return <DailyForecastPage setView={setView} dailyCovers={state.dailyCovers} setDailyCovers={state.setDailyCovers} />;
  if (view === 'supplier_settings') return <SupplierSettingsPage setView={setView} configs={state.supplierConfigs} setConfigs={state.setSupplierConfigs} />;
  if (view === 'suppliers') return <SuppliersPage setView={setView} />;
  if (['doquet', 'vins', 'viandes', 'domafrais', 'domafrais_bof', 'domafrais_surgele'].includes(view)) return <SupplierOrderPage state={state} />;
  if (view === 'ratios') return (
    <RatiosPage
      state={state}
      ratiosScrollRef={ratiosScrollRef}
      ratiosBottomScrollRef={ratiosBottomScrollRef}
      ratiosScrollWidth={ratiosScrollWidth}
      syncRatiosScroll={syncRatiosScroll}
    />
  );
  return <HomePage setView={setView} />;
};

export default AppRouter;
