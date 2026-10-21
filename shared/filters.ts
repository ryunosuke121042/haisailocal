// 絞り込み条件と今日の希望。お店の目安情報を一番上に置く（仕様書01「探す」画面）
import { z } from 'zod';
import { AREAS } from './areas.js';
import { ALLERGENS, BUDGET_BANDS, CATEGORIES, CROWDS, DIET_SUPPORT, OWNER_DISTANCES, REGULARS, RELIGIOUS, SHOP_LANGS, STATION_MAX, YEARS } from './constants.js';

export const FiltersSchema = z.object({
  // お店の目安情報
  crowd: z.array(z.enum(CROWDS)).optional(),
  regulars: z.array(z.enum(REGULARS)).optional(),
  guidebook: z.enum(['none', 'listed']).optional(),
  years: z.array(z.enum(YEARS)).optional(),
  ownerDistance: z.array(z.enum(OWNER_DISTANCES)).optional(),
  stationMax: z
    .number()
    .int()
    .refine((n) => (STATION_MAX as readonly number[]).includes(n))
    .optional(),
  // そのほか
  category: z.array(z.enum(CATEGORIES)).optional(),
  area: z.array(z.enum(AREAS)).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  party: z.number().int().min(1).max(100).optional(),
  budget: z.array(z.enum(BUDGET_BANDS)).optional(),
  dietary: z.array(z.enum(DIET_SUPPORT)).optional(),
  halal: z.boolean().optional(),
  allergens: z.array(z.enum(ALLERGENS)).optional(), // 除きたいアレルギー物質
  adjust: z.array(z.enum(['less', 'remove'])).optional(),
  languages: z.array(z.enum(SHOP_LANGS)).optional(),
  solo: z.boolean().optional(),
});
export type Filters = z.infer<typeof FiltersSchema>;
export type FilterKey = keyof Filters;

export const SORTS = ['recommended', 'newest', 'yearsDesc', 'distance', 'priceAsc'] as const;
export type SortCode = (typeof SORTS)[number];

// 今日の希望（最初の質問）。宗教上の制限とアレルギーは同意した人にだけ聞き、自動で合わない店を除く
export const PrefsSchema = z.object({
  budget: z.enum(BUDGET_BANDS).nullable().optional(),
  dietary: z.array(z.enum(DIET_SUPPORT)).optional(),
  religious: z.array(z.enum(RELIGIOUS)).optional(),
  allergens: z.array(z.enum(ALLERGENS)).optional(),
});
export type Prefs = z.infer<typeof PrefsSchema>;

export function activeKeys(f: Filters): FilterKey[] {
  return (Object.keys(f) as FilterKey[]).filter((k) => {
    const v = f[k];
    if (v === undefined || v === null || v === '' || v === false) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return k !== 'time'; // 時刻は日付と一緒に扱う
  });
}

export function withoutKey(f: Filters, k: FilterKey): Filters {
  const n = { ...f };
  delete n[k];
  if (k === 'date') delete n.time;
  return n;
}

/** URL のクエリ ⇔ 絞り込み条件（一覧のURLを共有・再読み込みできるように）。不正な値は捨てる */
export function filtersToQuery(f: Filters): string {
  const q = new URLSearchParams();
  for (const k of [...activeKeys(f), ...(f.time && f.date ? (['time'] as const) : [])]) {
    const v = f[k];
    q.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return q.toString();
}

const ARRAY_KEYS = ['crowd', 'regulars', 'years', 'ownerDistance', 'category', 'area', 'budget', 'dietary', 'allergens', 'adjust', 'languages'] as const;

export function filtersFromQuery(q: URLSearchParams): Filters {
  const out: Filters = {};
  const tryKey = (k: FilterKey, v: unknown) => {
    const r = FiltersSchema.shape[k].safeParse(v);
    if (r.success && r.data !== undefined) (out as Record<string, unknown>)[k] = r.data;
  };
  for (const k of ARRAY_KEYS) {
    const v = q.get(k);
    if (v) tryKey(k, v.split(',').filter(Boolean));
  }
  for (const k of ['guidebook', 'date', 'time'] as const) if (q.get(k)) tryKey(k, q.get(k));
  for (const k of ['stationMax', 'party'] as const) if (q.get(k)) tryKey(k, Number(q.get(k)));
  for (const k of ['halal', 'solo'] as const) if (q.get(k) === 'true') tryKey(k, true);
  if (!out.date) delete out.time;
  return out;
}
