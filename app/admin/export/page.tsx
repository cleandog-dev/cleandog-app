import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Export' };

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Export</h1>
        <p className="text-sm text-muted-foreground">Esporta le prenotazioni in CSV.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tutte le prenotazioni</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <a href="/admin/export/csv?range=upcoming">Future (CSV)</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/admin/export/csv?range=all">Tutte (CSV)</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/admin/export/csv?range=past">Passate (CSV)</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
