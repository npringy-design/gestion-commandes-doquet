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
    const el = mainScrollRef.current;
    if (!el) return;

    const update = () => setScrollWidth(el.scrollWidth || 0);
    update();

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [enabled, ...deps]);

  return {
    mainScrollRef,
    bottomScrollRef,
    scrollWidth,
    syncScroll,
  };
};
