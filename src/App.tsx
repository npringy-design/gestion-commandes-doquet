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
      <AppRouter
        state={state}
        ratiosScrollRef={mainScrollRef}
        ratiosBottomScrollRef={bottomScrollRef}
        ratiosScrollWidth={scrollWidth}
        syncRatiosScroll={syncScroll}
      />
    </>
  );
};

export default App;
