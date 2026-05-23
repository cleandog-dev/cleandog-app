'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'cleandog-install-dismissed-v3';

type Platform = 'ios' | 'android' | 'desktop';
// 'pending' = on Android/desktop we wait briefly to see if BIP fires before deciding label.
type Mode = 'native' | 'manual' | 'pending';

function detectPlatform(): Platform {
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [mode, setMode] = useState<Mode>('pending');
  const [showHint, setShowHint] = useState(false);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already installed as PWA?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Previously dismissed?
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const p = detectPlatform();
    setPlatform(p);
    setHidden(false);
    setReady(true);

    // iOS: no BIP API exists → always manual.
    if (p === 'ios') {
      setMode('manual');
      return;
    }

    // Read globally-captured BIP event (set by inline script in layout head — fires before React mounts)
    const win = window as unknown as { __cleandogBIP?: BIPEvent | null };
    if (win.__cleandogBIP) {
      setDeferredPrompt(win.__cleandogBIP);
      setMode('native');
    }

    const onBIPReady = () => {
      if (win.__cleandogBIP) {
        setDeferredPrompt(win.__cleandogBIP);
        setMode('native');
      }
    };
    window.addEventListener('cleandog-bip-ready', onBIPReady);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BIPEvent);
      setMode('native');
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    const onInstalled = () => {
      setHidden(true);
      setDeferredPrompt(null);
      win.__cleandogBIP = null;
    };
    window.addEventListener('appinstalled', onInstalled);

    // If BIP hasn't fired within 2s, assume browser won't support direct install
    // (Firefox Android, Brave with shields, etc.) → fall back to manual guide.
    const fallbackTimer = window.setTimeout(() => {
      setMode((m) => (m === 'pending' ? 'manual' : m));
    }, 2000);

    return () => {
      window.removeEventListener('cleandog-bip-ready', onBIPReady);
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  if (!ready || hidden || !platform) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  }

  async function handleInstall() {
    // Try native install first — even if mode is 'pending', a BIP may have just landed.
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setHidden(true);
        }
      } catch {
        // Some browsers throw if prompt called twice — fall back to guide.
        setShowHint(true);
      }
      setDeferredPrompt(null);
      return;
    }
    // No native install available → show platform-specific guide.
    setShowHint(true);
  }

  const tagline =
    platform === 'ios'
      ? 'Aggiungi alla schermata Home'
      : platform === 'android'
        ? 'Installa per notifiche istantanee'
        : 'Installa per accesso rapido';

  // Always "Installa" — click handler picks the right path:
  // native OS prompt when available, fallback guide when not.
  const ctaLabel = 'Installa';

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 mx-auto max-w-md px-3">
        <div
          className="mt-3 flex items-center gap-3 bg-white px-3 py-2.5 shadow-lg"
          style={{ border: '1px solid var(--cream-300)', borderRadius: 'var(--r-lg)' }}
        >
          <button
            aria-label="Chiudi"
            className="flex h-7 w-7 items-center justify-center rounded-full text-base leading-none flex-shrink-0"
            style={{ background: 'var(--cream-100)', color: 'var(--ink-500)' }}
            onClick={dismiss}
          >
            ×
          </button>
          <Image
            src="/icon"
            alt="CleanDOG"
            width={48}
            height={48}
            className="h-12 w-12 flex-shrink-0 rounded-[11px] object-contain"
          />
          <div className="flex-1 min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight" style={{ color: 'var(--ink-900)' }}>
              CleanDOG App
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
            onClick={handleInstall}
            className="flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: 'var(--sage-800)' }}
          >
            {ctaLabel}
          </button>
        </div>
      </div>

      {showHint && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowHint(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Aggiungi CleanDOG alla Home</h3>
            <InstallSteps platform={platform} />
            <button
              className="mt-5 w-full rounded-md py-2.5 text-sm font-medium text-white"
              style={{ background: 'var(--sage-800)' }}
              onClick={() => setShowHint(false)}
            >
              Capito
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: 'var(--sage-800)' }}
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function InstallSteps({ platform }: { platform: Platform }) {
  if (platform === 'ios') {
    return (
      <ol className="mt-3 space-y-3 text-sm">
        <Step n={1}>Tocca l&apos;icona <strong>Condividi</strong> (⎙) in basso (Safari) o in alto (Chrome iOS)</Step>
        <Step n={2}>Scorri e tocca <strong>&quot;Aggiungi a Home&quot;</strong></Step>
        <Step n={3}>Tocca <strong>&quot;Aggiungi&quot;</strong> in alto a destra</Step>
      </ol>
    );
  }
  if (platform === 'android') {
    return (
      <ol className="mt-3 space-y-3 text-sm">
        <Step n={1}>Apri il menu <strong>⋮</strong> di Chrome in alto a destra</Step>
        <Step n={2}>Tocca <strong>&quot;Installa app&quot;</strong> (o &quot;Aggiungi a schermata Home&quot;)</Step>
        <Step n={3}>Conferma <strong>&quot;Installa&quot;</strong></Step>
      </ol>
    );
  }
  return (
    <ol className="mt-3 space-y-3 text-sm">
      <Step n={1}>Clicca l&apos;icona <strong>⊕ Installa</strong> nella barra indirizzi di Chrome/Edge</Step>
      <Step n={2}>Oppure menu <strong>⋮</strong> → <strong>&quot;Installa CleanDOG&quot;</strong></Step>
      <Step n={3}>Conferma con <strong>&quot;Installa&quot;</strong></Step>
    </ol>
  );
}
