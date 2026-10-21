import { describe, expect, it } from 'vitest';
import { filtersFromQuery, filtersToQuery } from '../shared/filters';
import { allergenMatch, recommendOrder, search, type SearchListing } from '../shared/search';

const shop = (p: Partial<SearchListing> & { id: string }): SearchListing => ({
  category: 'EXPERIENCE',
  area: 'uji',
  lat: 34.88,
  lng: 135.8,
  priceJpy: 6500,
  languages: ['ja'],
  soloWelcome: false,
  halalCertified: false,
  porkFreeMention: false,
  dietSupport: [],
  allergenFreeShop: [],
  dishes: [],
  adjustLess: false,
  adjustRemove: false,
  crowd: 'MIXED',
  regulars: null,
  guidebook: null,
  yearsBand: 'OVER_30',
  ownerDistance: null,
  stationMinutes: 15,
  minParticipants: 1,
  capacityMax: 6,
  publishedAt: 0,
  ratingAvg: null,
  ratingCount: 0,
  ...p,
});

describe('search filters', () => {
  const shops = [
    shop({ id: 'tea' }),
    shop({ id: 'izakaya', category: 'RESTAURANT', area: 'kyoto_center', crowd: 'LOCAL', priceJpy: 4500, stationMinutes: 4, guidebook: false }),
    shop({ id: 'cafe', category: 'RESTAURANT', area: 'osaka', crowd: 'LOCAL', priceJpy: 1200, capacityMax: null, soloWelcome: true }),
  ];
  it('combines local info, category, budget and station filters', () => {
    const r = search(shops, { filters: { crowd: ['LOCAL'], budget: ['FROM_3000_TO_5000'], stationMax: 5 } });
    expect(r.hits.map((h) => h.id)).toEqual(['izakaya']);
    expect(r.hits[0].reasons).toContain('crowd:LOCAL');
  });
  it('excludes chat-only places when filtering by party size or date', () => {
    expect(search(shops, { filters: { party: 2 } }).hits.map((h) => h.id)).not.toContain('cafe');
    const withSlots = shops.map((s) => ({ ...s, daySlots: s.id === 'tea' ? [{ time: '10:00', capacity: 6, remaining: 1, open: true }] : [] }));
    expect(search(withSlots, { filters: { date: '2026-10-20' } }).hits.map((h) => h.id)).toEqual(['tea']);
    expect(search(withSlots, { filters: { date: '2026-10-20', party: 2 } }).hits).toHaveLength(0);
  });
  it('suggests removing one filter when nothing matches', () => {
    const r = search(shops, { filters: { category: ['TOUR'], solo: true } });
    expect(r.hits).toHaveLength(0);
    // 一人客歓迎を外してもツアーはないので、カテゴリを外す提案だけが出る
    expect(r.relax).toEqual([{ key: 'category', count: 1 }]);
  });
});

describe('recommendation order', () => {
  it('puts higher-rated places first and new places in the middle', () => {
    const items = ['a', 'b', 'c', 'd'].map((id, i) => ({
      l: shop({ id, ratingAvg: [4.8, 4.2, null, 3.9][i], ratingCount: [5, 3, 0, 2][i] }),
      hit: { id, reasons: [], distanceKm: null, isNew: i === 2, allergenPartial: false },
    }));
    expect(recommendOrder(items, null).map((e) => e.l.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('breaks ties by today’s budget', () => {
    const r = search([shop({ id: 'cheap', priceJpy: 2000 }), shop({ id: 'mid', priceJpy: 6000 })], { filters: {}, prefs: { budget: 'FROM_5000_TO_10000' } });
    expect(r.hits.map((h) => h.id)).toEqual(['mid', 'cheap']);
  });
});

describe('religious rules and allergies from the first questions', () => {
  const shops = [
    shop({ id: 'certified', halalCertified: true }),
    shop({ id: 'porkFree', porkFreeMention: true }),
    shop({ id: 'other' }),
  ];
  it('shows halal-certified places first, then pork-free places as reference, and hides the rest', () => {
    const r = search(shops, { filters: {}, prefs: { religious: ['halal'] } });
    expect(r.hits.map((h) => [h.id, h.halalGroup])).toEqual([
      ['certified', 'certified'],
      ['porkFree', 'reference'],
    ]);
  });
  it('matches allergens per dish or for the whole place', () => {
    const l = { allergenFreeShop: ['egg'], dishes: [{ allergens: ['wheat'] }, { allergens: ['milk', 'wheat'] }] };
    expect(allergenMatch(l, ['egg'])).toEqual({ ok: true, partial: false });
    expect(allergenMatch(l, ['milk'])).toEqual({ ok: true, partial: true });
    expect(allergenMatch(l, ['wheat'])).toEqual({ ok: false, partial: false });
  });
});

describe('query round trip', () => {
  it('keeps filters in the URL and drops only invalid values', () => {
    const f = { category: ['EXPERIENCE' as const], stationMax: 10, halal: true, date: '2026-10-20', time: '10:00' };
    expect(filtersFromQuery(new URLSearchParams(filtersToQuery(f)))).toEqual(f);
    expect(filtersFromQuery(new URLSearchParams('stationMax=7&category=TOUR'))).toEqual({ category: ['TOUR'] });
  });
});
