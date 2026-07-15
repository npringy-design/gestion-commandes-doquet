// =============================================================
// App.tsx  ← point d'entrée principal (ultra léger)
//
// Passe 1 (refacto structure) :
// - état global dans hooks/useAppState
// - scroll synchronisé des ratios dans hooks/useSyncedHorizontalScroll
// - navigation/pages dans components/AppRouter
// =============================================================

import React from 'react';
import { useAppState } from './hooks/useAppState';
import { useSyncedHorizontalScroll } from './hooks/useSyncedHorizontalScroll';
import AppRouter from './components/AppRouter';
import EnvironmentBanner from './components/EnvironmentBanner';
import SyncStatusIndicator from './components/SyncStatusIndicator';
import OrderFieldNavigationGuard from './components/OrderFieldNavigationGuard';
import OrderAnomalyGuard from './components/OrderAnomalyGuard';
import NetworkConnectionGuard from './components/NetworkConnectionGuard';

const App: React.FC = () => {
  const state = useAppState();
  const { view, ratioTab } = state;

  const {
    mainScrollRef,
    bottomScrollRef,
    scrollWidth,
    syncScroll,
  } = useSyncedHorizontalScroll(view === 'ratios', [view, ratioTab]);

  return (
    <>
      <EnvironmentBanner />
      <NetworkConnectionGuard onQuit={() => state.setView('home')} />
      <OrderFieldNavigationGuard />
      <OrderAnomalyGuard state={state} />
      <AppRouter
        state={state}
        ratiosScrollRef={mainScrollRef}
        ratiosBottomScrollRef={bottomScrollRef}
        ratiosScrollWidth={scrollWidth}
        syncRatiosScroll={syncScroll}
      />
      <SyncStatusIndicator status={state.syncStatus} />
    </>
  );
};

export default App;
