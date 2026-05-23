'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({ intervalMs = 180_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const lastRefreshRef = useRef(Date.now());

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      lastRefreshRef.current = Date.now();
      router.refresh();
    };
    const id = setInterval(tick, intervalMs);

    // Immediate refresh when tab regains focus if stale (>intervalMs).
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefreshRef.current > intervalMs) {
        lastRefreshRef.current = Date.now();
        router.refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router, intervalMs]);
  return null;
}
