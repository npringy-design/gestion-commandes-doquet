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
  <div className="min-h-screen bg-[linear-gradient(180deg,#FFF7EA_0%,#F3DDC0_55%,#C97933_100%)] flex items-center justify-center px-4">
    <div className="bg-[#FFF7EA]/95 rounded-[22px] shadow-[0_14px_34px_rgba(54,24,12,0.18)] border border-[#D8AE77] px-6 py-4 text-center">
      <div className="text-lg font-black text-[#2F1D14]">Chargement de l'analyse coût matière…</div>
      <div className="text-sm font-semibold text-[#8B5A35] mt-1">Préparation du tableau de bord et des données mensuelles.</div>
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
      <div className="min-h-screen bg-[linear-gradient(180deg,#FFF7EA_0%,#F3DDC0_55%,#C97933_100%)]">
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
