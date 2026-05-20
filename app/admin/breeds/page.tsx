import { getAllBreedsAdmin, getBreedsMissingPrices } from '@/lib/breeds-server';
import { BreedsManager } from '@/components/admin/BreedsManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Razze' };

export default async function AdminBreedsPage() {
  const [breeds, missingByBreed] = await Promise.all([
    getAllBreedsAdmin(),
    getBreedsMissingPrices(),
  ]);
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Razze & prezzi</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Gestisci le razze proposte ai clienti e i prezzi di lavaggio.
        </p>
      </div>
      <BreedsManager breeds={breeds} missingByBreed={missingByBreed} />
    </div>
  );
}
