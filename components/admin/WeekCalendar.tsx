'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import type { Booking, Service, BookingStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { APP_TIMEZONE, animalLabel } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BookingDetailDialog } from './BookingDetailDialog';
import { assignLanes } from '@/lib/calendar-lanes';

type Row = Booking & { service: Service };

const statusColor: Record<BookingStatus, string> = {
  CONFIRMED: 'bg-white text-slate-900 border-slate-200 border-l-emerald-500',
  PENDING:   'bg-white text-slate-900 border-slate-200 border-l-amber-500',
  COMPLETED: 'bg-slate-50 text-slate-500 border-slate-200 border-l-slate-400',
  CANCELLED: 'bg-white text-slate-500 border-slate-200 border-l-rose-400 line-through opacity-70',
  NO_SHOW:   'bg-white text-slate-500 border-slate-200 border-l-rose-400 opacity-70',
};

// Opening hours for visual guide (minutes from midnight)
const OPEN_FROM = 9 * 60;   // 09:00
const OPEN_TO = 18 * 60;    // 18:00
const HOUR_HEIGHT_PX = 64;  // px per hour (used for both desktop + mobile)
const START_HOUR = 8;       // display from 08:00
const END_HOUR = 19;        // display to 19:00
const TOTAL_HOURS = END_HOUR - START_HOUR;

function minuteToTop(totalMinutes: number): number {
  const minutesFromStart = totalMinutes - START_HOUR * 60;
  return (minutesFromStart / 60) * HOUR_HEIGHT_PX;
}

function durationToHeight(durationMin: number): number {
  return (durationMin / 60) * HOUR_HEIGHT_PX;
}

// Strip " — Cane/Gatto" suffix from service name for compact display.
function cleanServiceName(name: string): string {
  return name.replace(/ — (Cane|Gatto)$/, '').trim();
}

// Build a compact label: "primary + addon1, addon2" if addons exist, else just the primary service.
function formatServiceLabel(b: Booking & { service: Service }): string {
  const primary = cleanServiceName(b.serviceName || b.service.name);
  if (!b.addonItemsJson) return primary;
  try {
    const addons = JSON.parse(b.addonItemsJson) as Array<{ name?: string }>;
    const names = addons.map((a) => a.name ? cleanServiceName(a.name) : '').filter(Boolean);
    if (!names.length) return primary;
    return `${primary} + ${names.join(', ')}`;
  } catch {
    return primary;
  }
}

export function WeekCalendar({
  bookings,
  mobileView = 'list',
  isAdmin = false,
}: {
  bookings: Row[];
  mobileView?: 'list' | 'grid';
  isAdmin?: boolean;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileView !== 'grid' || !scrollRef.current) return;
    // Scroll to current hour (or 9:00 if outside hours)
    const now = toZonedTime(new Date(), APP_TIMEZONE);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const target = nowMin >= OPEN_FROM && nowMin <= OPEN_TO ? nowMin - 30 : OPEN_FROM;
    scrollRef.current.scrollTop = Math.max(0, minuteToTop(target));
  }, [mobileView]);

  const today = new Date();
  const baseWeek = weekOffset === 0
    ? today
    : weekOffset > 0
      ? addWeeks(today, weekOffset)
      : subWeeks(today, Math.abs(weekOffset));

  const weekStart = startOfWeek(baseWeek, { weekStartsOn: 1 }); // Mon
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // Mon–Sat

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  // Pre-compute local date key per booking ONCE (toZonedTime is expensive).
  type Indexed = Row & { _localKey: string; _startMin: number; _endMin: number };
  type LaidOut = Indexed & { laneIndex: number; laneCount: number };
  const indexed = useMemo<Indexed[]>(() => {
    return bookings.map((b) => {
      const localStart = toZonedTime(b.startsAt, APP_TIMEZONE);
      const localEnd = toZonedTime(b.endsAt, APP_TIMEZONE);
      return {
        ...b,
        _localKey: format(localStart, 'yyyy-MM-dd'),
        _startMin: localStart.getHours() * 60 + localStart.getMinutes(),
        _endMin: localEnd.getHours() * 60 + localEnd.getMinutes(),
      };
    });
  }, [bookings]);

  // Group by local day key, plus active counts. Assign adaptive lanes per day so
  // overlapping blocks render side-by-side (50/50, 33/33/33, ...).
  // Cancelled/no-show stay in their own lane (don't push active bookings to half-width)
  // by separating layout: active bookings get lane assignment first, then non-active
  // are appended with laneCount = 1 (full width, below if they overlap visually).
  const byDay = useMemo(() => {
    const map = new Map<string, LaidOut[]>();
    const activeCounts = new Map<string, number>();
    const groups = new Map<string, Indexed[]>();
    for (const b of indexed) {
      const arr = groups.get(b._localKey);
      if (arr) arr.push(b); else groups.set(b._localKey, [b]);
      if (b.status === 'CONFIRMED' || b.status === 'PENDING') {
        activeCounts.set(b._localKey, (activeCounts.get(b._localKey) ?? 0) + 1);
      }
    }
    for (const [key, arr] of groups.entries()) {
      const active = arr.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING');
      const inactive = arr.filter((b) => b.status !== 'CONFIRMED' && b.status !== 'PENDING');
      const laidActive = assignLanes(active);
      const laidInactive: LaidOut[] = inactive.map((b) => ({ ...b, laneIndex: 0, laneCount: 1 }));
      const combined = [...laidActive, ...laidInactive];
      combined.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      map.set(key, combined);
    }
    return { map, activeCounts };
  }, [indexed]);

  return (
    <div className="space-y-2">
      {/* Nav */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)} className="flex-shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0 text-center text-xs font-medium sm:text-sm">
          <span className="block truncate sm:inline">
            {format(weekStart, 'd MMM', { locale: it })} – {format(addDays(weekStart, 5), 'd MMM', { locale: it })}
          </span>
          {weekOffset === 0 && (
            <span className="ml-1 inline-block rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground sm:ml-2 sm:px-2 sm:text-xs">
              Oggi
            </span>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Oggi
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day-by-day list (Settimana view) */}
      <div className={`space-y-2 ${mobileView === 'list' ? 'block' : 'hidden'}`}>
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayBookings = byDay.map.get(dayKey) ?? [];
          return (
            <div
              key={day.toISOString()}
              className={`rounded-lg border bg-white ${isToday ? 'ring-2 ring-primary' : ''}`}
            >
              <div className={`flex items-center justify-between px-3 py-2 border-b ${isToday ? 'bg-accent/30' : 'bg-muted/40'}`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {format(day, 'EEE', { locale: it })}
                  </span>
                  <span className="text-base font-bold">{format(day, 'd MMM', { locale: it })}</span>
                  {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Oggi</span>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {dayBookings.length === 0 ? 'Libero' : `${dayBookings.length} app.`}
                </span>
              </div>
              {dayBookings.length > 0 && (
                <ul className="divide-y">
                  {dayBookings.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(selected?.id === b.id ? null : b)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/40 ${b.status === 'CANCELLED' || b.status === 'NO_SHOW' ? 'opacity-50 line-through' : ''}`}
                      >
                        <span className="font-mono text-xs font-semibold w-12">
                          {`${String(Math.floor(b._startMin / 60)).padStart(2, '0')}:${String(b._startMin % 60).padStart(2, '0')}`}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-medium truncate">{b.customerName || animalLabel(b)}</span>
                          <span className="block text-xs text-muted-foreground truncate">
                            {formatServiceLabel(b)}
                          </span>
                        </span>
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                          b.status === 'CONFIRMED' ? 'bg-emerald-500'
                          : b.status === 'PENDING' ? 'bg-amber-500'
                          : b.status === 'COMPLETED' ? 'bg-gray-400'
                          : 'bg-red-400'
                        }`} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Time-grid calendar (Calendario view) — mobile-first Google Calendar style */}
      <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${mobileView === 'grid' ? 'block' : 'hidden'}`}>
        {/* Scrollable container — header is inside (sticky) so it shares width with the grid */}
        <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
          {/* Sticky day header */}
          <div
            className="sticky top-0 z-20 grid border-b bg-white"
            style={{ gridTemplateColumns: '32px repeat(6, minmax(0, 1fr))' }}
          >
            <div className="border-r" />
            {days.map((day) => {
              const isToday = isSameDay(day, today);
              const dayKey = format(day, 'yyyy-MM-dd');
              const count = byDay.activeCounts.get(dayKey) ?? 0;
              return (
                <div
                  key={day.toISOString()}
                  className={`flex flex-col items-center justify-center gap-0.5 border-r py-1.5 text-center ${isToday ? 'bg-accent/40' : ''}`}
                >
                  <span className="text-[10px] font-medium uppercase leading-none text-muted-foreground">
                    {format(day, 'EEEEE', { locale: it })}
                  </span>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday ? 'bg-primary text-primary-foreground' : ''
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {count > 0 && (
                    <span className="text-[9px] font-semibold leading-none text-primary">
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div
            className="relative grid"
            style={{
              gridTemplateColumns: '32px repeat(6, minmax(0, 1fr))',
              height: `${TOTAL_HOURS * HOUR_HEIGHT_PX}px`,
            }}
          >
            {/* Hour labels */}
            <div className="relative border-r bg-white">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1.5 text-[10px] font-medium leading-none text-muted-foreground"
                  style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT_PX}px` }}
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayBookings = byDay.map.get(dayKey) ?? [];
              const isToday = isSameDay(day, today);

              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r ${isToday ? 'bg-accent/10' : ''}`}
                >
                  {/* Hour lines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-border/40"
                      style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT_PX}px` }}
                    />
                  ))}

                  {/* Opening hours highlight */}
                  <div
                    className="absolute w-full bg-green-50/60"
                    style={{
                      top: `${minuteToTop(OPEN_FROM)}px`,
                      height: `${durationToHeight(OPEN_TO - OPEN_FROM)}px`,
                    }}
                  />

                  {/* Today line */}
                  {isToday && (() => {
                    const now = toZonedTime(new Date(), APP_TIMEZONE);
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (nowMin < START_HOUR * 60 || nowMin > END_HOUR * 60) return null;
                    return (
                      <div
                        className="absolute z-10 w-full border-t-2 border-red-400"
                        style={{ top: `${minuteToTop(nowMin)}px` }}
                      >
                        <div className="h-2 w-2 -translate-y-1 -translate-x-1 rounded-full bg-red-400" />
                      </div>
                    );
                  })()}

                  {/* Bookings */}
                  {dayBookings.map((b) => {
                    const top = minuteToTop(b._startMin);
                    const height = Math.max(durationToHeight(b._endMin - b._startMin), 18);
                    const widthPct = 100 / b.laneCount;
                    const leftPct = b.laneIndex * widthPct;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelected(selected?.id === b.id ? null : b)}
                        className={`absolute flex flex-col justify-center overflow-hidden rounded border border-l-[4px] px-2 py-0.5 text-left leading-tight shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all hover:shadow-md hover:-translate-y-px hover:z-10 ${statusColor[b.status]}`}
                        style={{
                          top: `${top + 1}px`,
                          height: `${Math.max(height - 2, 16)}px`,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                      >
                        <div className="flex items-center gap-1 text-[10px] font-semibold sm:text-[11px]">
                          <span>
                            {`${String(Math.floor(b._startMin / 60)).padStart(2, '0')}:${String(b._startMin % 60).padStart(2, '0')}`}
                          </span>
                          {b.laneCount > 1 && (
                            <span className="rounded-sm bg-slate-200 px-1 text-[8px] font-bold leading-tight text-slate-700">
                              {b.laneIndex + 1}/{b.laneCount}
                            </span>
                          )}
                        </div>
                        {height > 28 && (
                          <div className="truncate text-[10px] font-medium sm:text-[11px]">
                            {b.customerName || animalLabel(b)}
                          </div>
                        )}
                        {height > 50 && (
                          <div className="truncate text-[9px] opacity-75 sm:text-[10px]">
                            {formatServiceLabel(b)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <BookingDetailDialog booking={selected} onClose={() => setSelected(null)} isAdmin={isAdmin} />

      {/* Legend — grid view */}
      <div className={`flex-wrap gap-3 text-xs text-muted-foreground ${mobileView === 'grid' ? 'flex' : 'hidden'}`}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-50 border border-green-200" />
          Orario apertura
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-sm bg-emerald-500" />
          Confermata
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-sm bg-amber-500" />
          In attesa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-sm bg-slate-400" />
          Completata
        </span>
      </div>

      {/* Legend — list view (dot colors) */}
      <div className={`flex-wrap gap-3 text-xs text-muted-foreground ${mobileView === 'list' ? 'flex' : 'hidden'}`}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Confermata
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> In attesa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-gray-400" /> Completata
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Annullata
        </span>
      </div>
    </div>
  );
}
