import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/Logo';
import { getPricesMapForAnimal } from '@/lib/breeds-server';
import { prisma } from '@/lib/db';

export const revalidate = 60;

export default async function HomePage() {
  const [services, dogPrices, openingHours] = await Promise.all([
    prisma.service.findMany({ where: { active: true, deletedAt: null } }),
    getPricesMapForAnimal('DOG'),
    prisma.openingHour.findMany({ orderBy: { dayOfWeek: 'asc' } }),
  ]);

  // Build human-readable opening-hours lines from DB rows.
  // Group consecutive days (Mon→Sun) that share the same open/close window.
  const DAY_LABELS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const DAY_SHORT  = ['Dom',      'Lun',     'Mar',     'Mer',       'Gio',     'Ven',     'Sab'    ];
  const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  type DayWindow = { dow: number; open: number; close: number; active: boolean };
  const byDow = new Map<number, DayWindow>();
  for (const h of openingHours) {
    byDow.set(h.dayOfWeek, { dow: h.dayOfWeek, open: h.openMinute, close: h.closeMinute, active: h.active });
  }
  // Iterate week starting Monday → Sunday (1..6,0)
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  type HoursLine = { label: string; value: string; closed: boolean };
  const hoursLines: HoursLine[] = [];
  let runStart: number | null = null;
  let runEnd: number | null = null;
  let runKey: string | null = null;
  const flush = () => {
    if (runStart == null || runEnd == null) return;
    const label = runStart === runEnd
      ? DAY_LABELS[runStart]!
      : `${DAY_SHORT[runStart]} – ${DAY_SHORT[runEnd]}`;
    const row = byDow.get(runStart);
    const closed = !row || !row.active;
    const value = closed ? 'chiuso' : `${fmt(row!.open)} – ${fmt(row!.close)}`;
    hoursLines.push({ label, value, closed });
  };
  for (const dow of weekOrder) {
    const row = byDow.get(dow);
    const key = row && row.active ? `${row.open}-${row.close}` : 'CLOSED';
    if (runKey === null) {
      runStart = dow; runEnd = dow; runKey = key;
    } else if (key === runKey) {
      runEnd = dow;
    } else {
      flush();
      runStart = dow; runEnd = dow; runKey = key;
    }
  }
  flush();

  // Compute min cents across breeds for a given service id (any size/coat cell).
  const minCentsForService = (
    payload: { pricesByBreed: Record<string, Record<string, Record<string, { priceCents: number | null; active: boolean }>>> },
    serviceId: string,
  ): number => {
    let m = Infinity;
    for (const breedId in payload.pricesByBreed) {
      const svcCells = payload.pricesByBreed[breedId]?.[serviceId];
      if (!svcCells) continue;
      for (const key in svcCells) {
        const r = svcCells[key];
        if (!r || !r.active || r.priceCents == null || r.priceCents <= 0) continue;
        if (r.priceCents < m) m = r.priceCents;
      }
    }
    return m === Infinity ? 0 : Math.round(m / 100);
  };

  type Card = {
    emoji: string;
    name: string;
    desc: string;
    price: number;
    min: number | null;
    popular?: boolean;
  };

  // Pick emoji from service name keyword (fallback ⭐).
  const emojiFor = (s: { name: string; displayName: string | null }): string => {
    const n = `${s.displayName ?? ''} ${s.name}`.toLowerCase();
    if (/bagno/.test(n)) return '🛁';
    if (/tosatur/.test(n)) return '✂️';
    if (/spuntat|mantenim/.test(n)) return '💈';
    if (/asilo|parking/.test(n)) return '🏠';
    return '⭐';
  };
  const labelOf = (s: { name: string; displayName: string | null }): string =>
    (s.displayName?.trim() || s.name.replace(/ — (Cane|Gatto)$/, ''));

  const sumMin = (
    payload: { pricesByBreed: Record<string, Record<string, Record<string, { priceCents: number | null; active: boolean }>>> },
    ids: string[],
  ): number => {
    let total = 0;
    for (const id of ids) {
      const v = minCentsForService(payload, id);
      if (v <= 0) return 0;
      total += v;
    }
    return total;
  };

  const cardsForAnimal = (
    animal: 'DOG' | 'CAT',
    payload: { pricesByBreed: Record<string, Record<string, Record<string, { priceCents: number | null; active: boolean }>>> },
  ): Card[] => {
    const list = services
      .filter((s) => s.forAnimal === animal)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const primary = list.find((s) => s.isDefault) ?? null;
    const addons = list.filter((s) => !s.isDefault);
    const out: Card[] = [];
    if (primary) {
      out.push({
        emoji: emojiFor(primary),
        name: labelOf(primary),
        desc: primary.description || (animal === 'CAT' ? 'Servizio per gatti' : 'Shampoo + asciugatura'),
        price:
          primary.pricingMode === 'FIXED'
            ? Math.round((primary.priceCents ?? 0) / 100)
            : minCentsForService(payload, primary.id),
        min: primary.durationMin,
      });
      for (const a of addons) {
        const price =
          a.pricingMode === 'FIXED' || primary.pricingMode === 'FIXED'
            ? (a.pricingMode === 'FIXED' ? Math.round((a.priceCents ?? 0) / 100) : minCentsForService(payload, a.id)) +
              (primary.pricingMode === 'FIXED' ? Math.round((primary.priceCents ?? 0) / 100) : minCentsForService(payload, primary.id))
            : sumMin(payload, [primary.id, a.id]);
        out.push({
          emoji: emojiFor(a),
          name: `${labelOf(primary)} + ${labelOf(a)}`,
          desc: a.description || '',
          price,
          min: primary.durationMin + a.durationMin,
        });
      }
    } else {
      // No default — show each service standalone
      for (const a of addons) {
        out.push({
          emoji: emojiFor(a),
          name: labelOf(a),
          desc: a.description || '',
          price:
            a.pricingMode === 'FIXED'
              ? Math.round((a.priceCents ?? 0) / 100)
              : minCentsForService(payload, a.id),
          min: a.durationMin,
        });
      }
    }
    return out;
  };

  const cards: Card[] = cardsForAnimal('DOG', dogPrices);

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
          <div className="relative mx-auto mb-8 flex h-32 w-32 items-center justify-center">
            <Image
              src="/logo.png"
              alt="CleanDOG"
              width={112}
              height={112}
              priority
              className="relative rounded-full animate-floaty"
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
              {cards.map((s) => (
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
                    {s.min != null && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>⏱ {s.min} min</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="display text-lg" style={{ color: 'var(--sage-800)' }}>
                      {s.price > 0 ? `Da ${s.price}€` : '—'}
                    </p>
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
                    {hoursLines.length === 0 ? (
                      <p style={{ color: 'var(--ink-500)' }}>Orari non disponibili</p>
                    ) : (
                      hoursLines.map((l) => (
                        <p key={l.label} style={l.closed ? { color: 'var(--ink-500)' } : undefined}>
                          {l.label}: {l.closed ? 'chiuso' : <strong>{l.value}</strong>}
                        </p>
                      ))
                    )}
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
          <Link href="/cancella" className="underline">Cancella prenotazione</Link>
          {' · '}
          <Link href="/login" className="underline">Area riservata</Link>
        </p>
      </footer>
    </div>
  );
}
