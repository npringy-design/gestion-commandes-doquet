// =============================================================
// pages/CostAnalysisPage.tsx
// Page d'analyse coût matière — enveloppe le DashboardApp
// avec la conversion des clés de mois (jan → Janvier, etc.)
// Extraite de App.tsx
// =============================================================

import React, { Suspense, lazy, useMemo } from 'react';
import { View, MONTH_KEY_TO_NAME } from '../constants';
import { useAuth } from '../auth/AuthProvider';
import { isReadOnlyAnalyse } from '../lib/permissions';

const DashboardApp = lazy(() => import('../../dashboard_cm/DashboardApp'));

interface CostAnalysisPageProps {
  setView:           (v: View) => void;
  detailedInventory: Record<string, string>;
  covers:            Record<string, number>;
  costMatterByMonth: Record<string, number>;
  salesHtByMonth:    Record<string, number>;
}

const convertMonthKeys = <T,>(
  source: Record<string, T>,
  mapValue?: (value: T) => T | null,
): Record<string, T | null> => {
  const result: Record<string, T | null> = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    const monthName = MONTH_KEY_TO_NAME[key];
    if (!monthName) return;
    result[monthName] = mapValue ? mapValue(value) : value;
  });
  return result;
};

const CostAnalysisFallback = () => (
  <div className="min-h-screen bg-[#FFF8E7] flex items-center justify-center px-4">
    <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] px-6 py-4 text-center">
      <div className="text-lg font-semibold text-[#111827]">Chargement de l'analyse coût matière…</div>
      <div className="text-sm text-[#6B7280] mt-1">Préparation du tableau de bord et des données mensuelles.</div>
    </div>
  </div>
);

const CostAnalysisPage: React.FC<CostAnalysisPageProps> = ({
  setView,
  detailedInventory,
  covers,
  costMatterByMonth,
  salesHtByMonth,
}) => {
  const { profile } = useAuth();
  const readOnlyAnalyse = isReadOnlyAnalyse(profile);

  const csvByMonth = useMemo(
    () => convertMonthKeys(detailedInventory, value => (value ? value : null)) as Record<string, string>,
    [detailedInventory]
  );

  const coversByMonthFromParams = useMemo(
    () => convertMonthKeys(covers, value => (typeof value === 'number' ? value : null)) as Record<string, number | null>,
    [covers]
  );

  const costByMonthFromParams = useMemo(
    () => convertMonthKeys(costMatterByMonth, value => (
      typeof value === 'number' && !Number.isNaN(value) ? value : null
    )),
    [costMatterByMonth]
  );

  const salesByMonthFromParams = useMemo(
    () => convertMonthKeys(salesHtByMonth, value => (
      typeof value === 'number' && !Number.isNaN(value) ? value : null
    )),
    [salesHtByMonth]
  );

  return (
    <Suspense fallback={<CostAnalysisFallback />}>
      <div className="min-h-screen bg-[#FFF8E7]">
        <DashboardApp
          csvByMonth={csvByMonth}
          coversByMonthFromParams={coversByMonthFromParams}
          costByMonthFromParams={costByMonthFromParams}
          salesByMonthFromParams={salesByMonthFromParams}
          onBackHome={() => setView('home')}
          onOpenParams={() => setView('stats')}
          readOnlyAnalyse={readOnlyAnalyse}
        />
      </div>
    </Suspense>
  );
};

export default CostAnalysisPage;
