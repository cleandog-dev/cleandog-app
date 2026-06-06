'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  createStaffUserAction,
  resetStaffPasswordAction,
  deleteStaffUserAction,
  type StaffUserRow,
} from '@/lib/actions';

type Props = {
  initialUsers: StaffUserRow[];
};

export function StaffAccountsManager({ initialUsers }: Props) {
  const [users, setUsers] = useState<StaffUserRow[]>(initialUsers);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  // Dialog "Aggiungi staff"
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');

  // Dialog rivelazione password (one-shot)
  const [revealPassword, setRevealPassword] = useState<{
    password: string;
    email: string;
    title: string;
  } | null>(null);
  const [confirmedSaved, setConfirmedSaved] = useState(false);

  // Dialog conferma elimina
  const [deleteTarget, setDeleteTarget] = useState<StaffUserRow | null>(null);

  function onCreate() {
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    if (!email || !name) {
      toast({ title: 'Compila email e nome', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const r = await createStaffUserAction({ email, name });
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      setUsers((prev) => [r.data.user, ...prev]);
      setCreateOpen(false);
      setNewEmail('');
      setNewName('');
      setRevealPassword({
        password: r.data.password,
        email: r.data.user.email,
        title: 'Account creato',
      });
      setConfirmedSaved(false);
    });
  }

  function onReset(u: StaffUserRow) {
    startTransition(async () => {
      const r = await resetStaffPasswordAction(u.id);
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      setRevealPassword({
        password: r.data.password,
        email: u.email,
        title: 'Nuova password generata',
      });
      setConfirmedSaved(false);
    });
  }

  function onDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const r = await deleteStaffUserAction(target.id);
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      setDeleteTarget(null);
      toast({ title: 'Account eliminato' });
    });
  }

  function copyPassword() {
    if (!revealPassword) return;
    navigator.clipboard.writeText(revealPassword.password).then(
      () => toast({ title: 'Password copiata' }),
      () => toast({ title: 'Copia fallita', variant: 'destructive' }),
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Account staff</h2>
            <p className="text-xs text-muted-foreground">
              Crea account di accesso per i tuoi dipendenti. Vedranno solo Prenotazioni e Personale.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} disabled={pending}>
            + Aggiungi staff
          </Button>
        </div>

        {users.length === 0 ? (
          <p className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Nessun account staff. Premi <strong>+ Aggiungi staff</strong> per crearne uno.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Creato</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2">{u.name || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => onReset(u)}
                        >
                          Reset password
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => setDeleteTarget(u)}
                        >
                          Elimina
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={(o) => !pending && setCreateOpen(o)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuovo account staff</DialogTitle>
              <DialogDescription>
                La password verrà generata automaticamente e mostrata una sola volta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="staff-name">Nome</Label>
                <Input
                  id="staff-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Mario Rossi"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="mario@cleandog.it"
                  autoComplete="off"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={pending}>
                Annulla
              </Button>
              <Button onClick={onCreate} disabled={pending}>
                Crea account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reveal password dialog (one-shot) */}
        <Dialog
          open={!!revealPassword}
          onOpenChange={(o) => {
            if (o) return;
            if (!confirmedSaved) {
              toast({ title: 'Conferma di aver copiato la password prima di chiudere', variant: 'destructive' });
              return;
            }
            setRevealPassword(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{revealPassword?.title}</DialogTitle>
              <DialogDescription>
                Account per <strong>{revealPassword?.email}</strong>. Copia ora la password — non sarà più visibile.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/40 p-3">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Password (16 caratteri)
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    readOnly
                    value={revealPassword?.password ?? ''}
                    className="flex-1 font-mono text-sm"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button variant="outline" size="sm" onClick={copyPassword}>
                    Copia
                  </Button>
                </div>
              </div>
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                ⚠️ Salva ora questa password (gestore password, foglio sicuro o messaggio al dipendente).
                Se la perdi puoi solo generarne una nuova con &quot;Reset password&quot;.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmedSaved}
                  onChange={(e) => setConfirmedSaved(e.target.checked)}
                />
                Ho salvato la password.
              </label>
            </div>
            <DialogFooter>
              <Button
                onClick={() => setRevealPassword(null)}
                disabled={!confirmedSaved}
              >
                Chiudi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(o) => !pending && !o && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Elimina account staff?</DialogTitle>
              <DialogDescription>
                Stai per eliminare <strong>{deleteTarget?.email}</strong>. L&apos;accesso verrà revocato immediatamente.
                Azione non reversibile.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pending}>
                Annulla
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={pending}>
                Elimina
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
