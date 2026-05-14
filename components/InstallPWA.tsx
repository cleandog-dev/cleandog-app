'use client';

import { useEffect, useState } from 'react';

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'cleandog-install-dismissed';

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari uses navigator.standalone
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    // User-dismissed previously?
    if (localStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true);
    }

    // iOS detection (no beforeinstallprompt on iOS)
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    setIsIOS(ios);

    // Android / Chrome / Edge — native prompt
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BIPEvent);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;

  // Android / desktop with native prompt available
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-md rounded-xl border bg-white p-3 shadow-lg flex items-center gap-3">
        <div className="text-2xl">⤓</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Installa CleanDOG</p>
          <p className="text-xs text-muted-foreground">Accedi più veloce, senza passare dal browser</p>
        </div>
        <button
          className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
          style={{ background: 'var(--sage-800)' }}
          onClick={async () => {
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice.outcome === 'dismissed') {
              localStorage.setItem(DISMISS_KEY, '1');
              setDismissed(true);
            }
            setDeferredPrompt(null);
          }}
        >
          Installa
        </button>
        <button
          aria-label="Chiudi"
          className="text-muted-foreground text-lg leading-none px-1"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
          }}
        >
          ×
        </button>
      </div>
    );
  }

  // iOS — no native prompt, show manual instructions
  if (isIOS) {
    return (
      <>
        <div className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-md rounded-xl border bg-white p-3 shadow-lg flex items-center gap-3">
          <div className="text-2xl">📱</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Installa su iPhone</p>
            <p className="text-xs text-muted-foreground">Tocca Condividi → Aggiungi a Home</p>
          </div>
          <button
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
            style={{ background: 'var(--sage-800)' }}
            onClick={() => setShowIOSHint(true)}
          >
            Come fare
          </button>
          <button
            aria-label="Chiudi"
            className="text-muted-foreground text-lg leading-none px-1"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, '1');
              setDismissed(true);
            }}
          >
            ×
          </button>
        </div>

        {showIOSHint && (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4"
            onClick={() => setShowIOSHint(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold">Aggiungi alla schermata Home</h3>
              <ol className="mt-3 space-y-3 text-sm">
                <li className="flex gap-3">
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--sage-800)' }}
                  >
                    1
                  </span>
                  <span>Tocca l'icona <strong>Condividi</strong> (⎙) in basso (Safari) o in alto (Chrome iOS)</span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--sage-800)' }}
                  >
                    2
                  </span>
                  <span>Scorri e tocca <strong>"Aggiungi a Home"</strong></span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--sage-800)' }}
                  >
                    3
                  </span>
                  <span>Tocca <strong>"Aggiungi"</strong> in alto a destra</span>
                </li>
              </ol>
              <button
                className="mt-5 w-full rounded-md py-2.5 text-sm font-medium text-white"
                style={{ background: 'var(--sage-800)' }}
                onClick={() => setShowIOSHint(false)}
              >
                Capito
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
