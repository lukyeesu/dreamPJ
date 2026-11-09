import { useState, useRef, useEffect } from 'react';

/**
 * Custom hook to track whether a sticky filter toolbar has stuck to the top.
 * Provides `isFilterStuck` boolean and `filterSentinelRef` for the sentinel element.
 */
export function useStickyFilter() {
  const [isFilterStuck, setIsFilterStuck] = useState(false);
  const filterSentinelRef = useRef(null);

  useEffect(() => {
    let rafId = null;
    const checkSticky = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!filterSentinelRef.current) return;
        if (filterSentinelRef.current.getClientRects().length === 0) return;

        const rect = filterSentinelRef.current.getBoundingClientRect();
        const isMobile = window.innerWidth < 768;
        const header = document.querySelector('header');
        const mainEl = document.querySelector('main');

        const targetTop = isMobile
          ? (header ? header.getBoundingClientRect().bottom : 56)
          : (mainEl ? mainEl.getBoundingClientRect().top : 0);

        const marginOffset = isMobile ? 8 : 12;
        const stuck = rect.top <= targetTop - marginOffset + 1;
        setIsFilterStuck(stuck);
      });
    };

    window.addEventListener('scroll', checkSticky, { passive: true, capture: true });
    window.addEventListener('resize', checkSticky, { passive: true });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.addEventListener('scroll', checkSticky, { passive: true });
    }

    checkSticky();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', checkSticky, { capture: true });
      window.removeEventListener('resize', checkSticky);
      if (mainEl) {
        mainEl.removeEventListener('scroll', checkSticky);
      }
    };
  }, []);

  return { isFilterStuck, filterSentinelRef };
}

export default useStickyFilter;
