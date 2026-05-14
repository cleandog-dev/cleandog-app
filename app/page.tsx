import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/Logo';

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream-100)' }}>

      {/* Header */}
      <header className="app-chrome">
        <div className="mx-auto flex h-14 max-w-screen-md items-center justify-between px-5">
          <Logo />
          <Link href="/prenota" className="btn-primary text-sm" style={{ padding: '10px 22px' }}>
            Prenota
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-5 pb-14 pt-12 text-center">
          {/* Floating paw halo */}
          <div className="relative mx-auto mb-8 flex h-32 w-32 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full animate-pulse-soft"
              style={{ background: 'radial-gradient(circle, var(--sage-100), transparent 70%)' }}
            />
            <Image
              src="/logo.png"
              alt="CleanDOG"
              width={112}
              height={112}
              priority
              className="relative rounded-full shadow-md animate-floaty"
              style={{ boxShadow: 'var(--shadow-md)' }}
            />
          </div>

          <p className="eyebrow mb-3">Messina · Toelettatura professionale</p>

          <h1
            className="display mx-auto max-w-sm"
            style={{ fontSize: 'clamp(38px, 10vw, 64px)', color: 'var(--ink-900)' }}
          >
            Il tuo amico a 4 zampe{' '}
            <em style={{ color: 'var(--brown-700)' }}>merita il meglio</em>
          </h1>

          <p className="mx-auto mt-4 max-w-xs text-base leading-relaxed" style={{ color: 'var(--ink-500)' }}>
            Bagno, toelettatura e cura per cani e gatti. Prenota online in 3 minuti.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/prenota" className="btn-primary text-base">
              <svg width="18" height="18" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="10" width="32" height="28" rx="5" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                <path d="M14 6v8M30 6v8M6 20h32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              Prenota appuntamento
            </Link>
            <a
              href="/volantino-prezzi.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm"
              style={{ color: 'var(--ink-500)' }}
            >
              <svg width="15" height="15" viewBox="0 0 44 44" fill="none">
                <path d="M10 4h16l10 10v26a2 2 0 01-2 2H10a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
                <path d="M26 4v10h10" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
                <path d="M16 24h12M16 30h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              Listino prezzi
            </a>
            <a href="tel:0903354798" className="btn-ghost text-sm" style={{ color: 'var(--ink-500)' }}>
              📞 090 335 4798
            </a>
          </div>

          {/* Trust row */}
          <div className="mx-auto mt-8 flex max-w-xs justify-center gap-6 text-xs" style={{ color: 'var(--ink-500)' }}>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="16" stroke="currentColor" strokeWidth="2.5"/><path d="M22 12v11l7 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              Conferma in 5 min
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 44 44" fill="none"><path d="M22 8c-7.18 0-13 5.82-13 13 0 3.5 1.39 6.68 3.64 9.01L10 36l6.26-1.6A12.94 12.94 0 0 0 22 36c7.18 0 13-5.82 13-13S29.18 8 22 8z" stroke="currentColor" strokeWidth="2.5" fill="none"/></svg>
              Promemoria automatici
            </span>
          </div>
        </section>

        {/* Servizi */}
        <section className="px-5 pb-10">
          <div className="mx-auto max-w-screen-md">
            <p className="eyebrow mb-5 text-center">Cosa offriamo</p>
            <div className="space-y-3">
              {[
                { emoji: '🛁', name: 'Bagno & Asciugatura', desc: 'Shampoo naturale, asciugatura delicata', price: 'Da 28€', min: '45 min' },
                { emoji: '✂️', name: 'Taglio & Styling', desc: 'Forbici, rifinitura su misura', price: 'Da 38€', min: '60 min' },
                { emoji: '⭐', name: 'Toelettatura completa', desc: 'Bagno + taglio + unghie + orecchie', price: 'Da 58€', min: '90 min', popular: true },
                { emoji: '🐱', name: 'Servizi per gatti', desc: 'Bagno, toelettatura, tosatura igienica', price: 'Da 35€', min: '45 min' },
              ].map((s) => (
                <div key={s.name} className="card-cd flex items-center gap-4 p-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                    style={{ background: 'var(--sage-100)', borderRadius: 'var(--r-md)' }}
                  >
                    {s.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: 'var(--ink-900)' }}>{s.name}</span>
                      {s.popular && (
                        <span className="badge-brown text-[10px]" style={{ background: 'var(--brown-100)', color: 'var(--brown-800)', padding: '2px 8px', borderRadius: 'var(--r-pill)', fontSize: 11, fontWeight: 500 }}>
                          Più richiesto
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>{s.desc}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>⏱ {s.min}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="display text-lg" style={{ color: 'var(--sage-800)' }}>{s.price}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/prenota" className="btn-primary mt-6 w-full justify-center text-base">
              Prenota ora
            </Link>
          </div>
        </section>

        {/* Info */}
        <section className="px-5 pb-14">
          <div className="mx-auto max-w-screen-md">
            <div className="card-cd p-5 space-y-4">
              <p className="eyebrow">Info e orari</p>
              <div className="space-y-3 text-sm" style={{ color: 'var(--ink-700)' }}>
                <div className="flex items-start gap-3">
                  <span>📍</span>
                  <p>Messina — <span style={{ color: 'var(--ink-500)' }}>contattaci per l'indirizzo esatto</span></p>
                </div>
                <div className="flex items-start gap-3">
                  <span>🕐</span>
                  <div>
                    <p>Lunedì – Venerdì: <strong>9:00 – 18:00</strong></p>
                    <p>Sabato: <strong>9:00 – 13:00</strong></p>
                    <p style={{ color: 'var(--ink-500)' }}>Domenica: chiuso</p>
                  </div>
                </div>
                <a href="tel:0903354798" className="flex items-center gap-3">
                  <span>📞</span>
                  <strong>090 335 4798</strong>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-5 py-6 text-center text-xs" style={{ borderColor: 'var(--cream-300)', color: 'var(--ink-300)' }}>
        <p style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 10 }}>
          CleanDOG · Messina · Lunedì – Sabato
        </p>
        <p className="mt-2">
          <Link href="/privacy" className="underline">Privacy</Link>
          {' · '}
          <Link href="/login" className="underline">Area riservata</Link>
        </p>
      </footer>
    </div>
  );
}
