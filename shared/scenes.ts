// 一覧の上に並べる「よく使う条件」。タップすると、その条件を今の絞り込みに足す（もう一度タップで外す）
import type { Filters } from './filters.js';

export const SCENES = [
  { id: 'locals', filters: { crowd: ['LOCAL'] } },
  { id: 'today', filters: { date: '__today' } },
  { id: 'teaUji', filters: { category: ['EXPERIENCE'], area: ['uji'] } },
  { id: 'dinner', filters: { category: ['RESTAURANT'], crowd: ['LOCAL'] } },
  { id: 'solo', filters: { solo: true } },
  { id: 'oldShop', filters: { years: ['OVER_30'] } },
  { id: 'hidden', filters: { guidebook: 'none' } },
  { id: 'nearStation', filters: { stationMax: 10 } },
  { id: 'cheap', filters: { budget: ['UNDER_3000', 'FROM_3000_TO_5000'] } },
  { id: 'veg', filters: { dietary: ['vegetarian'] } },
  { id: 'halal', filters: { halal: true } },
  { id: 'english', filters: { languages: ['en'] } },
] as const satisfies readonly { id: string; filters: Filters }[];

export type SceneId = (typeof SCENES)[number]['id'];

/** 「今日」などの日付を実際の日付にする */
export function sceneFilters(scene: (typeof SCENES)[number], today: string): Filters {
  const f = { ...scene.filters } as Filters;
  if (f.date === '__today') f.date = today;
  return f;
}

/** その条件が今の絞り込みに含まれているか（チップを押した状態で見せる） */
export function sceneActive(current: Filters, f: Filters): boolean {
  return (Object.keys(f) as (keyof Filters)[]).every((k) => {
    const want = f[k];
    const have = current[k];
    if (Array.isArray(want)) return Array.isArray(have) && want.every((v) => (have as string[]).includes(v));
    return have === want;
  });
}

/** 条件を足す（配列はまとめる） */
export function addFilters(current: Filters, f: Filters): Filters {
  const out: Filters = { ...current };
  for (const [k, v] of Object.entries(f) as [keyof Filters, unknown][]) {
    const prev = out[k];
    (out as Record<string, unknown>)[k] = Array.isArray(prev) && Array.isArray(v) ? [...new Set([...prev, ...v])] : v;
  }
  return out;
}

/** 条件を外す（配列はその値だけ外す） */
export function removeFilters(current: Filters, f: Filters): Filters {
  const out: Filters = { ...current };
  for (const [k, v] of Object.entries(f) as [keyof Filters, unknown][]) {
    const prev = out[k];
    if (Array.isArray(prev) && Array.isArray(v)) {
      const rest = (prev as string[]).filter((x) => !(v as string[]).includes(x));
      (out as Record<string, unknown>)[k] = rest.length ? rest : undefined;
    } else delete out[k];
    if (k === 'date') delete out.time;
  }
  return JSON.parse(JSON.stringify(out)) as Filters;
}
