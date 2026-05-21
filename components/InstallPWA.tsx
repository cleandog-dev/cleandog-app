'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [installed, setInstalled] = useState(false);
  // dismissed lives only in component state → resets on next page load.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed as PWA?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    // iOS detection (no beforeinstallprompt on iOS)
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

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

  // Shared card chrome — Smart App Banner style, CleanDOG palette
  const Banner = ({
    title,
    tagline,
    cta,
    onCta,
    ctaDisabled,
  }: {
    title: string;
    tagline: string;
    cta: string;
    onCta: () => void | Promise<void>;
    ctaDisabled?: boolean;
  }) => (
    <div className="sticky top-2 z-40 mx-2">
      <div
        className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-lg"
        style={{ border: '1px solid var(--cream-300)' }}
      >
        <button
          aria-label="Chiudi"
          className="flex h-7 w-7 items-center justify-center rounded-full text-base leading-none flex-shrink-0"
          style={{ background: 'var(--cream-100)', color: 'var(--ink-500)' }}
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ background: 'var(--sage-100)' }}
        >
          <Image src="/icon" alt="CleanDOG" width={48} height={48} className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight" style={{ color: 'var(--ink-900)' }}>
            {title}
          </p>
          <p className="truncate text-[12px] leading-tight mt-0.5" style={{ color: 'var(--ink-500)' }}>
            {tagline}
          </p>
          <p className="truncate text-[11px] leading-tight mt-0.5" style={{ color: 'var(--ink-300)' }}>
            🐾 Toelettatura · Messina · Gratis
          </p>
        </div>
        <button
          type="button"
          disabled={ctaDisabled}
          onClick={onCta}
          className="flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: 'var(--sage-800)' }}
        >
          {cta}
        </button>
      </div>
    </div>
  );

  // Android / desktop with native prompt available
  if (deferredPrompt) {
    return (
      <Banner
        title="CleanDOG"
        tagline="Più veloce. Notifiche istantanee."
        cta="Installa"
        onCta={async () => {
          await deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          if (choice.outcome === 'dismissed') setDismissed(true);
          setDeferredPrompt(null);
        }}
      />
    );
  }

  // iOS — no native prompt, show manual instructions
  if (isIOS) {
    return (
      <>
        <Banner
          title="CleanDOG"
          tagline="Aggiungi alla schermata Home"
          cta="Apri"
          onCta={() => setShowIOSHint(true)}
        />

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
                  <span>Tocca l&apos;icona <strong>Condividi</strong> (⎙) in basso (Safari) o in alto (Chrome iOS)</span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--sage-800)' }}
                  >
                    2
                  </span>
                  <span>Scorri e tocca <strong>&quot;Aggiungi a Home&quot;</strong></span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--sage-800)' }}
                  >
                    3
                  </span>
                  <span>Tocca <strong>&quot;Aggiungi&quot;</strong> in alto a destra</span>
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
