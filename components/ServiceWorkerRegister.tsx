'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Force-check for SW update on mount + when tab regains focus.
        // Catches users stuck on old SW versions that may cache stale RSC payloads.
        reg.update().catch(() => {});
        const onFocus = () => { reg.update().catch(() => {}); };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
      })
      .catch(() => {
        // silently ignore — install prompt simply won't appear
      });

    // Reload once when a new SW takes control, so the page picks up fresh assets.
    let refreshed = false;
    const onCtrlChange = () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onCtrlChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onCtrlChange);
  }, []);
  return null;
}
