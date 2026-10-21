// 店舗データの共通処理：公開に必要な項目、予約できる枠、評価、旅行者向けの表示（翻訳つき）
import type { Business, ClosedDate, Dish, Listing } from '@prisma/client';
import { isArea } from '../shared/areas.js';
import { cleanSlots, dayAvailability, dayLevel, type BookingConfig, type DayLevel, type Slot } from '../shared/booking.js';
import type { Lang } from '../shared/constants.js';
import type { SearchHit, SearchListing } from '../shared/search.js';
import { addDays, jstDateString } from '../shared/time.js';
import { prisma } from './db.js';
import { translateMany } from './translate.js';

export type ListingFull = Listing & { closedDates: ClosedDate[]; dishes: Dish[]; business: Business };

/** 事業者が任意で足す店の情報（例：Wi-Fi／あり） */
export interface ExtraInfo {
  labelJa: string;
  valueJa: string;
}

export function extraInfoOf(l: Pick<Listing, 'extraInfo'>): ExtraInfo[] {
  if (!Array.isArray(l.extraInfo)) return [];
  return (l.extraInfo as unknown as ExtraInfo[]).filter((x) => x && typeof x.labelJa === 'string' && typeof x.valueJa === 'string' && (x.labelJa.trim() || x.valueJa.trim()));
}
export const listingInclude = { closedDates: true, dishes: true, business: true } as const;

/**
 * 写真は data URL のまま一覧の応答に入れると大きくなりすぎる（Vercel の応答は4.5MBまで）ため、
 * 画像を返す URL にする。v（更新日時）を付けて、写真を変えたらブラウザが読み直すようにする
 */
export function photoUrl(l: Pick<Listing, 'id' | 'updatedAt' | 'photos'>, i = 0): string | null {
  return l.photos[i] ? `/api/photos/${l.id}/${i}?v=${l.updatedAt.getTime()}` : null;
}

export function photoUrls(l: Pick<Listing, 'id' | 'updatedAt' | 'photos'>): string[] {
  return l.photos.map((_, i) => photoUrl(l, i)!);
}

export function slotsOf(l: Pick<Listing, 'slots'>): Slot[] {
  return Array.isArray(l.slots) ? cleanSlots(l.slots as unknown as Slot[]) : [];
}

export function bookingConfig(l: Pick<Listing, 'slots' | 'closedWeekdays' | 'cutoff'> & { closedDates: Pick<ClosedDate, 'date'>[] }): BookingConfig {
  return { slots: slotsOf(l), closedWeekdays: l.closedWeekdays, closedDates: l.closedDates.map((d) => d.date), cutoff: l.cutoff };
}

/** 公開に必要なのに空の項目（日本語の項目名）。空なら下書きのまま */
export function missingFields(l: Listing): string[] {
  const m: string[] = [];
  if (!l.nameJa.trim()) m.push('店名');
  if (!l.category) m.push('カテゴリ');
  if (!isArea(l.area)) m.push('エリア');
  if (!l.address.trim()) m.push('住所');
  if (!l.descriptionJa.trim()) m.push('説明文');
  if (!l.photos.length) m.push('写真');
  if (l.priceJpy == null) m.push('料金');
  if (l.durationMin == null) m.push('所要時間');
  if (!l.paymentMethod) m.push('支払い方法');
  if (!l.crowd) m.push('客層');
  if (!l.yearsBand) m.push('営業年数');
  if (!l.stationJa.trim() || l.stationMinutes == null) m.push('主要駅からの所要時間');
  if (l.category === 'RESTAURANT' && !l.courseStyle) m.push('コース／アラカルト');
  if (l.category === 'TOUR' && !l.meetingPointJa.trim()) m.push('集合場所');
  if (l.category === 'TOUR' && !l.guideLanguages.length) m.push('ガイドの言語');
  return m;
}

/** 日付・時刻ごとの確定済み人数（複数の店をまとめて） */
export async function bookedCounts(listingIds: string[], from: string, to: string): Promise<Map<string, Map<string, number>>> {
  const rows = await prisma.reservation.groupBy({
    by: ['listingId', 'date', 'time'],
    where: { listingId: { in: listingIds }, status: 'CONFIRMED', date: { gte: from, lte: to } },
    _sum: { partySize: true },
  });
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = `${r.listingId}|${r.date}`;
    const m = out.get(key) ?? new Map<string, number>();
    m.set(r.time, r._sum.partySize ?? 0);
    out.set(key, m);
  }
  return out;
}

/** from から days 日分の予約カレンダー */
export async function availabilityRange(l: Pick<Listing, 'id' | 'slots' | 'closedWeekdays' | 'cutoff'> & { closedDates: ClosedDate[] }, from: string, days: number, now = new Date()) {
  const to = addDays(from, days - 1);
  const booked = await bookedCounts([l.id], from, to);
  const cfg = bookingConfig(l);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, ...dayAvailability(cfg, date, booked.get(`${l.id}|${date}`) ?? new Map(), now) };
  });
}

export interface OpenSlot {
  date: string;
  time: string;
  remaining: number;
}

/**
 * 一覧のカードに出す空き枠。日付を選んでいればその日の空いている枠、
 * 選んでいなければ今日から2週間で一番早い空き枠（時間枠のない店は出さない）
 */
export interface DayMark {
  date: string;
  level: DayLevel;
}

export const WEEK_DAYS = 7;

/**
 * 一覧のカード用の空き状況。
 * openSlots：日付を選んでいればその日の空き枠、選んでいなければ一番早い空き枠（14日先まで）。
 * week：選んだ日（なければ今日）から7日間の、日ごとのおおよその空き具合
 */
export async function cardAvailability(
  listings: ListingFull[],
  date: string | undefined,
  now = new Date(),
): Promise<{ openSlots: Map<string, OpenSlot[]>; week: Map<string, DayMark[]> }> {
  const openSlots = new Map<string, OpenSlot[]>();
  const week = new Map<string, DayMark[]>();
  const bookable = listings.filter((l) => slotsOf(l).length);
  if (!bookable.length) return { openSlots, week };
  const from = date ?? jstDateString(now);
  const days = date ? WEEK_DAYS : 14;
  const booked = await bookedCounts(
    bookable.map((l) => l.id),
    from,
    addDays(from, days - 1),
  );
  for (const l of bookable) {
    const cfg = bookingConfig(l);
    const marks: DayMark[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(from, i);
      const day = dayAvailability(cfg, d, booked.get(`${l.id}|${d}`) ?? new Map(), now);
      if (i < WEEK_DAYS) marks.push({ date: d, level: dayLevel(day) });
      if (openSlots.has(l.id) || (date && i > 0)) continue;
      const open = day.slots.filter((s) => s.open).map((s) => ({ date: d, time: s.time, remaining: s.remaining }));
      if (open.length) openSlots.set(l.id, date ? open : open.slice(0, 1));
    }
    week.set(l.id, marks);
  }
  return { openSlots, week };
}

export interface RatingStat {
  avg: number | null;
  count: number;
}

export async function ratingStats(listingIds: string[]): Promise<Map<string, RatingStat>> {
  const rows = await prisma.review.groupBy({
    by: ['listingId'],
    where: { listingId: { in: listingIds }, hidden: false },
    _avg: { stars: true },
    _count: { _all: true },
  });
  const m = new Map<string, RatingStat>(listingIds.map((id) => [id, { avg: null, count: 0 }]));
  for (const r of rows) m.set(r.listingId, { avg: r._avg.stars ? Math.round(r._avg.stars * 10) / 10 : null, count: r._count._all });
  return m;
}

/** 事業者ごとの平均返信時間（分）：旅行者のメッセージに、事業者が最初に返すまでの時間の平均（直近のやり取りから） */
export async function avgReplyMinutes(businessIds: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>(businessIds.map((id) => [id, null]));
  if (!businessIds.length) return out;
  const msgs = await prisma.message.findMany({
    where: { conversation: { listing: { businessId: { in: businessIds } } } },
    select: { conversationId: true, senderRole: true, createdAt: true, conversation: { select: { listing: { select: { businessId: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  const byConv = new Map<string, typeof msgs>();
  for (const m of msgs.reverse()) byConv.set(m.conversationId, [...(byConv.get(m.conversationId) ?? []), m]);
  const acc = new Map<string, number[]>();
  for (const list of byConv.values()) {
    let waitingSince: Date | null = null;
    for (const m of list) {
      if (m.senderRole === 'TRAVELER') waitingSince ??= m.createdAt;
      else if (waitingSince) {
        const b = m.conversation.listing.businessId;
        acc.set(b, [...(acc.get(b) ?? []), (m.createdAt.getTime() - waitingSince.getTime()) / 60000]);
        waitingSince = null;
      }
    }
  }
  for (const [b, list] of acc) out.set(b, Math.round(list.reduce((a, x) => a + x, 0) / list.length));
  return out;
}

export function toSearchListing(l: Listing & { dishes: Dish[] }, rating: RatingStat, daySlots?: SearchListing['daySlots']): SearchListing {
  const slots = slotsOf(l);
  return {
    id: l.id,
    category: l.category,
    area: l.area,
    lat: l.lat,
    lng: l.lng,
    priceJpy: l.priceJpy,
    languages: l.languages,
    soloWelcome: l.soloWelcome,
    halalCertified: l.halalCertified,
    porkFreeMention: l.porkFreeMention,
    dietSupport: l.dietSupport,
    allergenFreeShop: l.allergenFreeShop,
    dishes: l.dishes.map((d) => ({ allergens: d.allergens })),
    adjustLess: l.adjustLess,
    adjustRemove: l.adjustRemove,
    crowd: l.crowd,
    regulars: l.regulars,
    guidebook: l.guidebook,
    yearsBand: l.yearsBand,
    ownerDistance: l.ownerDistance,
    stationMinutes: l.stationMinutes,
    minParticipants: l.minParticipants,
    capacityMax: slots.length ? Math.max(...slots.map((s) => s.capacity)) : null,
    publishedAt: (l.publishedAt ?? l.createdAt).getTime(),
    ratingAvg: rating.avg,
    ratingCount: rating.count,
    daySlots,
  };
}

export interface TText {
  text: string;
  original: string;
  machine: boolean;
}

/** 文字列をまとめて翻訳する補助 */
class Batch {
  private texts: string[] = [];
  add(s: string) {
    this.texts.push(s);
    return this.texts.length - 1;
  }
  async run(to: Lang) {
    const out = await translateMany(this.texts, 'ja', to);
    return (i: number): TText => ({ text: out[i].text, original: this.texts[i], machine: out[i].machine });
  }
}

function localInfo(l: Listing) {
  return { crowd: l.crowd, regulars: l.regulars, guidebook: l.guidebook, yearsBand: l.yearsBand, ownerDistance: l.ownerDistance };
}

/** 一覧のカード */
export async function listingCards(
  listings: Listing[],
  lang: Lang,
  ratings: Map<string, RatingStat>,
  hits?: Map<string, SearchHit>,
  avail?: { openSlots: Map<string, OpenSlot[]>; week: Map<string, DayMark[]> },
) {
  const b = new Batch();
  const idx = listings.map((l) => ({ name: b.add(l.nameJa), station: b.add(l.stationJa), appeal: b.add(l.appealJa.slice(0, 160)) }));
  const [tr, replies] = await Promise.all([b.run(lang), avgReplyMinutes([...new Set(listings.map((l) => l.businessId))])]);
  return listings.map((l, i) => ({
    id: l.id,
    category: l.category,
    name: tr(idx[i].name),
    appeal: tr(idx[i].appeal),
    area: l.area,
    lat: l.lat,
    lng: l.lng,
    photo: photoUrl(l),
    priceJpy: l.priceJpy,
    paymentMethod: l.paymentMethod,
    local: localInfo(l),
    station: tr(idx[i].station),
    stationMinutes: l.stationMinutes,
    languages: l.languages,
    soloWelcome: l.soloWelcome,
    halalCertified: l.halalCertified,
    dietSupport: l.dietSupport,
    adjustLess: l.adjustLess,
    adjustRemove: l.adjustRemove,
    rating: ratings.get(l.id) ?? { avg: null, count: 0 },
    avgReplyMinutes: replies.get(l.businessId) ?? null,
    bookable: slotsOf(l).length > 0,
    hit: hits?.get(l.id) ?? null,
    openSlots: avail?.openSlots.get(l.id) ?? null,
    week: avail?.week.get(l.id) ?? null,
  }));
}

/** 詳細ページ（表示言語に自動翻訳） */
export async function listingDetail(l: ListingFull, lang: Lang) {
  const b = new Batch();
  const i = {
    name: b.add(l.nameJa),
    description: b.add(l.descriptionJa),
    appeal: b.add(l.appealJa),
    dress: b.add(l.dressJa),
    station: b.add(l.stationJa),
    itemsToBring: b.add(l.itemsToBringJa),
    meetingPoint: b.add(l.meetingPointJa),
    itinerary: b.add(l.itineraryJa),
    dishes: l.dishes.map((d) => b.add(d.nameJa)),
    extra: extraInfoOf(l).map((x) => ({ label: b.add(x.labelJa), value: b.add(x.valueJa) })),
  };
  const [tr, ratings, replies, reviews] = await Promise.all([
    b.run(lang),
    ratingStats([l.id]),
    avgReplyMinutes([l.businessId]),
    prisma.review.findMany({ where: { listingId: l.id, hidden: false }, select: { tags: true } }),
  ]);
  const tagCounts: Record<string, number> = {};
  for (const r of reviews) for (const t of r.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  const slots = slotsOf(l);
  return {
    id: l.id,
    category: l.category,
    name: tr(i.name),
    nameJa: l.nameJa,
    description: tr(i.description),
    appeal: tr(i.appeal),
    dress: tr(i.dress),
    extraInfo: i.extra.map((x) => ({ label: tr(x.label), value: tr(x.value) })),
    area: l.area,
    address: l.address,
    lat: l.lat,
    lng: l.lng,
    photos: photoUrls(l),
    priceJpy: l.priceJpy,
    durationMin: l.durationMin,
    paymentMethod: l.paymentMethod,
    languages: l.languages,
    soloWelcome: l.soloWelcome,
    local: localInfo(l),
    station: tr(i.station),
    stationMinutes: l.stationMinutes,
    rating: ratings.get(l.id)!,
    reviewTags: tagCounts,
    avgReplyMinutes: replies.get(l.businessId) ?? null,
    food: {
      halalCertified: l.halalCertified,
      porkFreeMention: l.porkFreeMention,
      dietSupport: l.dietSupport,
      allergenFreeShop: l.allergenFreeShop,
      dishes: l.dishes.map((d, k) => ({ name: tr(i.dishes[k]), allergens: d.allergens })),
      adjustLess: l.adjustLess,
      adjustRemove: l.adjustRemove,
    },
    capacityMax: slots.length ? Math.max(...slots.map((s) => s.capacity)) : null,
    slots,
    closedWeekdays: l.closedWeekdays,
    cutoff: l.cutoff,
    freeCancel: l.freeCancel,
    lateFeeJpy: l.lateFeeJpy,
    // カテゴリ別項目
    itemsToBring: tr(i.itemsToBring),
    minParticipants: l.minParticipants,
    courseStyle: l.courseStyle,
    meetingPoint: tr(i.meetingPoint),
    itinerary: tr(i.itinerary),
    guideLanguages: l.guideLanguages,
    bookable: slots.length > 0,
  };
}

/** AIに渡す店の情報（持っている情報だけから答えるため。個人情報は含めない） */
export function shopInfoForAi(l: ListingFull) {
  const slots = slotsOf(l);
  return {
    name: l.nameJa,
    category: l.category,
    description: l.descriptionJa,
    appealPoints: l.appealJa,
    dress: l.dressJa,
    otherInfo: extraInfoOf(l).map((x) => `${x.labelJa}：${x.valueJa}`),
    paymentMethod: l.paymentMethod,
    languages: l.languages,
    soloWelcome: l.soloWelcome,
    halalCertified: l.halalCertified,
    dietSupport: l.dietSupport,
    allergenFreeWholeShop: l.allergenFreeShop,
    dishes: l.dishes.map((d) => ({ name: d.nameJa, allergens: d.allergens })),
    ingredientAdjustments: { less: l.adjustLess, remove: l.adjustRemove },
    durationMin: l.durationMin,
    priceJpy: l.priceJpy,
    timeSlots: slots.map((s) => `${s.time} (up to ${s.capacity})`),
    closedWeekdays: l.closedWeekdays,
    minParticipants: l.minParticipants,
    itemsToBring: l.itemsToBringJa,
    meetingPoint: l.meetingPointJa,
    itinerary: l.itineraryJa,
    guideLanguages: l.guideLanguages,
    customers: l.crowd,
    regulars: l.regulars,
    inGuidebooks: l.guidebook,
    yearsInBusiness: l.yearsBand,
    ownerServes: l.ownerDistance,
    station: l.stationJa && l.stationMinutes != null ? `${l.stationMinutes} min from ${l.stationJa}` : null,
    address: l.address,
  };
}

/** 掲載文の翻訳を先に作っておく（最初の旅行者を待たせない）。失敗しても保存は止めない */
export async function warmTranslations(l: Listing & { dishes?: Dish[] }) {
  const texts = [
    ...[l.nameJa, l.descriptionJa, l.appealJa, l.dressJa, l.stationJa, l.itemsToBringJa, l.meetingPointJa, l.itineraryJa],
    ...(l.dishes ?? []).map((d) => d.nameJa),
    ...extraInfoOf(l).flatMap((x) => [x.labelJa, x.valueJa]),
  ];
  await Promise.all((['en', 'zh', 'ko', 'fr', 'es'] as const).map((to) => translateMany(texts, 'ja', to))).catch((e) => console.error('warm translations', e));
}
