'use client';

import { useEffect, useState } from 'react';

type Props = {
  scope: 'ADMIN' | 'CLIENT';
  customerPhone?: string;
  /** Custom label override */
  label?: string;
  /** Small inline style (true) or full banner */
  inline?: boolean;
};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSubscribe({ scope, customerPhone, label, inline }: Props) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'denied' | 'error'>('idle');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (!ok) return;

    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setStatus('subscribed');
      })
      .catch(() => {});
  }, []);

  async function subscribe() {
    setStatus('subscribing');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'idle');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        console.error('VAPID public key missing');
        setStatus('error');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope,
          customerPhone,
          subscription: {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          },
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('subscribed');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }

  if (!supported || hidden) return null;
  if (status === 'subscribed') return null;

  const text = label ?? (scope === 'ADMIN' ? 'Abilita notifiche admin' : 'Abilita notifiche');

  if (inline) {
    return (
      <button
        type="button"
        onClick={subscribe}
        disabled={status === 'subscribing' || status === 'denied'}
        className="rounded-md px-3 py-1.5 text-xs font-medium"
        style={{
          background: status === 'denied' ? 'var(--ink-300)' : 'var(--sage-800)',
          color: 'white',
          cursor: status === 'denied' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'subscribing' ? 'Attivo…' : status === 'denied' ? '🔕 Bloccate' : '🔔 ' + text}
      </button>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg px-4 py-3"
      style={{ background: 'var(--sage-50)', border: '1px solid var(--sage-200)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--sage-800)' }}>
          🔔 {text}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {status === 'denied'
            ? 'Notifiche bloccate dal browser. Abilitale dalle impostazioni del sito.'
            : 'Ricevi avvisi anche quando l\'app è chiusa.'}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={subscribe}
          disabled={status === 'subscribing' || status === 'denied'}
          className="rounded-md px-3 py-1.5 text-xs font-medium"
          style={{
            background: status === 'denied' ? 'var(--ink-300)' : 'var(--sage-800)',
            color: 'white',
            cursor: status === 'denied' ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'subscribing' ? 'Attivo…' : 'Abilita'}
        </button>
        <button
          type="button"
          aria-label="Chiudi"
          onClick={() => setHidden(true)}
          className="text-muted-foreground text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
