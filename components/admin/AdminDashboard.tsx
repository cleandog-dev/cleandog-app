'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatEUR } from '@/lib/utils';
import type {
  DayBar,
  TopClient,
  TopService,
  Period,
  PeriodComparison,
  SimpleComparison,
} from '@/lib/dashboard-stats';
import { PERIOD_LABELS, computeOffsetFor } from '@/lib/dashboard-stats';

export function AdminDashboard({
  period,
  offset,
  periodTitle,
  nowISO,
  comparison,
  ytd,
  ttm,
  lifetime,
  chart,
  topClients,
  topServices,
}: {
  period: Period;
  offset: number;
  periodTitle: string;
  nowISO: string;
  comparison: PeriodComparison;
  ytd: SimpleComparison;
  ttm: SimpleComparison;
  lifetime: { revenueCents: number; visits: number };
  chart: DayBar[];
  topClients: TopClient[];
  topServices: TopService[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildUrl(nextPeriod: Period, nextOffset: number): string {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (nextPeriod === 'month') params.delete('period');
    else params.set('period', nextPeriod);
    if (nextOffset === 0) params.delete('offset');
    else params.set('offset', String(nextOffset));
    const qs = params.toString();
    return qs ? `/admin?${qs}` : '/admin';
  }

  function setPeriod(p: Period) {
    // Reset offset when changing period (different scales aren't comparable).
    router.push(buildUrl(p, 0));
  }
  function shiftOffset(delta: number) {
    router.push(buildUrl(period, offset + delta));
  }
  function goToToday() {
    router.push(buildUrl(period, 0));
  }

  const { current, previous, revenueDeltaPct, visitsDeltaPct } = comparison;
  const visits = current.completed + current.confirmed;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold leading-tight sm:text-2xl">Dashboard</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {PERIOD_LABELS[period]}
          </p>
        </div>
        <PeriodSelector active={period} onChange={setPeriod} />
      </div>

      {/* Period navigator */}
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-background p-1.5">
        <button
          type="button"
          onClick={() => shiftOffset(-1)}
          className="rounded-md px-3 py-1.5 text-sm hover:bg-accent"
          aria-label="Periodo precedente"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <PeriodPicker
            period={period}
            offset={offset}
            periodTitle={periodTitle}
            nowISO={nowISO}
            onJump={(newOffset) => router.push(buildUrl(period, newOffset))}
          />
          {offset !== 0 && (
            <button
              type="button"
              onClick={goToToday}
              className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:bg-accent"
            >
              Oggi
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => shiftOffset(1)}
          className="rounded-md px-3 py-1.5 text-sm hover:bg-accent"
          aria-label="Periodo successivo"
        >
          →
        </button>
      </div>

      {/* Hero KPI: fatturato periodo + proiezione + YTD/TTM laterali */}
      <div className="grid gap-3 sm:grid-cols-3">
        <HeroRevenueCard
          period={period}
          comparison={comparison}
        />
        <div className="flex flex-col gap-3">
          <SideKpiCard
            label="YTD (anno in corso)"
            value={formatEUR(ytd.revenueCents)}
            deltaPct={ytd.revenueDeltaPct}
            subtitle={`vs stesso periodo ${new Date(nowISO).getFullYear() - 1}`}
          />
          <SideKpiCard
            label="Ultimi 12 mesi"
            value={formatEUR(ttm.revenueCents)}
            deltaPct={ttm.revenueDeltaPct}
            subtitle="vs 12 mesi precedenti"
          />
        </div>
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard
          label="Appuntamenti"
          value={String(visits)}
          deltaPct={visitsDeltaPct}
          subtitle={`vs ${previous.completed + previous.confirmed}`}
          accent="emerald"
        />
        <KpiCard
          label="Ticket medio"
          value={formatEUR(current.avgTicketCents)}
          subtitle={previous.avgTicketCents > 0 ? `vs ${formatEUR(previous.avgTicketCents)}` : '—'}
        />
        <KpiCard
          label="Cancellate"
          value={String(current.cancelled)}
          subtitle={`vs ${previous.cancelled}`}
          accent="rose"
        />
      </div>

      {/* Chart */}
      <ChartSection chart={chart} period={period} />

      {/* Top liste */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border bg-background p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Top clienti</h2>
            <Link href="/admin/clienti" className="text-xs text-muted-foreground hover:underline">
              Vedi tutti →
            </Link>
          </div>
          {topClients.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun cliente in questo periodo.</p>
          ) : (
            <ul className="divide-y">
              {topClients.map((c, i) => (
                <li key={c.phoneKey} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/admin/clienti/${c.phoneKey}`} className="flex-1 truncate hover:underline">
                    <span className="mr-2 text-xs font-mono text-muted-foreground">#{i + 1}</span>
                    {c.name || '—'}
                  </Link>
                  <span className="text-xs text-muted-foreground">{c.visits}×</span>
                  <span className="font-mono text-xs">{formatEUR(c.spentCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-background p-4">
          <h2 className="mb-2 text-sm font-semibold">Top servizi</h2>
          {topServices.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun servizio in questo periodo.</p>
          ) : (
            <ul className="divide-y">
              {topServices.map((s, i) => (
                <li key={s.name} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="flex-1 truncate">
                    <span className="mr-2 text-xs font-mono text-muted-foreground">#{i + 1}</span>
                    {s.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.count}×</span>
                  <span className="font-mono text-xs">{formatEUR(s.revenueCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/prenotazioni" className="rounded-md border bg-background px-3 py-1.5 hover:bg-accent">
          📅 Vai alle prenotazioni
        </Link>
        <Link href="/admin/clienti" className="rounded-md border bg-background px-3 py-1.5 hover:bg-accent">
          👥 Gestisci clienti
        </Link>
      </div>

      {/* Footer fact: lifetime cumulative (de-enfatizzato, vanity stat). */}
      <p className="border-t pt-3 text-center text-[11px] text-muted-foreground">
        Totale storico: <span className="font-mono font-semibold text-foreground">{formatEUR(lifetime.revenueCents)}</span>
        {' · '}
        {lifetime.visits} {lifetime.visits === 1 ? 'appuntamento' : 'appuntamenti'} dall&apos;inizio
      </p>
    </div>
  );
}

function PeriodSelector({ active, onChange }: { active: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-md border bg-background p-0.5 text-xs">
      {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            active === p
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

// Period title button + dropdown picker.
function PeriodPicker({
  period,
  offset,
  periodTitle,
  nowISO,
  onJump,
}: {
  period: Period;
  offset: number;
  periodTitle: string;
  nowISO: string;
  onJump: (newOffset: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const now = new Date(nowISO);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function jumpFromDate(d: Date) {
    onJump(computeOffsetFor(period, d, now));
    setOpen(false);
  }

  function nativeInputType(): 'month' | 'week' | null {
    if (period === 'month') return 'month';
    if (period === 'week') return 'week';
    return null;
  }
  function nativeInputValue(): string {
    const ref = new Date(now);
    if (period === 'month') {
      ref.setMonth(ref.getMonth() + offset);
      return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
    }
    if (period === 'week') {
      ref.setDate(ref.getDate() + offset * 7);
      const week = isoWeek(ref);
      return `${week.year}-W${String(week.week).padStart(2, '0')}`;
    }
    return '';
  }
  function onNativeChange(v: string) {
    if (period === 'month') {
      const [y, m] = v.split('-').map(Number);
      if (y && m) jumpFromDate(new Date(y, m - 1, 15));
    } else if (period === 'week') {
      const match = v.match(/^(\d{4})-W(\d{2})$/);
      if (match) {
        const y = Number(match[1]);
        const w = Number(match[2]);
        jumpFromDate(dateFromIsoWeek(y, w));
      }
    }
  }

  const nat = nativeInputType();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold hover:bg-accent"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="capitalize">{periodTitle}</span>
        <span className="text-xs text-muted-foreground">▾</span>
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-lg border bg-background p-3 shadow-lg"
        >
          {nat ? (
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Scegli {period === 'month' ? 'mese' : 'settimana'}
              </span>
              <input
                type={nat}
                value={nativeInputValue()}
                onChange={(e) => onNativeChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>
          ) : (
            <YearSubPicker period={period} now={now} offset={offset} onJump={jumpFromDate} />
          )}

          {/* Quick presets */}
          <div className="mt-3 grid grid-cols-3 gap-1 text-[11px]">
            {[
              { label: 'Oggi', off: 0 },
              { label: '-1', off: -1 },
              { label: '-3', off: -3 },
              { label: '-6', off: -6 },
              { label: '-12', off: -12 },
              { label: '+1', off: +1 },
            ].map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => { onJump(q.off); setOpen(false); }}
                className={`rounded-md border px-2 py-1 transition-colors ${
                  q.off === offset ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-picker per quarter/semester/year: year stepper + quick row.
function YearSubPicker({
  period,
  now,
  offset,
  onJump,
}: {
  period: Period;
  now: Date;
  offset: number;
  onJump: (d: Date) => void;
}) {
  // Compute current reference year + sub-period from offset.
  const ref = new Date(now);
  if (period === 'year') ref.setFullYear(ref.getFullYear() + offset);
  else if (period === 'semester') ref.setMonth(ref.getMonth() + offset * 6);
  else if (period === 'quarter') ref.setMonth(ref.getMonth() + offset * 3);
  const [year, setYear] = useState(ref.getFullYear());

  function pickMonth(month: number) {
    onJump(new Date(year, month, 15));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setYear(year - 1)} className="rounded-md px-2 py-1 text-sm hover:bg-accent" aria-label="Anno precedente">←</button>
        <span className="text-sm font-semibold">{year}</span>
        <button type="button" onClick={() => setYear(year + 1)} className="rounded-md px-2 py-1 text-sm hover:bg-accent" aria-label="Anno successivo">→</button>
      </div>
      {period === 'quarter' && (
        <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
          {[0, 1, 2, 3].map((q) => (
            <button key={q} type="button" onClick={() => pickMonth(q * 3)} className="rounded-md border px-2 py-1.5 hover:bg-accent">
              Q{q + 1}
            </button>
          ))}
        </div>
      )}
      {period === 'semester' && (
        <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
          <button type="button" onClick={() => pickMonth(0)} className="rounded-md border px-2 py-1.5 hover:bg-accent">1° sem</button>
          <button type="button" onClick={() => pickMonth(6)} className="rounded-md border px-2 py-1.5 hover:bg-accent">2° sem</button>
        </div>
      )}
      {period === 'year' && (
        <button
          type="button"
          onClick={() => pickMonth(0)}
          className="mt-2 w-full rounded-md border px-2 py-1.5 text-xs hover:bg-accent"
        >
          Vai a {year}
        </button>
      )}
    </div>
  );
}

// ISO week helpers (Monday-based, ISO-8601).
function isoWeek(d: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 86_400_000));
  return { year: target.getUTCFullYear(), week };
}
function dateFromIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - jan4Day + (week - 1) * 7);
  return new Date(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate() + 3);
}

// Hero card: fatturato del periodo + delta vs PPTD + proiezione fine periodo.
function HeroRevenueCard({
  period,
  comparison,
}: {
  period: Period;
  comparison: PeriodComparison;
}) {
  const { current, revenueDeltaPct, previousRangeLabel, inProgress, projectedRevenueCents, daysElapsed, daysTotal } = comparison;
  const deltaClass = revenueDeltaPct == null
    ? 'text-muted-foreground'
    : revenueDeltaPct > 0 ? 'text-emerald-700' : revenueDeltaPct < 0 ? 'text-rose-700' : 'text-muted-foreground';
  const deltaSym = revenueDeltaPct == null ? '' : revenueDeltaPct > 0 ? '↑' : revenueDeltaPct < 0 ? '↓' : '·';

  return (
    <section className="sm:col-span-2 rounded-xl border p-4" style={{ background: 'var(--sage-100)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--sage-800)]">
        Fatturato · {PERIOD_LABELS[period].toLowerCase()}
        {inProgress && <span className="ml-1.5 rounded-full bg-white/60 px-1.5 py-0.5 text-[9px] normal-case text-[color:var(--sage-800)]">in corso</span>}
      </p>
      <p className="mt-1 text-3xl font-bold leading-none text-[color:var(--sage-800)] sm:text-4xl">
        {formatEUR(current.revenueCents)}
      </p>
      {revenueDeltaPct != null && (
        <p className={`mt-1.5 text-xs font-medium ${deltaClass}`}>
          {deltaSym} {Math.abs(revenueDeltaPct)}% <span className="text-muted-foreground">vs {previousRangeLabel}</span>
        </p>
      )}
      {inProgress && projectedRevenueCents != null && (
        <div className="mt-3 border-t border-[color:var(--sage-800)]/15 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Proiezione fine periodo
          </p>
          <p className="mt-0.5 text-lg font-bold text-[color:var(--sage-800)] sm:text-xl">
            {formatEUR(projectedRevenueCents)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            basato su {daysElapsed} di {daysTotal} {daysTotal === 1 ? 'giorno' : 'giorni'}
          </p>
        </div>
      )}
    </section>
  );
}

// Card laterale compatta per KPI di confronto (YTD, TTM).
function SideKpiCard({
  label,
  value,
  deltaPct,
  subtitle,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  subtitle?: string;
}) {
  const deltaClass = deltaPct == null
    ? 'text-muted-foreground'
    : deltaPct > 0 ? 'text-emerald-700' : deltaPct < 0 ? 'text-rose-700' : 'text-muted-foreground';
  const deltaSym = deltaPct == null ? '' : deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '·';
  return (
    <div className="flex-1 rounded-xl border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold sm:text-xl">{value}</p>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5 text-[10px]">
        {deltaPct != null && (
          <span className={`font-semibold ${deltaClass}`}>{deltaSym} {Math.abs(deltaPct)}%</span>
        )}
        {subtitle && <span className="truncate text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  deltaPct,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  subtitle?: string;
  accent?: 'emerald' | 'rose' | 'sage';
}) {
  const accentColor =
    accent === 'emerald' ? 'text-emerald-700'
      : accent === 'rose' ? 'text-rose-700'
        : accent === 'sage' ? 'text-[color:var(--sage-800)]'
          : '';
  const deltaClass = deltaPct == null
    ? 'text-muted-foreground'
    : deltaPct > 0 ? 'text-emerald-700' : deltaPct < 0 ? 'text-rose-700' : 'text-muted-foreground';
  const deltaSymbol = deltaPct == null ? '' : deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '·';
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold sm:text-2xl ${accentColor}`}>{value}</p>
      <div className="mt-1 flex items-baseline gap-1.5 text-[10px]">
        {deltaPct != null && (
          <span className={`font-semibold ${deltaClass}`}>
            {deltaSymbol} {Math.abs(deltaPct)}%
          </span>
        )}
        {subtitle && <span className="truncate text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}

// Line + area chart in stile Stripe/Vercel.
// SVG-based: smooth area under line, hover guide + dot, floating tooltip.
// Mostra solo il fatturato (le prenotazioni sono già nei KPI card sopra).
function ChartSection({ chart, period }: { chart: DayBar[]; period: Period }) {
  const [hover, setHover] = useState<number | null>(null);

  if (chart.length === 0) {
    return (
      <section className="rounded-xl border bg-background p-4">
        <p className="py-8 text-center text-xs text-muted-foreground">Nessun dato in questo periodo.</p>
      </section>
    );
  }

  const values = chart.map((d) => d.revenueCents);
  const total = values.reduce((s, v) => s + v, 0);
  const max = Math.max(1, ...values);

  const todayKey = (() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();
  const todayIndex = chart.findIndex((d) => d.bucket === todayKey);

  const totalLabel = formatEUR(total);
  const hovered = hover != null ? chart[hover] : null;

  // SVG geometry
  const W = 1000;
  const H = 200;
  const padTop = 12;
  const padBottom = 4;
  const innerH = H - padTop - padBottom;
  const n = chart.length;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => padTop + innerH - (v / max) * innerH;

  const linePoints = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const areaPath = (() => {
    const top = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
    return `${top} L ${W} ${H - padBottom} L 0 ${H - padBottom} Z`;
  })();

  function handleMove(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const idx = Math.round(ratio * (n - 1));
    setHover(idx);
  }

  return (
    <section className="rounded-xl border bg-background p-4">
      {/* Header: big number */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Fatturato · {PERIOD_LABELS[period].toLowerCase()}
        </p>
        <p className="text-2xl font-bold leading-none sm:text-3xl">{totalLabel}</p>
      </div>

      {/* Chart */}
      <div className="relative">
        {/* Floating tooltip */}
        {hovered && hover != null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-background px-2 py-1 text-[11px] shadow-md"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              top: -2,
            }}
          >
            <div className="font-semibold capitalize">{hovered.label}</div>
            <div className="font-mono text-muted-foreground">
              {formatEUR(hovered.revenueCents)}
              {hovered.count > 0 && ` · ${hovered.count} prenot.`}
            </div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-32 w-full"
          preserveAspectRatio="none"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onTouchStart={handleMove}
          onTouchMove={handleMove}
          onTouchEnd={() => setHover(null)}
        >
          <defs>
            <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sage-800)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--sage-800)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area */}
          <path d={areaPath} fill="url(#chart-area)" />

          {/* Line */}
          <polyline
            points={linePoints}
            fill="none"
            stroke="var(--sage-800)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Today vertical marker */}
          {todayIndex >= 0 && (
            <line
              x1={x(todayIndex)}
              x2={x(todayIndex)}
              y1={padTop}
              y2={H - padBottom}
              stroke="var(--brown-500, #A6886A)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Hover guide line + dot */}
          {hover != null && (
            <>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={padTop}
                y2={H - padBottom}
                stroke="var(--sage-800)"
                strokeWidth="1"
                strokeOpacity="0.3"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={x(hover)}
                cy={y(values[hover] ?? 0)}
                r="6"
                fill="var(--sage-800)"
                stroke="white"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* X-axis: first, today (if in range), last */}
        <div className="relative mt-2 h-3 text-[10px] text-muted-foreground">
          <span className="absolute left-0 capitalize">{chart[0]?.label}</span>
          {todayIndex >= 1 && todayIndex < chart.length - 1 && (
            <span
              className="absolute capitalize"
              style={{
                left: `${(x(todayIndex) / W) * 100}%`,
                transform: 'translateX(-50%)',
                color: 'var(--brown-700, #8B6A4F)',
              }}
            >
              oggi
            </span>
          )}
          <span className="absolute right-0 capitalize">{chart[chart.length - 1]?.label}</span>
        </div>
      </div>
    </section>
  );
}
