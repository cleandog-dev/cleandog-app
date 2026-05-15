import { prisma } from '@/lib/db';

const DEFAULT_SLOT_STEP = 30;

export async function getSlotStepMin(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'slot_step_min' } });
  if (!s) return DEFAULT_SLOT_STEP;
  const n = parseInt(s.value, 10);
  return Number.isInteger(n) && n >= 5 && n <= 120 ? n : DEFAULT_SLOT_STEP;
}
