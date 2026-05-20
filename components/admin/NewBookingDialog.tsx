'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import type { Service } from '@prisma/client';
import { format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { adminCreateBookingAction, getDayOverviewAction, type DaySlot } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { APP_TIMEZONE } from '@/lib/utils';
import type { BreedEntry } from '@/lib/breeds';

type Draft = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  dogName: string;
  animalType: 'DOG' | 'CAT';
  dogBreed: string;
  serviceId: string;
  startsAt: string;
  notes: string;
  coatChoice: '' | 'SHORT' | 'LONG';
};

const emptyDraft = (): Draft => ({
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  dogName: '',
  animalType: 'DOG',
  dogBreed: '',
  serviceId: '',
  startsAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  notes: '',
  coatChoice: '',
});

export function NewBookingDialog({
  services,
  breeds,
}: {
  services: Service[];
  breeds: BreedEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const filteredServices = useMemo(
    () => services.filter((s) => s.forAnimal === draft.animalType && s.active),
    [services, draft.animalType],
  );
  const filteredBreeds = useMemo(
    () => breeds.filter((b) => b.animalType === draft.animalType),
    [breeds, draft.animalType],
  );

  const selectedBreed = breeds.find((b) => b.name === draft.dogBreed) ?? null;
  const showCoatPicker = selectedBreed?.coatType === 'MIXED';

  const [warning, setWarning] = useState<'OVERLAP' | 'CLOSED' | null>(null);
  const [slots, setSlots] = useState<DaySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const dateOnly = draft.startsAt.split('T')[0];
  const timeOnly = draft.startsAt.split('T')[1]?.slice(0, 5) || '';

  useEffect(() => {
    if (!draft.serviceId || !dateOnly) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    getDayOverviewAction({ serviceId: draft.serviceId, date: dateOnly })
      .then((r) => {
        if (cancelled) return;
        setSlots(r.ok ? r.data : []);
      })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [draft.serviceId, dateOnly]);

  function reset() {
    setDraft(emptyDraft());
    setWarning(null);
    setSlots([]);
  }

  async function submit(force = false) {
    startTransition(async () => {
      const utcISO = fromZonedTime(draft.startsAt, APP_TIMEZONE).toISOString();
      const r = await adminCreateBookingAction({
        ...draft,
        dogBreed: draft.dogBreed,
        coatChoice: showCoatPicker ? (draft.coatChoice || undefined) : undefined,
        startsAt: utcISO,
        forceOverlap: force,
      });
      if (!r.ok) {
        if (r.error === 'OVERLAP' || r.error === 'CLOSED') {
          setWarning(r.error);
          return;
        }
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Prenotazione creata' });
      setOpen(false);
      reset();
    });
  }

  return (
    <>
      <Button onClick={() => { reset(); setOpen(true); }} size="sm">
        + Nuova prenotazione
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuova prenotazione</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome cliente</Label>
                <Input value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefono</Label>
                <Input value={draft.customerPhone} onChange={(e) => setDraft({ ...draft, customerPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Animale</Label>
                <select
                  value={draft.animalType}
                  onChange={(e) => setDraft({ ...draft, animalType: e.target.value as 'DOG' | 'CAT', dogBreed: '', serviceId: '', coatChoice: '' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="DOG">Cane</option>
                  <option value="CAT">Gatto</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Nome animale <span className="text-xs font-normal text-muted-foreground">(opzionale)</span></Label>
                <Input value={draft.dogName} onChange={(e) => setDraft({ ...draft, dogName: e.target.value })} />
              </div>
            </div>

            <BreedPicker
              breeds={filteredBreeds}
              value={draft.dogBreed}
              onChange={(name) => setDraft({ ...draft, dogBreed: name, coatChoice: '' })}
              animalLabel={draft.animalType === 'CAT' ? 'gatto' : 'cane'}
            />

            <div className="space-y-1.5">
              <Label>Servizio</Label>
              <select
                value={draft.serviceId}
                onChange={(e) => setDraft({ ...draft, serviceId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Seleziona —</option>
                {filteredServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {showCoatPicker && (
              <div className="space-y-1.5">
                <Label>Tipo di pelo (Meticcio)</Label>
                <select
                  value={draft.coatChoice}
                  onChange={(e) => setDraft({ ...draft, coatChoice: e.target.value as Draft['coatChoice'] })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Seleziona —</option>
                  <option value="SHORT">Pelo corto</option>
                  <option value="LONG">Pelo lungo</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={dateOnly}
                onChange={(e) => {
                  const time = timeOnly || '09:00';
                  setDraft({ ...draft, startsAt: `${e.target.value}T${time}` });
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Orario {draft.serviceId ? '' : <span className="text-xs font-normal text-muted-foreground">(scegli prima il servizio)</span>}</Label>
              {!draft.serviceId ? (
                <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  Seleziona servizio per vedere gli orari
                </div>
              ) : slotsLoading ? (
                <p className="text-xs text-muted-foreground">Carico orari…</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {slots.filter((s) => s.status !== 'outside').map((s) => {
                      const isSel = timeOnly === s.time;
                      const isBusy = s.status === 'busy';
                      const isClosed = s.status === 'closed';
                      const cls = isSel
                        ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30'
                        : isBusy
                          ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                          : isClosed
                            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100';
                      return (
                        <button
                          key={s.time}
                          type="button"
                          title={isBusy ? `Occupato: ${s.busyWith}` : isClosed ? 'Chiuso' : 'Libero'}
                          onClick={() => setDraft({ ...draft, startsAt: `${dateOnly}T${s.time}` })}
                          className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${cls}`}
                        >
                          {s.time}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm bg-emerald-300" /> libero
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm bg-red-300" /> occupato
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm bg-amber-300" /> chiuso
                    </span>
                  </div>
                  {(() => {
                    const selected = slots.find((s) => s.time === timeOnly);
                    if (!selected) return null;
                    if (selected.status === 'busy') {
                      return (
                        <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
                          ⚠ Slot occupato da <strong>{selected.busyWith}</strong>. Sarà richiesta conferma "Forza creazione" al salvataggio.
                        </div>
                      );
                    }
                    if (selected.status === 'closed') {
                      return (
                        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                          ⚠ Negozio chiuso. Sarà richiesta conferma "Forza creazione" al salvataggio.
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Note (opzionale)</Label>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            {warning && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-800">
                  {warning === 'CLOSED' ? 'Negozio chiuso' : 'Sovrapposizione orari'}
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  {warning === 'CLOSED'
                    ? 'In quella fascia c\'è una chiusura attiva. Forzare comunque?'
                    : 'Esiste già una prenotazione in quella fascia. Forzare comunque?'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={pending}
                  onClick={() => submit(true)}
                >
                  Forza creazione
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={() => submit(false)} disabled={pending}>
              {pending ? 'Salvo…' : 'Crea prenotazione'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BreedPicker({
  breeds,
  value,
  onChange,
  animalLabel = 'cane',
}: {
  breeds: BreedEntry[];
  value: string;
  onChange: (name: string) => void;
  animalLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = breeds.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-1.5">
      <Label>Razza ({animalLabel})</Label>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between h-10"
        onClick={() => { setSearch(''); setOpen(true); }}
      >
        <span className={value ? '' : 'text-muted-foreground'}>
          {value || '— Seleziona —'}
        </span>
        <span className="text-muted-foreground">▾</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-3 pb-2 border-b">
            <DialogTitle className="text-base">Seleziona razza</DialogTitle>
            <Input
              autoFocus
              placeholder="Cerca…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 mt-2"
            />
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Nessuna razza trovata.</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => { onChange(b.name); setOpen(false); }}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-accent/40 ${
                        value === b.name ? 'bg-sage-100 font-semibold' : ''
                      }`}
                      style={value === b.name ? { background: 'var(--sage-100)' } : undefined}
                    >
                      <span>{b.name}</span>
                      {value === b.name && <span className="text-sage-800">✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
