// =============================================================
// pages/CostAnalysisPage.tsx
// Page d'analyse coût matière — enveloppe le DashboardApp
// avec la conversion des clés de mois (jan → Janvier, etc.)
// Extraite de App.tsx
// =============================================================

import React, { useMemo } from 'react';
import DashboardApp from '../dashboard_cm/DashboardApp';
import { View, MONTH_KEY_TO_NAME } from '../constants';

interface CostAnalysisPageProps {
  setView:           (v: View) => void;
  detailedInventory: Record<string, string>;
  covers:            Record<string, number>;
  costMatterByMonth: Record<string, number>;
  salesHtByMonth:    Record<string, number>;
}

// Convertit un Record<'jan'|'feb'|..., T> en Record<'Janvier'|'Février'|..., T|null>
const convertKeys = <T,>(
  source: Record<string, T>
): Record<string, T | null> => {
  const result: Record<string, T | null> = {};
  Object.entries(source || {}).forEach(([k, v]) => {
    const name = MONTH_KEY_TO_NAME[k];
    if (name) result[name] = typeof v === 'number' && !Number.isNaN(v) ? v : null;
  });
  return result;
};

const CostAnalysisPage: React.FC<CostAnalysisPageProps> = ({
  setView, detailedInventory, covers, costMatterByMonth, salesHtByMonth,
}) => {
  // Conversion des CSV : jan → Janvier
  const csvByMonth = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(detailedInventory || {}).forEach(([k, v]) => {
      const name = MONTH_KEY_TO_NAME[k];
      if (name && v) map[name] = v;
    });
    return map;
  }, [detailedInventory]);

  // Conversion des couverts : jan → Janvier
  const coversByMonthFromParams = useMemo(() => {
    const result: Record<string, number | null> = {};
    Object.entries(covers || {}).forEach(([k, v]) => {
      const name = MONTH_KEY_TO_NAME[k];
      if (name) result[name] = typeof v === 'number' ? v : null;
    });
    return result;
  }, [covers]);

  const costByMonthFromParams  = useMemo(() => convertKeys(costMatterByMonth), [costMatterByMonth]);
  const salesByMonthFromParams = useMemo(() => convertKeys(salesHtByMonth),    [salesHtByMonth]);

  return (
    <div className="min-h-screen bg-[#FFF8E7]">
      <DashboardApp
        csvByMonth={csvByMonth}
        coversByMonthFromParams={coversByMonthFromParams}
        costByMonthFromParams={costByMonthFromParams}
        salesByMonthFromParams={salesByMonthFromParams}
        onBackHome={() => setView('home')}
        onOpenParams={() => setView('stats')}
      />
    </div>
  );
};

export default CostAnalysisPage;
