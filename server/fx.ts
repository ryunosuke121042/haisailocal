// 為替レート（目安）。1日1回取得し、失敗したら最後に取得したレートと取得日時を返す
import { CURRENCIES } from '../shared/constants.js';
import { prisma } from './db.js';

// ECB の参照レートには TWD がないため、TWD を含む ExchangeRate-API の無料版を使う
const SOURCE = 'ExchangeRate-API (open.er-api.com)';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface FxRates {
  rates: Record<string, number>; // 1円あたり
  fetchedAt: string | null;
  source: string;
  stale: boolean;
}

export async function getRates(): Promise<FxRates> {
  const row = await prisma.exchangeRate.findUnique({ where: { id: 'latest' } });
  if (row && Date.now() - row.fetchedAt.getTime() < MAX_AGE_MS) {
    return { rates: row.rates as Record<string, number>, fetchedAt: row.fetchedAt.toISOString(), source: row.source, stale: false };
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`fx ${res.status}`);
    const json = (await res.json()) as { result: string; rates: Record<string, number> };
    if (json.result !== 'success') throw new Error('fx result');
    const rates: Record<string, number> = { JPY: 1 };
    for (const c of CURRENCIES) if (typeof json.rates[c] === 'number') rates[c] = json.rates[c];
    const saved = await prisma.exchangeRate.upsert({
      where: { id: 'latest' },
      create: { id: 'latest', rates, source: SOURCE, fetchedAt: new Date() },
      update: { rates, source: SOURCE, fetchedAt: new Date() },
    });
    return { rates, fetchedAt: saved.fetchedAt.toISOString(), source: SOURCE, stale: false };
  } catch (e) {
    console.error('fx fetch failed', e);
    if (row) return { rates: row.rates as Record<string, number>, fetchedAt: row.fetchedAt.toISOString(), source: row.source, stale: true };
    return { rates: { JPY: 1 }, fetchedAt: null, source: SOURCE, stale: true };
  }
}
