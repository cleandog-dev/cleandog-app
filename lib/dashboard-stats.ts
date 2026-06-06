// Pure helpers for admin landing dashboard. Read-only aggregation over Booking rows.

import { normalizePhone } from '@/lib/clients';

export type Period = 'week' | 'month' | 'quarter' | 'semester' | 'year';

export const PERIOD_LABELS: Record<Period, string> = {
  week: 'Settimana',
  month: 'Mese',
  quarter: 'Trimestre',
  semester: 'Semestre',
  year: 'Anno',
};

export interface DashBooking {
  status: string;
  startsAt: Date;
  priceCents: number;
  serviceName: string | null;
  customerName: string;
  customerPhone: string;
  dogName: string;
  service: { name: string } | null;
}

export type PeriodStats = {
  total: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  revenueCents: number;
  avgTicketCents: number;
};

export type PeriodComparison = {
  current: PeriodStats;
  previous: PeriodStats;
  revenueDeltaPct: number | null;  // % vs previous; null if previous = 0
  visitsDeltaPct: number | null;
  rangeLabel: string;               // "1 — 27 Mag 2026"
  previousRangeLabel: string;
  inProgress: boolean;              // true se end > now (periodo non ancora chiuso)
  projectedRevenueCents: number | null; // run-rate fine periodo (solo se inProgress)
  daysElapsed: number;
  daysTotal: number;
};

// Confronto a finestra fissa (YTD, TTM) — semplice, no offset.
export type SimpleComparison = {
  revenueCents: number;
  prevRevenueCents: number;
  visits: number;
  prevVisits: number;
  revenueDeltaPct: number | null;
  rangeLabel: string;
  previousRangeLabel: string;
};

export type DayBar = {
  bucket: string;       // YYYY-MM-DD (giorno o lunedì-settimana o 1 del mese)
  label: string;        // breve label per asse X
  count: number;
  revenueCents: number;
};

export type TopClient = {
  phoneKey: string;
  name: string;
  phone: string;
  visits: number;
  spentCents: number;
};

export type TopService = {
  name: string;
  count: number;
  revenueCents: number;
};

// Conta come incassato solo gli appuntamenti effettivamente eseguiti.
const PAID = new Set(['COMPLETED']);

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function fmtDateShort(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// Human-friendly title for the period being viewed.
export function periodTitle(period: Period, now: Date, offset = 0): string {
  const ref = shiftNow(period, now, offset);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  if (period === 'week') {
    const { start, end } = periodRange(period, now, offset);
    const last = new Date(end); last.setDate(last.getDate() - 1);
    return `Settimana ${fmtDateShort(start)} — ${fmtDateShort(last)} ${year}`;
  }
  if (period === 'month') {
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    return `${months[month]} ${year}`;
  }
  if (period === 'quarter') {
    return `Q${Math.floor(month / 3) + 1} ${year}`;
  }
  if (period === 'semester') {
    return `${month < 6 ? '1° semestre' : '2° semestre'} ${year}`;
  }
  return String(year);
}

function fmtDateRange(start: Date, end: Date): string {
  const e = new Date(end);
  e.setMilliseconds(e.getMilliseconds() - 1); // inclusive display
  const sameYear = start.getFullYear() === e.getFullYear();
  return sameYear
    ? `${fmtDateShort(start)} — ${fmtDateShort(e)} ${e.getFullYear()}`
    : `${fmtDateShort(start)} ${start.getFullYear()} — ${fmtDateShort(e)} ${e.getFullYear()}`;
}

// Compute how many whole periods separate `target` from `now`
// (target later than now → positive; earlier → negative).
export function computeOffsetFor(period: Period, target: Date, now: Date): number {
  if (period === 'week') {
    const aMon = startOfWeekMon(now);
    const bMon = startOfWeekMon(target);
    return Math.round((bMon.getTime() - aMon.getTime()) / (7 * 86_400_000));
  }
  if (period === 'month') {
    return (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  }
  if (period === 'quarter') {
    const qNow = Math.floor(now.getMonth() / 3);
    const qT = Math.floor(target.getMonth() / 3);
    return (target.getFullYear() - now.getFullYear()) * 4 + (qT - qNow);
  }
  if (period === 'semester') {
    const hNow = now.getMonth() < 6 ? 0 : 1;
    const hT = target.getMonth() < 6 ? 0 : 1;
    return (target.getFullYear() - now.getFullYear()) * 2 + (hT - hNow);
  }
  return target.getFullYear() - now.getFullYear();
}

function startOfWeekMon(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0);
  const dow = r.getDay() || 7;
  r.setDate(r.getDate() - (dow - 1));
  return r;
}

// Shift "now" by `offset` whole periods (negative = past, positive = future).
function shiftNow(period: Period, now: Date, offset: number): Date {
  if (offset === 0) return now;
  const d = new Date(now);
  if (period === 'week') d.setDate(d.getDate() + offset * 7);
  else if (period === 'month') d.setMonth(d.getMonth() + offset);
  else if (period === 'quarter') d.setMonth(d.getMonth() + offset * 3);
  else if (period === 'semester') d.setMonth(d.getMonth() + offset * 6);
  else d.setFullYear(d.getFullYear() + offset);
  return d;
}

// Italian-style calendar windows. End = exclusive upper bound (start of next).
// `offset`: 0 = period containing `now`; -1 = previous period; +1 = next period.
export function periodRange(period: Period, now: Date, offset = 0): { start: Date; end: Date } {
  const ref = shiftNow(period, now, offset);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  if (period === 'week') {
    const start = new Date(ref); start.setHours(0, 0, 0, 0);
    const dow = start.getDay() || 7;
    start.setDate(start.getDate() - (dow - 1));
    const end = new Date(start); end.setDate(end.getDate() + 7);
    return { start, end };
  }
  if (period === 'month') {
    return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
  }
  if (period === 'quarter') {
    const qStart = Math.floor(month / 3) * 3;
    return { start: new Date(year, qStart, 1), end: new Date(year, qStart + 3, 1) };
  }
  if (period === 'semester') {
    const hStart = month < 6 ? 0 : 6;
    return { start: new Date(year, hStart, 1), end: new Date(year, hStart + 6, 1) };
  }
  return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}

// Immediately preceding window of the same length.
export function previousPeriodRange(period: Period, now: Date, offset = 0): { start: Date; end: Date } {
  const cur = periodRange(period, now, offset);
  if (period === 'week') {
    const start = new Date(cur.start); start.setDate(start.getDate() - 7);
    return { start, end: cur.start };
  }
  if (period === 'month') {
    const start = new Date(cur.start.getFullYear(), cur.start.getMonth() - 1, 1);
    return { start, end: cur.start };
  }
  if (period === 'quarter') {
    const start = new Date(cur.start.getFullYear(), cur.start.getMonth() - 3, 1);
    return { start, end: cur.start };
  }
  if (period === 'semester') {
    const start = new Date(cur.start.getFullYear(), cur.start.getMonth() - 6, 1);
    return { start, end: cur.start };
  }
  // year
  return {
    start: new Date(cur.start.getFullYear() - 1, 0, 1),
    end: cur.start,
  };
}

// Half-open range [start, end). Nessun cap implicito: il chiamante decide.
function statsInRangeStrict(bookings: DashBooking[], start: Date, end: Date): PeriodStats {
  const inRange = bookings.filter((b) => b.startsAt >= start && b.startsAt < end);
  const confirmed = inRange.filter((b) => b.status === 'CONFIRMED').length;
  const completed = inRange.filter((b) => b.status === 'COMPLETED').length;
  const cancelled = inRange.filter((b) => b.status === 'CANCELLED').length;
  const paid = inRange.filter((b) => PAID.has(b.status));
  const revenueCents = paid.reduce((s, b) => s + (b.priceCents ?? 0), 0);
  const avgTicketCents = paid.length > 0 ? Math.round(revenueCents / paid.length) : 0;
  return {
    total: inRange.length,
    confirmed,
    completed,
    cancelled,
    revenueCents,
    avgTicketCents,
  };
}

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

export function computePeriodComparison(
  bookings: DashBooking[],
  period: Period,
  now = new Date(),
  offset = 0,
): PeriodComparison {
  const cur = periodRange(period, now, offset);
  const prev = periodRange(period, now, offset - 1);
  const inProgress = cur.end > now;

  // Periodo corrente: cap a now se in corso, altrimenti finestra intera.
  const curEnd = inProgress && now > cur.start ? now : cur.end;
  const current = statsInRangeStrict(bookings, cur.start, curEnd);

  // PPTD: se in corso, taglia prior alla stessa quota di tempo trascorso.
  const elapsedMs = Math.max(0, curEnd.getTime() - cur.start.getTime());
  const totalMs = cur.end.getTime() - cur.start.getTime();
  const prevEnd = inProgress ? new Date(prev.start.getTime() + elapsedMs) : prev.end;
  const previous = statsInRangeStrict(bookings, prev.start, prevEnd);

  // Proiezione fatturato fine periodo via run-rate lineare.
  const projectedRevenueCents = (inProgress && elapsedMs > 0 && totalMs > elapsedMs)
    ? Math.round((current.revenueCents / elapsedMs) * totalMs)
    : null;

  const daysTotal = Math.max(1, Math.ceil(totalMs / 86_400_000));
  const daysElapsed = Math.max(0, Math.min(daysTotal, Math.ceil(elapsedMs / 86_400_000)));

  return {
    current,
    previous,
    revenueDeltaPct: pctDelta(current.revenueCents, previous.revenueCents),
    visitsDeltaPct: pctDelta(current.completed + current.confirmed, previous.completed + previous.confirmed),
    rangeLabel: fmtDateRange(cur.start, cur.end),
    previousRangeLabel: fmtDateRange(prev.start, prevEnd),
    inProgress,
    projectedRevenueCents,
    daysElapsed,
    daysTotal,
  };
}

// Year-To-Date vs stesso periodo anno precedente (1 gen → oggi vs 1 gen → stesso giorno anno scorso).
export function computeYTDComparison(bookings: DashBooking[], now = new Date()): SimpleComparison {
  const yStart = new Date(now.getFullYear(), 0, 1);
  const cur = statsInRangeStrict(bookings, yStart, now);
  const py = now.getFullYear() - 1;
  const prevStart = new Date(py, 0, 1);
  const prevEnd = new Date(py, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  const prev = statsInRangeStrict(bookings, prevStart, prevEnd);
  return {
    revenueCents: cur.revenueCents,
    prevRevenueCents: prev.revenueCents,
    visits: cur.completed + cur.confirmed,
    prevVisits: prev.completed + prev.confirmed,
    revenueDeltaPct: pctDelta(cur.revenueCents, prev.revenueCents),
    rangeLabel: `${fmtDateShort(yStart)} — ${fmtDateShort(now)} ${now.getFullYear()}`,
    previousRangeLabel: `${fmtDateShort(prevStart)} — ${fmtDateShort(prevEnd)} ${py}`,
  };
}

// Trailing 12 Months: ultimi 365gg vs i 365gg precedenti. Finestra mobile, no calendar boundary.
export function computeTTMComparison(bookings: DashBooking[], now = new Date()): SimpleComparison {
  const ttmStart = new Date(now); ttmStart.setFullYear(ttmStart.getFullYear() - 1);
  const cur = statsInRangeStrict(bookings, ttmStart, now);
  const prevStart = new Date(ttmStart); prevStart.setFullYear(prevStart.getFullYear() - 1);
  const prev = statsInRangeStrict(bookings, prevStart, ttmStart);
  return {
    revenueCents: cur.revenueCents,
    prevRevenueCents: prev.revenueCents,
    visits: cur.completed + cur.confirmed,
    prevVisits: prev.completed + prev.confirmed,
    revenueDeltaPct: pctDelta(cur.revenueCents, prev.revenueCents),
    rangeLabel: `${fmtDateShort(ttmStart)} ${ttmStart.getFullYear()} — ${fmtDateShort(now)} ${now.getFullYear()}`,
    previousRangeLabel: `${fmtDateShort(prevStart)} ${prevStart.getFullYear()} — ${fmtDateShort(ttmStart)} ${ttmStart.getFullYear()}`,
  };
}

// Lifetime cumulative revenue (CONFIRMED + COMPLETED, only past).
export function computeLifetimeRevenue(bookings: DashBooking[], now = new Date()): { revenueCents: number; visits: number } {
  const past = bookings.filter((b) => b.startsAt <= now && PAID.has(b.status));
  const revenueCents = past.reduce((s, b) => s + (b.priceCents ?? 0), 0);
  return { revenueCents, visits: past.length };
}

// Adaptive bucket size per period for chart readability.
type BucketUnit = 'day' | 'week' | 'month';
function bucketUnitFor(period: Period): BucketUnit {
  if (period === 'week' || period === 'month') return 'day';
  if (period === 'quarter' || period === 'semester') return 'week';
  return 'month';
}

function bucketKey(date: Date, unit: BucketUnit): { key: string; label: string; start: Date } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (unit === 'day') {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { key: k, label: String(d.getDate()), start: d };
  }
  if (unit === 'week') {
    const dow = d.getDay() || 7;
    d.setDate(d.getDate() - (dow - 1)); // monday
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { key: k, label: fmtDateShort(d), start: d };
  }
  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const k = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  return { key: k, label: MONTHS_SHORT[start.getMonth()] ?? '', start };
}

function bucketIter(start: Date, end: Date, unit: BucketUnit): Date[] {
  const out: Date[] = [];
  const cursor = bucketKey(start, unit).start;
  while (cursor < end) {
    out.push(new Date(cursor));
    if (unit === 'day') cursor.setDate(cursor.getDate() + 1);
    else if (unit === 'week') cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

// Period-aware chart: bucketed by day/week/month based on period length.
// Includes future bookings within the period (planning view); revenue still
// counts only COMPLETED appointments.
export function bookingsChart(bookings: DashBooking[], period: Period, _now = new Date(), offset = 0): DayBar[] {
  const { start, end } = periodRange(period, _now, offset);
  const unit = bucketUnitFor(period);
  const bucketsList = bucketIter(start, end, unit);

  const tally = new Map<string, { count: number; revenueCents: number }>();
  for (const b of bookings) {
    if (b.startsAt < start || b.startsAt >= end) continue;
    if (b.status === 'CANCELLED') continue;
    const k = bucketKey(b.startsAt, unit).key;
    const slot = tally.get(k) ?? { count: 0, revenueCents: 0 };
    slot.count += 1;
    if (PAID.has(b.status)) slot.revenueCents += b.priceCents ?? 0;
    tally.set(k, slot);
  }

  return bucketsList.map((d) => {
    const { key, label } = bucketKey(d, unit);
    const t = tally.get(key) ?? { count: 0, revenueCents: 0 };
    return { bucket: key, label, count: t.count, revenueCents: t.revenueCents };
  });
}

// Top clients within the period range (includes future bookings, excludes CANCELLED).
export function topClientsInPeriod(bookings: DashBooking[], period: Period, n: number, now = new Date(), offset = 0): TopClient[] {
  const { start, end } = periodRange(period, now, offset);
  const groups = new Map<string, TopClient>();
  for (const b of bookings) {
    if (b.startsAt < start || b.startsAt >= end) continue;
    if (b.status === 'CANCELLED') continue;
    const key = normalizePhone(b.customerPhone);
    if (!key) continue;
    const existing = groups.get(key);
    const spent = PAID.has(b.status) ? b.priceCents : 0;
    if (existing) {
      existing.visits += 1;
      existing.spentCents += spent;
      existing.name = b.customerName || existing.name;
    } else {
      groups.set(key, {
        phoneKey: key,
        name: b.customerName,
        phone: b.customerPhone,
        visits: 1,
        spentCents: spent,
      });
    }
  }
  return Array.from(groups.values())
    .sort((a, b) => b.visits - a.visits || b.spentCents - a.spentCents)
    .slice(0, n);
}

export function topServicesInPeriod(bookings: DashBooking[], period: Period, n: number, now = new Date(), offset = 0): TopService[] {
  const { start, end } = periodRange(period, now, offset);
  const map = new Map<string, TopService>();
  for (const b of bookings) {
    if (b.startsAt < start || b.startsAt >= end) continue;
    if (b.status === 'CANCELLED') continue;
    const name = (b.serviceName || b.service?.name || 'Servizio').replace(/ — (Cane|Gatto)$/, '');
    const existing = map.get(name);
    const rev = PAID.has(b.status) ? b.priceCents : 0;
    if (existing) {
      existing.count += 1;
      existing.revenueCents += rev;
    } else {
      map.set(name, { name, count: 1, revenueCents: rev });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, n);
}
