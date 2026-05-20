'use client';

import { useState, useTransition } from 'react';
import type { Extra } from '@prisma/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { upsertExtraAction, deleteExtraAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { formatEUR } from '@/lib/utils';
import { NumericInput } from '@/components/ui/numeric-input';

type Draft = {
  name: string;
  priceCents: number;
  dogOnly: boolean;
  active: boolean;
  sortOrder: number;
};

const empty: Draft = {
  name: '',
  priceCents: 200,
  dogOnly: false,
  active: true,
  sortOrder: 0,
};

export function ExtrasManager({ extras }: { extras: Extra[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Extra | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Extra | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function openNew() {
    setEditing(null);
    setDraft(empty);
    setOpen(true);
  }

  function openEdit(e: Extra) {
    setEditing(e);
    setDraft({
      name: e.name,
      priceCents: e.priceCents,
      dogOnly: e.dogOnly,
      active: e.active,
      sortOrder: e.sortOrder,
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const r = await upsertExtraAction(editing?.id ?? null, draft);
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      toast({ title: editing ? 'Extra aggiornato' : 'Extra creato' });
      setOpen(false);
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openNew} size="sm">+ Nuovo extra</Button>
      </div>

      <div className="grid gap-2">
        {extras.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nessun extra configurato.
            </CardContent>
          </Card>
        ) : (
          extras.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{e.name}</h3>
                    {!e.active && <Badge variant="outline">Disattivo</Badge>}
                    {e.dogOnly && <Badge variant="secondary">Solo cani</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    +{formatEUR(e.priceCents)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(e)}>
                    Modifica
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget(e)}
                  >
                    🗑
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>Elimina extra</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per eliminare <span className="font-semibold text-foreground">{deleteTarget?.name}</span>.
            Le prenotazioni passate non sono toccate. Continuare?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annulla</Button>
            <Button
              disabled={pending}
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                if (!deleteTarget) return;
                const target = deleteTarget;
                setDeleteTarget(null);
                startTransition(async () => {
                  const r = await deleteExtraAction(target.id);
                  if (!r.ok) toast({ title: 'Errore', description: r.error, variant: 'destructive' });
                  else toast({ title: 'Extra eliminato', description: target.name });
                });
              }}
            >
              {pending ? 'Elimino…' : 'Elimina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica extra' : 'Nuovo extra'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prezzo (€)</Label>
                <NumericInput
                  value={draft.priceCents > 0 ? draft.priceCents / 100 : null}
                  allowDecimal
                  placeholder="0"
                  onChange={(n) =>
                    setDraft({ ...draft, priceCents: n == null ? 0 : Math.round(n * 100) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ordine</Label>
                <NumericInput
                  value={draft.sortOrder > 0 ? draft.sortOrder : null}
                  placeholder="0"
                  onChange={(n) => setDraft({ ...draft, sortOrder: n ?? 0 })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.dogOnly}
                onChange={(e) => setDraft({ ...draft, dogOnly: e.target.checked })}
              />
              Visibile solo per cani
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Attivo (visibile ai clienti)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={pending}>
              {pending ? 'Salvo…' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
