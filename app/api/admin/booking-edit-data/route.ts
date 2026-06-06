import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAllBreedsAdmin, getPricesMapForAnimal } from '@/lib/breeds-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== 'ADMIN' && role !== 'STAFF') {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const [services, breeds, extras, dogPrices, catPrices] = await Promise.all([
      prisma.service.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
      getAllBreedsAdmin(),
      prisma.extra.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      getPricesMapForAnimal('DOG'),
      getPricesMapForAnimal('CAT'),
    ]);
    return NextResponse.json({
      ok: true,
      data: {
        services,
        breeds,
        extras,
        pricesByAnimal: { DOG: dogPrices, CAT: catPrices },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Errore interno';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
