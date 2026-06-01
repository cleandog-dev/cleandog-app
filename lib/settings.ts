import { prisma } from '@/lib/db';

const DEFAULT_SLOT_STEP = 30;
export const DEFAULT_MAX_CONCURRENT = 1;
export const MAX_CONCURRENT_LIMIT = 10;

export async function getSlotStepMin(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'slot_step_min' } });
  if (!s) return DEFAULT_SLOT_STEP;
  const n = parseInt(s.value, 10);
  return Number.isInteger(n) && n >= 5 && n <= 120 ? n : DEFAULT_SLOT_STEP;
}

export async function getMaxConcurrentBookings(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'max_concurrent_bookings' } });
  if (!s) return DEFAULT_MAX_CONCURRENT;
  const n = parseInt(s.value, 10);
  return Number.isInteger(n) && n >= 1 && n <= MAX_CONCURRENT_LIMIT ? n : DEFAULT_MAX_CONCURRENT;
}
