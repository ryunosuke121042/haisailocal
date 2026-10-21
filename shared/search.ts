// 絞り込みとおすすめ（仕様書01「おすすめの仕組み（ルールベース）」）。DBに依存しない純粋な関数
import { distanceKm } from './areas.js';
import type { SlotState } from './booking.js';
import { budgetBandOf, type Allergen, type BudgetBandCode } from './constants.js';
import { activeKeys, withoutKey, type FilterKey, type Filters, type Prefs, type SortCode } from './filters.js';

export interface SearchListing {
  id: string;
  category: string | null;
  area: string;
  lat: number | null;
  lng: number | null;
  priceJpy: number | null;
  languages: string[];
  soloWelcome: boolean;
  halalCertified: boolean;
  porkFreeMention: boolean;
  dietSupport: string[];
  allergenFreeShop: string[];
  dishes: { allergens: string[] }[];
  adjustLess: boolean;
  adjustRemove: boolean;
  crowd: string | null;
  regulars: string | null;
  guidebook: boolean | null;
  yearsBand: string | null;
  ownerDistance: string | null;
  stationMinutes: number | null;
  minParticipants: number;
  /** 時間枠ごとの上限人数の最大（時間枠がなければ予約不可＝チャットのみ） */
  capacityMax: number | null;
  publishedAt: number;
  ratingAvg: number | null;
  ratingCount: number;
  /** 日付で絞り込んだときの、その日の枠の状態（サーバーで計算して渡す） */
  daySlots?: SlotState[];
}

export interface SearchInput {
  filters: Filters;
  prefs?: Prefs;
  here?: { lat: number; lng: number };
  sort?: SortCode;
}

export type HalalGroup = 'certified' | 'reference';

export interface SearchHit {
  id: string;
  /** 当てはまった条件（画面で「客層ほぼ地元・ベジ対応」のように一言で示す） */
  reasons: string[];
  distanceKm: number | null;
  isNew: boolean;
  halalGroup?: HalalGroup;
  /** アレルギーで絞ったが、お店全体では使っている（一部の料理で使われていないだけ） */
  allergenPartial: boolean;
}

/** 選んだアレルギー物質を使わない料理があるか。お店全体で使っていなければ partial=false */
export function allergenMatch(l: Pick<SearchListing, 'allergenFreeShop' | 'dishes'>, selected: readonly Allergen[] | readonly string[]) {
  if (!selected.length) return { ok: true, partial: false };
  if (selected.every((a) => l.allergenFreeShop.includes(a))) return { ok: true, partial: false };
  const ok = l.dishes.some((d) => selected.every((a) => !d.allergens.includes(a) || l.allergenFreeShop.includes(a)));
  return { ok, partial: ok };
}

/** 宗教上の制限に合うか。ハラルは認証店を「certified」、豚肉不使用をうたう店を「reference」とする */
export function religiousMatch(l: SearchListing, religious: readonly string[]): { ok: boolean; halalGroup?: HalalGroup } {
  let halalGroup: HalalGroup | undefined;
  for (const r of religious) {
    switch (r) {
      case 'halal':
        if (l.halalCertified) halalGroup = 'certified';
        else if (l.porkFreeMention) halalGroup = 'reference';
        else return { ok: false };
        break;
      case 'noPork':
        if (!(l.halalCertified || l.porkFreeMention || l.dietSupport.includes('noPork'))) return { ok: false };
        break;
      case 'noBeef':
        if (!l.dietSupport.includes('noBeef')) return { ok: false };
        break;
      case 'vegetarian':
        if (!(l.dietSupport.includes('vegetarian') || l.dietSupport.includes('vegan'))) return { ok: false };
        break;
      case 'noAlcohol':
        if (!(l.halalCertified || l.dietSupport.includes('noAlcohol'))) return { ok: false };
        break;
    }
  }
  return { ok: true, halalGroup };
}

interface Evaluated {
  l: SearchListing;
  hit: SearchHit;
}

const has = <T>(arr: readonly T[] | undefined): arr is readonly T[] => !!arr && arr.length > 0;

function evaluate(l: SearchListing, input: SearchInput): Evaluated | null {
  const f = input.filters;
  const reasons: string[] = [];

  // お店の目安情報
  if (has(f.crowd)) {
    if (!l.crowd || !f.crowd.includes(l.crowd as never)) return null;
    reasons.push(`crowd:${l.crowd}`);
  }
  if (has(f.regulars)) {
    if (!l.regulars || !f.regulars.includes(l.regulars as never)) return null;
    reasons.push(`regulars:${l.regulars}`);
  }
  if (f.guidebook) {
    if (l.guidebook === null || (f.guidebook === 'none') !== !l.guidebook) return null;
    reasons.push(`guidebook:${f.guidebook}`);
  }
  if (has(f.years)) {
    if (!l.yearsBand || !f.years.includes(l.yearsBand as never)) return null;
    reasons.push(`years:${l.yearsBand}`);
  }
  if (has(f.ownerDistance)) {
    if (!l.ownerDistance || !f.ownerDistance.includes(l.ownerDistance as never)) return null;
    reasons.push(`owner:${l.ownerDistance}`);
  }
  if (f.stationMax != null) {
    if (l.stationMinutes == null || l.stationMinutes > f.stationMax) return null;
    reasons.push(`station:${l.stationMinutes}`);
  }
  // カテゴリ・エリア
  if (has(f.category) && (!l.category || !f.category.includes(l.category as never))) return null;
  if (has(f.area) && !f.area.includes(l.area as never)) return null;
  // 日時の空き：予約できない店（時間枠なし）と、締切後・満席の店は出さない
  const party = f.party ?? 1;
  if (f.party != null) {
    if (l.capacityMax == null) return null;
    if (f.party > l.capacityMax || f.party < l.minParticipants) return null;
  }
  if (f.date) {
    const slots = (l.daySlots ?? []).filter((s) => s.open && s.remaining >= party && (!f.time || s.time === f.time));
    if (!slots.length) return null;
    reasons.push('avail');
  }
  if (has(f.budget) && (l.priceJpy == null || !f.budget.includes(budgetBandOf(l.priceJpy)))) return null;
  if (has(f.dietary)) {
    for (const d of f.dietary) if (!l.dietSupport.includes(d)) return null;
    reasons.push(...f.dietary.map((d) => `dietary:${d}`));
  }
  if (f.halal) {
    if (!l.halalCertified) return null;
    reasons.push('halal');
  }
  if (has(f.adjust)) {
    if (f.adjust.includes('less') && !l.adjustLess) return null;
    if (f.adjust.includes('remove') && !l.adjustRemove) return null;
    reasons.push(...f.adjust.map((a) => `adjust:${a}`));
  }
  if (has(f.languages)) {
    const hit = f.languages.filter((x) => l.languages.includes(x));
    if (!hit.length) return null;
    reasons.push(...hit.map((x) => `lang:${x}`));
  }
  if (f.solo) {
    if (!l.soloWelcome) return null;
    reasons.push('solo');
  }

  // 最初の質問の宗教上の制限・アレルギーは、自動で絞り込み条件にする
  let halalGroup: HalalGroup | undefined;
  const religious = input.prefs?.religious ?? [];
  if (religious.length) {
    const r = religiousMatch(l, religious);
    if (!r.ok) return null;
    halalGroup = r.halalGroup;
    if (halalGroup === 'certified') reasons.push('halal');
    if (halalGroup === 'reference') reasons.push('porkFree');
  }
  const allergens = [...new Set([...(f.allergens ?? []), ...(input.prefs?.allergens ?? [])])];
  let allergenPartial = false;
  if (allergens.length) {
    const m = allergenMatch(l, allergens);
    if (!m.ok) return null;
    allergenPartial = m.partial;
    reasons.push(m.partial ? 'allergen:partial' : 'allergen:shop');
  }

  // 目安情報は、条件にしていなくても理由として一言添える
  if (!has(f.crowd) && l.crowd === 'LOCAL') reasons.unshift('crowd:LOCAL');
  if (!has(f.years) && l.yearsBand === 'OVER_30') reasons.push('years:OVER_30');

  const dist = input.here && l.lat != null && l.lng != null ? distanceKm(input.here, { lat: l.lat, lng: l.lng }) : null;
  return {
    l,
    hit: {
      id: l.id,
      reasons: [...new Set(reasons)],
      distanceKm: dist == null ? null : Math.round(dist * 10) / 10,
      isNew: l.ratingCount === 0,
      halalGroup,
      allergenPartial,
    },
  };
}

function budgetMatches(l: SearchListing, budget: BudgetBandCode | null | undefined) {
  return !!budget && l.priceJpy != null && budgetBandOf(l.priceJpy) === budget;
}

const YEARS_ORDER: Record<string, number> = { OVER_30: 0, FROM_10_TO_30: 1, UNDER_10: 2 };

/** 評価順。同点なら今日の希望の予算に合う店、次に近い店、次に新着 */
function compareRecommended(budget: BudgetBandCode | null | undefined) {
  return (a: Evaluated, b: Evaluated) => {
    const ra = a.l.ratingAvg ?? 0;
    const rb = b.l.ratingAvg ?? 0;
    if (rb !== ra) return rb - ra;
    const ba = budgetMatches(a.l, budget) ? 0 : 1;
    const bb = budgetMatches(b.l, budget) ? 0 : 1;
    if (ba !== bb) return ba - bb;
    const d = (a.hit.distanceKm ?? Infinity) - (b.hit.distanceKm ?? Infinity);
    if (d && Number.isFinite(d)) return d;
    return b.l.publishedAt - a.l.publishedAt;
  };
}

/** 評価のある店を並べ、評価のない「新しいお店」は上位に置かず中ほどに入れる */
export function recommendOrder<T extends Evaluated>(items: T[], budget: BudgetBandCode | null | undefined): T[] {
  const cmp = compareRecommended(budget);
  const rated = items.filter((e) => !e.hit.isNew).sort(cmp);
  const fresh = items.filter((e) => e.hit.isNew).sort(cmp);
  if (!rated.length) return fresh;
  const mid = Math.ceil(rated.length / 2);
  return [...rated.slice(0, mid), ...fresh, ...rated.slice(mid)];
}

function order(items: Evaluated[], input: SearchInput): Evaluated[] {
  const budget = input.prefs?.budget;
  let sorted: Evaluated[];
  switch (input.sort ?? 'recommended') {
    case 'newest':
      sorted = [...items].sort((a, b) => b.l.publishedAt - a.l.publishedAt);
      break;
    case 'yearsDesc':
      sorted = [...items].sort((a, b) => (YEARS_ORDER[a.l.yearsBand ?? ''] ?? 9) - (YEARS_ORDER[b.l.yearsBand ?? ''] ?? 9) || compareRecommended(budget)(a, b));
      break;
    case 'distance':
      sorted = [...items].sort((a, b) => (a.hit.distanceKm ?? Infinity) - (b.hit.distanceKm ?? Infinity) || b.l.publishedAt - a.l.publishedAt);
      break;
    case 'priceAsc':
      sorted = [...items].sort((a, b) => (a.l.priceJpy ?? Infinity) - (b.l.priceJpy ?? Infinity));
      break;
    default:
      sorted = recommendOrder(items, budget);
  }
  // ハラルを選んだ人には、認証店を上に、その下に「参考」の店を出す
  if ((input.prefs?.religious ?? []).includes('halal')) {
    return [...sorted.filter((e) => e.hit.halalGroup === 'certified'), ...sorted.filter((e) => e.hit.halalGroup === 'reference')];
  }
  return sorted;
}

export interface SearchResult {
  hits: SearchHit[];
  /** 0件のとき：条件を一つ外した場合の件数（多い順） */
  relax: { key: FilterKey; count: number }[];
}

export function search(listings: SearchListing[], input: SearchInput): SearchResult {
  const evaluated = listings.map((l) => evaluate(l, input)).filter((e): e is Evaluated => !!e);
  const hits = order(evaluated, input).map((e) => e.hit);
  if (hits.length) return { hits, relax: [] };
  const relax = activeKeys(input.filters)
    .map((key) => ({ key, count: listings.filter((l) => evaluate(l, { ...input, filters: withoutKey(input.filters, key) })).length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  return { hits, relax };
}
