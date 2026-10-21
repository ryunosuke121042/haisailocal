// 事業者画面のAPI（日本語のみ）
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AREAS } from '../../shared/areas.js';
import { cleanSlots } from '../../shared/booking.js';
import {
  ALLERGENS,
  BIZ_CANCEL_REASONS,
  CATEGORIES,
  COURSE_STYLES,
  CROWDS,
  CUTOFFS,
  DIET_SUPPORT,
  FREE_CANCELS,
  GUIDE_LANGS,
  LIMITS,
  OWNER_DISTANCES,
  PAYMENT_METHODS,
  REGULARS,
  SHOP_LANGS,
  YEARS,
} from '../../shared/constants.js';
import { addDays, isValidDateString, jstDateString } from '../../shared/time.js';
import { requireBusiness } from '../auth.js';
import { prisma } from '../db.js';
import { HttpError, parse, type Ctx, type Router } from '../http.js';
import { extraInfoOf, listingInclude, missingFields, photoUrl, slotsOf, warmTranslations } from '../listings.js';
import { detectPorkFree } from '../ai.js';
import { BIZ_REASON_TEXT } from '../mailtext.js';
import { cancelReservationNotices, notifyTraveler, userLang, whenText } from '../notify.js';
import { pushEnabled } from '../push.js';
import { detectLang, translateOne } from '../translate.js';
import { displayStatus } from './traveler.js';
import { ChatInput, chatPhotoUrl } from '../chatPhoto.js';
import { reviewPhotoUrls } from '../reviews.js';


const Text = (max: number) => z.string().max(max).transform((s) => s.normalize('NFC').trim());
const PhotoUrl = z
  .string()
  .max(Math.ceil(LIMITS.photoMaxBytes * 1.4))
  .refine((s) => /^data:image\/(jpeg|png|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s), 'invalid_photo');

// 下書きとして保存できるよう、どの項目も空を許す（公開できるかは missingFields で判定）
const ListingInput = z.object({
  category: z.enum(CATEGORIES).nullable(),
  nameJa: Text(80),
  area: z.union([z.enum(AREAS), z.literal('')]),
  address: Text(200),
  descriptionJa: Text(LIMITS.descriptionMaxChars),
  photos: z.array(PhotoUrl).max(LIMITS.photosMax),
  appealJa: Text(500),
  dressJa: Text(200),
  // 古い画面から保存されたときに消さないよう、送られてきたときだけ書き換える
  extraInfo: z.array(z.object({ labelJa: Text(30), valueJa: Text(300) })).max(LIMITS.extraInfoMax).optional(),
  lat: z.number().min(20).max(46).nullable(),
  lng: z.number().min(122).max(154).nullable(),
  languages: z.array(z.enum(SHOP_LANGS)).max(SHOP_LANGS.length),
  soloWelcome: z.boolean(),
  halalCertified: z.boolean(),
  allergenFreeShop: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length),
  adjustLess: z.boolean(),
  adjustRemove: z.boolean(),
  dishes: z.array(z.object({ nameJa: Text(60), allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length) })).max(LIMITS.dishesMax),
  regulars: z.enum(REGULARS).nullable(),
  guidebook: z.boolean().nullable(),
  ownerDistance: z.enum(OWNER_DISTANCES).nullable(),
  priceJpy: z.number().int().min(0).max(1_000_000).nullable(),
  durationMin: z.number().int().min(5).max(24 * 60).nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  crowd: z.enum(CROWDS).nullable(),
  yearsBand: z.enum(YEARS).nullable(),
  stationJa: Text(60),
  stationMinutes: z.number().int().min(0).max(300).nullable(),
  itemsToBringJa: Text(300),
  minParticipants: z.number().int().min(1).max(LIMITS.partyMax),
  dietSupport: z.array(z.enum(DIET_SUPPORT)).max(DIET_SUPPORT.length),
  courseStyle: z.enum(COURSE_STYLES).nullable(),
  meetingPointJa: Text(200),
  itineraryJa: Text(1000),
  guideLanguages: z.array(z.enum(GUIDE_LANGS)).max(GUIDE_LANGS.length),
  slots: z.array(z.object({ time: z.string().max(5), capacity: z.number().int().min(1).max(LIMITS.slotCapacityMax) })).max(LIMITS.slotsMax),
  closedWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
  cutoff: z.enum(CUTOFFS),
  freeCancel: z.enum(FREE_CANCELS),
  lateFeeJpy: z.number().int().min(1).max(1_000_000).nullable(),
});

async function ownListing(ctx: Ctx, id: string) {
  const u = await requireBusiness(ctx);
  const l = await prisma.listing.findUnique({ where: { id }, include: listingInclude });
  if (!l || l.businessId !== u.businessId) throw new HttpError(404, 'not_found');
  return { u, l };
}

function listingForEdit(l: Prisma.ListingGetPayload<{ include: typeof listingInclude }>) {
  return {
    id: l.id,
    status: l.status,
    missing: missingFields(l),
    category: l.category,
    nameJa: l.nameJa,
    area: l.area,
    address: l.address,
    descriptionJa: l.descriptionJa,
    photos: l.photos,
    appealJa: l.appealJa,
    dressJa: l.dressJa,
    extraInfo: extraInfoOf(l),
    lat: l.lat,
    lng: l.lng,
    languages: l.languages,
    soloWelcome: l.soloWelcome,
    halalCertified: l.halalCertified,
    allergenFreeShop: l.allergenFreeShop,
    adjustLess: l.adjustLess,
    adjustRemove: l.adjustRemove,
    dishes: l.dishes.map((d) => ({ nameJa: d.nameJa, allergens: d.allergens })),
    regulars: l.regulars,
    guidebook: l.guidebook,
    ownerDistance: l.ownerDistance,
    priceJpy: l.priceJpy,
    durationMin: l.durationMin,
    paymentMethod: l.paymentMethod,
    crowd: l.crowd,
    yearsBand: l.yearsBand,
    stationJa: l.stationJa,
    stationMinutes: l.stationMinutes,
    itemsToBringJa: l.itemsToBringJa,
    minParticipants: l.minParticipants,
    dietSupport: l.dietSupport,
    courseStyle: l.courseStyle,
    meetingPointJa: l.meetingPointJa,
    itineraryJa: l.itineraryJa,
    guideLanguages: l.guideLanguages,
    slots: slotsOf(l),
    closedWeekdays: l.closedWeekdays,
    cutoff: l.cutoff,
    freeCancel: l.freeCancel,
    lateFeeJpy: l.lateFeeJpy,
  };
}

export function businessRoutes(r: Router) {
  r.get('/biz/home', async (ctx) => {
    const u = await requireBusiness(ctx);
    const today = jstDateString();
    const [business, listings, upcoming, unreadMessages, unreadNotices, pushCount] = await Promise.all([
      prisma.business.findUniqueOrThrow({ where: { id: u.businessId } }),
      prisma.listing.findMany({ where: { businessId: u.businessId }, orderBy: { createdAt: 'asc' } }),
      prisma.reservation.count({ where: { listing: { businessId: u.businessId }, status: 'CONFIRMED', date: { gte: today, lte: addDays(today, 6) } } }),
      prisma.message.count({ where: { conversation: { listing: { businessId: u.businessId } }, senderRole: 'TRAVELER', readAt: null } }),
      prisma.notification.count({ where: { businessId: u.businessId, readAt: null } }),
      prisma.pushSubscription.count({ where: { userId: u.id } }),
    ]);
    return {
      business: { id: business.id, name: business.name, reminderMinutes: business.reminderMinutes },
      unreadNotices,
      push: { enabled: pushEnabled(), registeredOnThisAccount: pushCount > 0, publicKey: process.env.VAPID_PUBLIC_KEY ?? null },
      email: u.email,
      listings: listings.map((l) => ({ id: l.id, nameJa: l.nameJa, status: l.status, missing: missingFields(l), photo: photoUrl(l), hasSlots: slotsOf(l).length > 0 })),
      upcomingWeek: upcoming,
      unreadMessages,
    };
  });

  // 設定：事業者名、当日予約の来店前メールを何分前に送るか
  r.put('/biz/settings', async (ctx) => {
    const u = await requireBusiness(ctx);
    const b = parse(z.object({ name: Text(80).pipe(z.string().min(1)), reminderMinutes: z.number().int().min(5).max(180) }), ctx.body);
    await prisma.business.update({ where: { id: u.businessId }, data: { name: b.name, reminderMinutes: b.reminderMinutes } });
    return { ok: true };
  });

  // 住所から位置を探す（OpenStreetMap）。事業者が地図のピンで確かめて保存する。Google の Places データは保存しない
  r.get('/biz/geocode', async (ctx) => {
    await requireBusiness(ctx);
    const q = (ctx.query.get('q') ?? '').trim().slice(0, 200);
    if (!q) return { results: [] };
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=jp&accept-language=ja&q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'haisailocal (business listing geocoder)' },
        signal: AbortSignal.timeout(5000),
      });
      const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      return { results: json.map((x) => ({ lat: Number(x.lat), lng: Number(x.lon), label: x.display_name })) };
    } catch {
      return { results: [] };
    }
  });

  // プッシュ通知の宛先を登録する（家族の端末ごとに）
  r.post('/biz/push/subscribe', async (ctx) => {
    const u = await requireBusiness(ctx);
    const b = parse(z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }), ctx.body);
    await prisma.pushSubscription.upsert({
      where: { endpoint: b.endpoint },
      create: { userId: u.id, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth },
      update: { userId: u.id, p256dh: b.keys.p256dh, auth: b.keys.auth },
    });
    return { ok: true };
  });

  // アプリ内の通知
  r.get('/biz/notifications', async (ctx) => {
    const u = await requireBusiness(ctx);
    const list = await prisma.notification.findMany({ where: { businessId: u.businessId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { results: list.map((n) => ({ id: n.id, type: n.type, payload: n.payload, at: n.createdAt, read: !!n.readAt })) };
  });
  r.post('/biz/notifications/read', async (ctx) => {
    const u = await requireBusiness(ctx);
    await prisma.notification.updateMany({ where: { businessId: u.businessId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  });

  // 評価の確認と、削除の申出（運営が規約の基準に当たるか確認する）
  r.get('/biz/reviews', async (ctx) => {
    const u = await requireBusiness(ctx);
    const list = await prisma.review.findMany({ where: { listing: { businessId: u.businessId } }, include: { listing: true, reservation: true }, orderBy: { createdAt: 'desc' }, take: 200 });
    return {
      results: list.map((r) => ({
        id: r.id,
        listing: r.listing.nameJa,
        stars: r.stars,
        tags: r.tags,
        photos: reviewPhotoUrls(r),
        hidden: r.hidden,
        date: r.reservation.date,
        takedown: r.takedownAt ? { at: r.takedownAt, reason: r.takedownReason } : null,
      })),
    };
  });
  r.post('/biz/reviews/:id/takedown', async (ctx) => {
    const u = await requireBusiness(ctx);
    const b = parse(z.object({ reason: Text(1000).pipe(z.string().min(1)) }), ctx.body);
    const rv = await prisma.review.findUnique({ where: { id: ctx.params.id }, include: { listing: true } });
    if (!rv || rv.listing.businessId !== u.businessId) throw new HttpError(404, 'not_found');
    await prisma.review.update({ where: { id: rv.id }, data: { takedownReason: b.reason, takedownAt: new Date() } });
    return { ok: true };
  });

  // 「翻訳がおかしい」は旅行者と共通の /translation-report を使う

  // 店舗を追加（空の下書き）
  r.post('/biz/listings', async (ctx) => {
    const u = await requireBusiness(ctx);
    const count = await prisma.listing.count({ where: { businessId: u.businessId } });
    if (count >= 10) throw new HttpError(400, 'too_many_listings');
    const l = await prisma.listing.create({
      data: { businessId: u.businessId, photos: [], dietSupport: [], guideLanguages: [], closedWeekdays: [], languages: ['ja'], allergenFreeShop: [] },
    });
    return { id: l.id };
  });

  r.get('/biz/listings/:id', async (ctx) => {
    const { l } = await ownListing(ctx, ctx.params.id);
    return listingForEdit(l);
  });

  // 保存：必須項目がそろっていれば即公開。足りなければ下書き。非公開にした店は非公開のまま
  r.put('/biz/listings/:id', async (ctx) => {
    const { l } = await ownListing(ctx, ctx.params.id);
    const { dishes, extraInfo, ...b } = parse(ListingInput, ctx.body);
    const porkFreeMention = b.appealJa === l.appealJa ? l.porkFreeMention : await detectPorkFree(b.appealJa);
    const data = {
      ...b,
      ...(extraInfo ? { extraInfo: extraInfo.filter((x) => x.labelJa && x.valueJa) as unknown as Prisma.InputJsonValue } : {}),
      porkFreeMention,
      slots: cleanSlots(b.slots) as unknown as Prisma.InputJsonValue,
      closedWeekdays: [...new Set(b.closedWeekdays)].sort(),
    };
    const draft = { ...l, ...data, slots: data.slots as Prisma.JsonValue, extraInfo: (data.extraInfo ?? l.extraInfo) as Prisma.JsonValue };
    const missing = missingFields(draft);
    const status = l.status === 'SUSPENDED' || l.status === 'HIDDEN' ? l.status : missing.length ? 'DRAFT' : 'PUBLISHED';
    const [, saved] = await prisma.$transaction([
      prisma.dish.deleteMany({ where: { listingId: l.id } }),
      prisma.listing.update({
        where: { id: l.id },
        data: {
          ...data,
          status,
          publishedAt: status === 'PUBLISHED' ? (l.publishedAt ?? new Date()) : l.publishedAt,
          dishes: { create: dishes.filter((d) => d.nameJa).map((d) => ({ nameJa: d.nameJa, allergens: [...new Set(d.allergens)] })) },
        },
        include: listingInclude,
      }),
    ]);
    if (status === 'PUBLISHED') await warmTranslations(saved);
    return listingForEdit(saved);
  });

  r.post('/biz/listings/:id/publish', async (ctx) => {
    const { l } = await ownListing(ctx, ctx.params.id);
    if (l.status === 'SUSPENDED') throw new HttpError(403, 'suspended');
    const missing = missingFields(l);
    if (missing.length) throw new HttpError(400, 'incomplete', { missing });
    const saved = await prisma.listing.update({ where: { id: l.id }, data: { status: 'PUBLISHED', publishedAt: l.publishedAt ?? new Date() }, include: listingInclude });
    await warmTranslations(saved);
    return listingForEdit(saved);
  });

  r.post('/biz/listings/:id/hide', async (ctx) => {
    const { l } = await ownListing(ctx, ctx.params.id);
    if (l.status === 'SUSPENDED') throw new HttpError(403, 'suspended');
    const saved = await prisma.listing.update({ where: { id: l.id }, data: { status: 'HIDDEN' }, include: listingInclude });
    return listingForEdit(saved);
  });

  // 受付停止日：今日以降の停止日と、日ごとの確定済み予約の件数
  r.get('/biz/listings/:id/closed', async (ctx) => {
    const { l } = await ownListing(ctx, ctx.params.id);
    const today = jstDateString();
    const res = await prisma.reservation.groupBy({
      by: ['date'],
      where: { listingId: l.id, status: 'CONFIRMED', date: { gte: today } },
      _count: { _all: true },
    });
    return {
      today,
      nameJa: l.nameJa,
      closedWeekdays: l.closedWeekdays,
      closedDates: l.closedDates.map((d) => d.date).filter((d) => d >= today).sort(),
      reservations: Object.fromEntries(res.map((x) => [x.date, x._count._all])),
    };
  });

  r.put('/biz/listings/:id/closed', async (ctx) => {
    const { l } = await ownListing(ctx, ctx.params.id);
    const b = parse(
      z.object({ add: z.array(z.string().refine(isValidDateString)).max(400).default([]), remove: z.array(z.string().refine(isValidDateString)).max(400).default([]) }),
      ctx.body,
    );
    await prisma.$transaction([
      prisma.closedDate.deleteMany({ where: { listingId: l.id, date: { in: b.remove } } }),
      prisma.closedDate.createMany({ data: b.add.map((date) => ({ listingId: l.id, date })), skipDuplicates: true }),
    ]);
    return { ok: true };
  });

  // 予約一覧（日付順）
  r.get('/biz/reservations', async (ctx) => {
    const u = await requireBusiness(ctx);
    const past = ctx.query.get('scope') === 'past';
    const today = jstDateString();
    const list = await prisma.reservation.findMany({
      where: { listing: { businessId: u.businessId }, date: past ? { lt: today } : { gte: today } },
      include: { listing: { select: { id: true, nameJa: true } }, traveler: { select: { name: true } } },
      orderBy: past ? [{ visitAt: 'desc' }] : [{ visitAt: 'asc' }],
      take: 200,
    });
    return { results: list.map((x) => bizReservation(x)) };
  });

  r.get('/biz/reservations/:id', async (ctx) => {
    const u = await requireBusiness(ctx);
    const x = await prisma.reservation.findUnique({
      where: { id: ctx.params.id },
      include: { listing: { select: { id: true, nameJa: true, businessId: true } }, traveler: { select: { id: true, name: true } } },
    });
    if (!x || x.listing.businessId !== u.businessId) throw new HttpError(404, 'not_found');
    const conv = await prisma.conversation.findUnique({ where: { travelerId_listingId: { travelerId: x.travelerId, listingId: x.listingId } } });
    return { ...bizReservation(x), conversationId: conv?.id ?? null };
  });

  // 事業者によるキャンセル：理由を選び、旅行者には翻訳してメールで知らせる
  r.post('/biz/reservations/:id/cancel', async (ctx) => {
    const u = await requireBusiness(ctx);
    const b = parse(z.object({ reason: z.enum(BIZ_CANCEL_REASONS), noteJa: Text(300).default('') }), ctx.body);
    const x = await prisma.reservation.findUnique({ where: { id: ctx.params.id }, include: { listing: true, traveler: true } });
    if (!x || x.listing.businessId !== u.businessId) throw new HttpError(404, 'not_found');
    if (x.status !== 'CONFIRMED' || x.visitAt <= new Date()) throw new HttpError(400, 'invalid_status');
    const { count } = await prisma.reservation.updateMany({
      where: { id: x.id, status: 'CONFIRMED' },
      data: { status: 'CANCELED_BY_BUSINESS', canceledAt: new Date(), bizCancelReason: b.reason, bizCancelNoteJa: b.noteJa },
    });
    if (!count) throw new HttpError(409, 'conflict');
    await cancelReservationNotices(x.id);
    const lang = userLang(x.traveler.lang);
    const [shop, note] = await Promise.all([translateOne(x.listing.nameJa, 'ja', lang), b.noteJa ? translateOne(b.noteJa, 'ja', lang) : null]);
    // 旅行者は予約の画面から、同じ日に空きのある近くの似たお店（代替案）を見られる
    await notifyTraveler(
      x.traveler,
      'shopCanceled',
      { shop: shop.text, when: whenText(x), reason: [BIZ_REASON_TEXT[b.reason][lang], note?.text].filter(Boolean).join('\n'), path: `/${lang}/bookings/${x.id}` },
      { reservationId: x.id },
    );
    return { ok: true };
  });

  // 来店しなかった予約に「来店なし」を付ける（運営が当日キャンセル料の請求を判断する材料）
  r.post('/biz/reservations/:id/no-show', async (ctx) => {
    const u = await requireBusiness(ctx);
    const b = parse(z.object({ noShow: z.boolean() }), ctx.body);
    const x = await prisma.reservation.findUnique({ where: { id: ctx.params.id }, include: { listing: true, traveler: true, review: true } });
    if (!x || x.listing.businessId !== u.businessId) throw new HttpError(404, 'not_found');
    if (x.visitAt > new Date()) throw new HttpError(400, 'not_yet');
    if (Date.now() - x.visitAt.getTime() > NO_SHOW_HOURS * 3_600_000) throw new HttpError(400, 'too_late');
    if (b.noShow && x.review) throw new HttpError(400, 'already_reviewed');
    const from = b.noShow ? 'CONFIRMED' : 'NO_SHOW';
    const { count } = await prisma.reservation.updateMany({
      where: { id: x.id, status: from },
      data: b.noShow ? { status: 'NO_SHOW', noShowAt: new Date() } : { status: 'CONFIRMED', noShowAt: null },
    });
    if (!count) throw new HttpError(400, 'invalid_status');
    if (b.noShow) await cancelReservationNotices(x.id);
    else {
      // 間違えて付けた「来店なし」を取り消したら、評価のお願いをあらためて送る
      const lang = userLang(x.traveler.lang);
      const shop = await translateOne(x.listing.nameJa, 'ja', lang);
      await notifyTraveler(x.traveler, 'reviewRequest', { shop: shop.text, path: `/${lang}/bookings/${x.id}#review` }, { reservationId: x.id });
    }
    return { ok: true };
  });

  // チャット
  r.get('/biz/conversations', async (ctx) => {
    const u = await requireBusiness(ctx);
    const list = await prisma.conversation.findMany({
      where: { listing: { businessId: u.businessId }, messages: { some: {} } },
      include: { listing: { select: { nameJa: true } }, traveler: { select: { name: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const unread = await prisma.message.groupBy({
      by: ['conversationId'],
      where: { conversation: { listing: { businessId: u.businessId } }, senderRole: 'TRAVELER', readAt: null },
      _count: { _all: true },
    });
    const unreadMap = new Map(unread.map((x) => [x.conversationId, x._count._all]));
    return {
      results: list.map((c) => {
        const m = c.messages[0];
        return {
          id: c.id,
          traveler: c.traveler.name,
          listing: c.listing.nameJa,
          last: m ? ((m.senderRole === 'TRAVELER' ? m.translated || m.body : m.body) || (m.hasPhoto ? '📷 写真' : '')).slice(0, 60) : '',
          lastAt: m?.createdAt ?? c.updatedAt,
          unread: unreadMap.get(c.id) ?? 0,
        };
      }),
    };
  });

  r.get('/biz/conversations/:id', async (ctx) => {
    const u = await requireBusiness(ctx);
    const c = await prisma.conversation.findUnique({
      where: { id: ctx.params.id },
      include: { listing: true, traveler: true, messages: { orderBy: { createdAt: 'asc' }, take: 300 } },
    });
    if (!c || c.listing.businessId !== u.businessId) throw new HttpError(404, 'not_found');
    await prisma.message.updateMany({ where: { conversationId: c.id, senderRole: 'TRAVELER', readAt: null }, data: { readAt: new Date() } });
    // 送られたときに訳せなかった（翻訳が遅い・上限など）メッセージは、開いたときに訳し直す
    const untranslated = c.messages.filter((m) => m.senderRole === 'TRAVELER' && m.body.trim() && m.lang !== 'ja' && (!m.translated || m.translated === m.body));
    for (const m of untranslated.slice(0, 10)) {
      const from = detectLang(m.body, userLang(m.lang));
      if (from === 'ja') continue;
      const t = await translateOne(m.body, from, 'ja');
      if (t.machine) {
        m.translated = t.text;
        await prisma.message.update({ where: { id: m.id }, data: { translated: t.text, translatedLang: 'ja' } });
      }
    }
    const [isBlocked, reservations] = await Promise.all([
      prisma.block.findUnique({ where: { businessId_travelerId: { businessId: u.businessId, travelerId: c.travelerId } } }),
      prisma.reservation.findMany({ where: { travelerId: c.travelerId, listingId: c.listingId }, orderBy: { visitAt: 'desc' }, take: 10 }),
    ]);
    return {
      id: c.id,
      traveler: c.traveler.name,
      travelerLang: c.traveler.lang,
      listing: { id: c.listingId, nameJa: c.listing.nameJa },
      blocked: !!isBlocked,
      reservations: reservations.map((x) => ({ id: x.id, date: x.date, time: x.time, partySize: x.partySize, status: displayStatus(x) })),
      messages: c.messages.map((m) =>
        m.senderRole === 'TRAVELER'
          ? { id: m.id, fromMe: false, text: m.translated || m.body, original: m.body, machine: !!m.translated && m.translated !== m.body, photo: chatPhotoUrl(m), at: m.createdAt }
          : { id: m.id, fromMe: true, text: m.body, original: m.body, machine: false, photo: chatPhotoUrl(m), at: m.createdAt },
      ),
    };
  });

  r.post('/biz/conversations/:id/messages', async (ctx) => {
    const u = await requireBusiness(ctx);
    const b = parse(ChatInput, ctx.body);
    const c = await prisma.conversation.findUnique({ where: { id: ctx.params.id }, include: { listing: true, traveler: true } });
    if (!c || c.listing.businessId !== u.businessId) throw new HttpError(404, 'not_found');
    const lang = userLang(c.traveler.lang);
    const t = b.text ? await translateOne(b.text, 'ja', lang) : { text: '', machine: false };
    const unreadBefore = await prisma.message.count({ where: { conversationId: c.id, senderRole: 'BUSINESS', readAt: null } });
    await prisma.message.create({
      data: {
        conversationId: c.id,
        senderRole: 'BUSINESS',
        body: b.text,
        lang: 'ja',
        translated: t.text,
        translatedLang: lang,
        hasPhoto: !!b.photo,
        ...(b.photo ? { photo: { create: { data: b.photo } } } : {}),
      },
    });
    await prisma.conversation.update({ where: { id: c.id }, data: { updatedAt: new Date() } });
    if (!unreadBefore) {
      const shop = await translateOne(c.listing.nameJa, 'ja', lang);
      await notifyTraveler(c.traveler, 'newMessage', { shop: shop.text, path: `/${lang}/chat/${c.listingId}` });
    }
    return { ok: true };
  });

  // チャット相手のブロック（ブロック中はチャットも予約も受け付けない）
  r.post('/biz/conversations/:id/block', async (ctx) => {
    const u = await requireBusiness(ctx);
    const b = parse(z.object({ blocked: z.boolean() }), ctx.body);
    const c = await prisma.conversation.findUnique({ where: { id: ctx.params.id }, include: { listing: true } });
    if (!c || c.listing.businessId !== u.businessId) throw new HttpError(404, 'not_found');
    const key = { businessId_travelerId: { businessId: u.businessId, travelerId: c.travelerId } };
    if (b.blocked) await prisma.block.upsert({ where: key, create: { businessId: u.businessId, travelerId: c.travelerId }, update: {} });
    else await prisma.block.deleteMany({ where: { businessId: u.businessId, travelerId: c.travelerId } });
    return { blocked: b.blocked };
  });
}

/** 「来店なし」を付けられるのは、来店時刻から48時間以内【案】 */
const NO_SHOW_HOURS = 48;

function bizReservation(
  x: Prisma.ReservationGetPayload<object> & { listing: { id: string; nameJa: string }; traveler: { name: string } },
) {
  return {
    id: x.id,
    status: displayStatus(x),
    date: x.date,
    time: x.time,
    visitAt: x.visitAt,
    partySize: x.partySize,
    traveler: x.traveler.name,
    dietary: x.dietary,
    messageJa: x.messageJa,
    message: x.message,
    payJpy: x.payJpy,
    lateCancel: x.lateCancel,
    cancelFeeJpy: x.cancelFeeJpy,
    bizCancelReason: x.bizCancelReason,
    bizCancelNoteJa: x.bizCancelNoteJa,
    listing: { id: x.listing.id, nameJa: x.listing.nameJa },
    canCancel: x.status === 'CONFIRMED' && x.visitAt > new Date(),
    canMarkNoShow: (x.status === 'CONFIRMED' || x.status === 'NO_SHOW') && x.visitAt <= new Date() && Date.now() - x.visitAt.getTime() <= NO_SHOW_HOURS * 3_600_000,
  };
}
