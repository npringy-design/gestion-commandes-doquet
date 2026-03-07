import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Synchronise un scroll horizontal principal avec une barre de scroll secondaire.
 * Utilisé pour la page Ratios afin de garder la barre de défilement visible en bas.
 */
export const useSyncedHorizontalScroll = (enabled: boolean, deps: unknown[] = []) => {
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const [scrollWidth, setScrollWidth] = useState(0);

  const syncScroll = useCallback((source: 'main' | 'bottom') => {
    if (isSyncingRef.current) return;

    const mainEl = mainScrollRef.current;
    const bottomEl = bottomScrollRef.current;
    if (!mainEl || !bottomEl) return;

    isSyncingRef.current = true;
    if (source === 'main') {
      bottomEl.scrollLeft = mainEl.scrollLeft;
    } else {
      mainEl.scrollLeft = bottomEl.scrollLeft;
    }

    window.requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const mainEl = mainScrollRef.current;
    const bottomEl = bottomScrollRef.current;
    if (!mainEl || !bottomEl) return;

    const updateMetrics = () => {
      const nextWidth = Math.max(mainEl.scrollWidth || 0, 3400);
      setScrollWidth(nextWidth);

      if (bottomEl.scrollLeft !== mainEl.scrollLeft) {
        bottomEl.scrollLeft = mainEl.scrollLeft;
      }
    };

    updateMetrics();

    const tableEl = mainEl.querySelector('table');
    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(mainEl);
    if (tableEl) resizeObserver.observe(tableEl);

    window.addEventListener('resize', updateMetrics);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateMetrics);
    };
  }, [enabled, ...deps]);

  return {
    mainScrollRef,
    bottomScrollRef,
    scrollWidth,
    syncScroll,
  };
};
