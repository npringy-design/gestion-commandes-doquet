import React from 'react';
import { useAppState } from './hooks/useAppState';
import { useSyncedHorizontalScroll } from './hooks/useSyncedHorizontalScroll';
import AppRouter from './components/AppRouter';

const App: React.FC = () => {
  const state = useAppState();
  const { view, ratioTab } = state;

  const { mainScrollRef, bottomScrollRef, scrollWidth, syncScroll } =
    useSyncedHorizontalScroll(view === 'ratios', [view, ratioTab]);

  return (
    <AppRouter
      state={state}
      ratiosScrollRef={mainScrollRef}
      ratiosBottomScrollRef={bottomScrollRef}
      ratiosScrollWidth={scrollWidth}
      syncRatiosScroll={syncScroll}
    />
  );
};

export default App;
