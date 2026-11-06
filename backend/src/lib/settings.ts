import { prisma } from './prisma';
import { env } from '../config/env';

let cache: { at: number; values: Record<string, unknown> } | null = null;

export async function getSettings() {
  if (cache && Date.now() - cache.at < 60_000) return cache.values;
  const rows = await prisma.platformSetting.findMany();
  const values: Record<string, unknown> = {
    commissionPercent: env.PLATFORM_COMMISSION_PERCENT,
    trialDiscountPercent: 50,
    autoCancelUnpaidMinutes: 30,
    earningHoldHours: 24,
    minPayoutAmount: 100000,
  };
  for (const r of rows) values[r.key] = r.value;
  cache = { at: Date.now(), values };
  return values;
}

export function invalidateSettings() {
  cache = null;
}

export async function commissionPercent() {
  return Number((await getSettings()).commissionPercent);
}
