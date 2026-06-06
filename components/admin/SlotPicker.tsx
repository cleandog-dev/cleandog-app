'use client';

import type { DaySlot } from '@/lib/actions';

/**
 * Unified slot/time picker used in any admin flow that lets you pick a time
 * (new booking, edit booking, etc).
 *
 * Visual rules:
 *   - emerald  = libero
 *   - red      = pieno (capacity raggiunta)
 *   - amber    = chiuso (closure attiva)
 *   - selected = pillola primary con ring
 *   - badge `x/N` se capacity > 1 e c'è almeno un occupante
 *
 * "Self" slot: in edit mode the original time of the booking being moved
 * counts as free (not as busy by itself). Pass `selfTime` for that slot's HH:mm
 * and `selfActive=true` only when the displayed date matches the original date.
 */
export function SlotPicker({
  slots,
  loading,
  selectedTime,
  onSelectTime,
  selfTime,
  selfActive,
  hint,
}: {
  slots: DaySlot[];
  loading: boolean;
  selectedTime: string;
  onSelectTime: (time: string) => void;
  selfTime?: string;
  selfActive?: boolean;
  hint?: React.ReactNode;
}) {
  if (loading) {
    return <p className="text-xs text-muted-foreground">Carico orari…</p>;
  }
  const visible = slots.filter((s) => s.status !== 'outside');
  if (visible.length === 0) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-center text-xs text-amber-800">
        Negozio chiuso in questo giorno. Cambia data o controlla gli orari in Impostazioni.
      </div>
    );
  }

  const selectedSlot = visible.find((s) => s.time === selectedTime) ?? null;

  return (
    <>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {visible.map((s) => {
          const isSel = selectedTime === s.time;
          const isSelf = !!selfActive && !!selfTime && s.time === selfTime;
          const effectiveStatus = isSelf ? 'free' : s.status;
          const isBusy = effectiveStatus === 'busy';
          const isClosed = effectiveStatus === 'closed';
          const capacity = s.capacity ?? 1;
          const busyCount = s.busyCount ?? 0;
          const showBadge = capacity > 1 && (busyCount > 0 || isBusy) && !isSelf;
          const cls = isSel
            ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30'
            : isBusy
              ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
              : isClosed
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100';
          const title = isSelf
            ? 'Orario attuale'
            : isBusy
              ? `Pieno (${busyCount}/${capacity}): ${s.busyWith ?? ''}`
              : isClosed
                ? 'Chiuso'
                : busyCount > 0
                  ? `Libero (${busyCount}/${capacity} occupati): ${s.busyWith ?? ''}`
                  : 'Libero';
          return (
            <button
              key={s.time}
              type="button"
              title={title}
              onClick={() => onSelectTime(s.time)}
              className={`relative rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${cls}`}
            >
              {s.time}
              {showBadge && (
                <span
                  className={`absolute -right-1 -top-1 rounded-full px-1 text-[9px] font-bold leading-tight ${
                    isBusy ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {busyCount}/{capacity}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-300" /> libero
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-300" /> pieno
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-300" /> chiuso
        </span>
      </div>

      {hint}

      <SelectedSlotNotice selected={selectedSlot} isSelf={!!selectedSlot && !!selfActive && selectedSlot.time === selfTime} />
    </>
  );
}

function SelectedSlotNotice({ selected, isSelf }: { selected: DaySlot | null; isSelf: boolean }) {
  if (!selected || isSelf) return null;
  const cap = selected.capacity ?? 1;
  const bc = selected.busyCount ?? 0;
  if (selected.status === 'busy') {
    return (
      <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
        ⚠ Slot pieno ({bc}/{cap}): <strong>{selected.busyWith}</strong>. Sarà richiesta conferma &quot;Forza creazione&quot; al salvataggio.
      </div>
    );
  }
  if (selected.status === 'closed') {
    return (
      <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
        ⚠ Negozio chiuso. Sarà richiesta conferma &quot;Forza creazione&quot; al salvataggio.
      </div>
    );
  }
  if (bc > 0 && cap > 1) {
    return (
      <div className="mt-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800">
        ✓ Slot disponibile ({bc}/{cap} occupati): <strong>{selected.busyWith}</strong>. Postazione libera ancora prenotabile.
      </div>
    );
  }
  return null;
}
