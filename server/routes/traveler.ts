import type { Listing, Reservation, Review } from '@prisma/client';
import { z } from 'zod';
import { AREA_CENTERS, areaLabel, distanceKm, isArea } from '../../shared/areas.js';
import { cancelTerms, dayAvailability, freeCancelUntil } from '../../shared/booking.js';
import { DIETARY, DIETARY_JA, LANGS, LIMITS, type Dietary, type Lang } from '../../shared/constants.js';
import { FiltersSchema, PrefsSchema, SORTS } from '../../shared/filters.js';
import { search, type SearchHit } from '../../shared/search.js';
import { isValidDateString, isValidTimeString, jstDateString, jstToDate } from '../../shared/time.js';
import { answerGeneralQuestion, answerShopQuestion, wishToFilters } from '../ai.js';
import { currentUser, requireUser } from '../auth.js';
import { prisma } from '../db.js';
import { appUrl, sendMail } from '../email.js';
import { getRates } from '../fx.js';
import { HttpError, parse, RAW, type Router } from '../http.js';
import { ChatInput, chatPhotoUrl, serveChatPhoto } from '../chatPhoto.js';
import { ReviewInput, reviewPhotoUrls, reviewSummary, serveReviewPhoto } from '../reviews.js';
import { sweep } from '../lifecycle.js';
import {
  availabilityRange,
  bookedCounts,
  bookingConfig,
  listingCards,
  listingDetail,
  listingInclude,
  cardAvailability,
  photoUrl,
  ratingStats,
  shopInfoForAi,
  slotsOf,
  toSearchListing,
  type ListingFull,
} from '../listings.js';
import { BIZ_REASON_TEXT, PAY_TEXT, travelerMail } from '../mailtext.js';
import { cancelReservationNotices, deadlineText, notifyBusiness, scheduleReservationNotices, userLang, whenText, yen } from '../notify.js';
import { detectLang, translateMany, translateOne } from '../translate.js';

const LangQ = z.enum(LANGS).catch('en');
const langOf = (q: URLSearchParams): Lang => LangQ.parse(q.get('lang') ?? 'en');

/** 来店時刻を過ぎた確定済みの予約は「来店済み」として見せる */
export function displayStatus(r: Pick<Reservation, 'status' | 'visitAt'>, now = new Date()) {
  return r.status === 'CONFIRMED' && r.visitAt.getTime() <= now.getTime() ? 'VISITED' : r.status;
}

async function blocked(businessId: string, travelerId: string) {
  return !!(await prisma.block.findUnique({ where: { businessId_travelerId: { businessId, travelerId } } }));
}

async function publishedListing(id: string) {
  const l = await prisma.listing.findUnique({ where: { id }, include: listingInclude });
  if (!l || l.status !== 'PUBLISHED') throw new HttpError(404, 'not_found');
  return l;
}

/** 日付で絞り込むとき：その日の各店の枠の状態を計算する */
async function daySlotsFor(listings: ListingFull[], date: string) {
  const booked = await bookedCounts(
    listings.map((l) => l.id),
    date,
    date,
  );
  const now = new Date();
  return new Map(listings.map((l) => [l.id, dayAvailability(bookingConfig(l), date, booked.get(`${l.id}|${date}`) ?? new Map(), now).slots]));
}

const HereSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export function travelerRoutes(r: Router) {
  r.get('/fx', async () => getRates());

  // 写真（data URL で保存したものを画像として返す）。URL に更新日時が入っているので長くキャッシュしてよい
  r.get('/photos/:id/:i', async (ctx) => {
    const l = await prisma.listing.findUnique({ where: { id: ctx.params.id }, select: { photos: true } });
    const src = l?.photos[Number(ctx.params.i)];
    const m = src && /^data:(image\/(?:jpeg|png|webp|svg\+xml));base64,(.+)$/.exec(src);
    if (!l || !m) throw new HttpError(404, 'not_found');
    const buf = Buffer.from(m[2], 'base64');
    ctx.res.statusCode = 200;
    ctx.res.setHeader('Content-Type', m[1]);
    ctx.res.setHeader('Content-Length', buf.length);
    ctx.res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // SVG の中にスクリプトがあっても動かないようにする
    ctx.res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    ctx.res.setHeader('X-Content-Type-Options', 'nosniff');
    ctx.res.end(buf);
    return RAW;
  });

  // レビューの写真（公開。非表示にしたレビューのものは出さない）
  r.get('/review-photos/:id/:i', (ctx) => serveReviewPhoto(ctx, ctx.params.id, Number(ctx.params.i) || 0));

  // お店のページの下：評価の内訳・レビュー一覧・レビューした人の傾向
  r.get('/listings/:id/reviews', async (ctx) => {
    const l = await publishedListing(ctx.params.id);
    return reviewSummary(l.id);
  });

  // チャットの写真（会話の当事者だけ）
  r.get('/chat-photos/:id', (ctx) => serveChatPhoto(ctx, ctx.params.id));

  // 探す：絞り込みとおすすめ（評価順。評価のない新しいお店は中ほど）。0件のときは条件を一つ外した場合の件数も返す
  r.post('/listings/search', async (ctx) => {
    const b = parse(
      z.object({
        lang: z.enum(LANGS).default('en'),
        filters: FiltersSchema.default({}),
        prefs: PrefsSchema.optional(),
        sort: z.enum(SORTS).default('recommended'),
        here: HereSchema.optional(),
      }),
      ctx.body,
    );
    const swept = sweep();
    const all = await prisma.listing.findMany({ where: { status: 'PUBLISHED' }, include: listingInclude });
    const ids = all.map((l) => l.id);
    const [ratings, days] = await Promise.all([ratingStats(ids), b.filters.date ? daySlotsFor(all, b.filters.date) : null, swept]);
    // 現在地がなければ、エリアを1つに絞ったときはそのエリアの中心からの距離を使う
    const here = b.here ?? (b.filters.area?.length === 1 ? AREA_CENTERS[b.filters.area[0]] : undefined);
    const result = search(
      all.map((l) => toSearchListing(l, ratings.get(l.id)!, days?.get(l.id))),
      { filters: b.filters, prefs: b.prefs, sort: b.sort, here },
    );
    const byId = new Map(all.map((l) => [l.id, l]));
    const hits = new Map<string, SearchHit>(result.hits.map((h) => [h.id, h]));
    const found = result.hits.map((h) => byId.get(h.id)!);
    return {
      results: await listingCards(found, b.lang, ratings, hits, await cardAvailability(found, b.filters.date)),
      total: all.length,
      relax: result.relax,
    };
  });

  r.get('/listings/:id', async (ctx) => {
    const [l, u] = await Promise.all([publishedListing(ctx.params.id), currentUser(ctx)]);
    const [detail, saved] = await Promise.all([
      listingDetail(l, langOf(ctx.query)),
      u ? prisma.savedListing.findUnique({ where: { userId_listingId: { userId: u.id, listingId: l.id } } }).then(Boolean) : false,
    ]);
    return { ...detail, saved };
  });

  // 予約カレンダー：日ごとに選べるか、時間枠ごとの残り人数
  r.get('/listings/:id/availability', async (ctx) => {
    const l = await publishedListing(ctx.params.id);
    const today = jstDateString();
    const from = ctx.query.get('from') ?? today;
    if (!isValidDateString(from)) throw new HttpError(400, 'invalid_date');
    const start = from < today ? today : from;
    const days = Math.min(42, Math.max(1, Number(ctx.query.get('days')) || 35));
    return { from: start, today, days: await availabilityRange(l, start, days) };
  });

  // 満席・お店の都合によるキャンセルのときの代替案：同じカテゴリで、その日に空きのある近くの店
  r.get('/listings/:id/alternatives', async (ctx) => {
    const lang = langOf(ctx.query);
    const date = ctx.query.get('date');
    if (date && !isValidDateString(date)) throw new HttpError(400, 'invalid_date');
    const base = await prisma.listing.findUnique({ where: { id: ctx.params.id } });
    if (!base) throw new HttpError(404, 'not_found');
    const cands = await prisma.listing.findMany({ where: { status: 'PUBLISHED', category: base.category, id: { not: base.id } }, include: listingInclude });
    const days = date ? await daySlotsFor(cands, date) : null;
    const ok = cands.filter((l) => slotsOf(l).length && (!days || days.get(l.id)!.some((s) => s.open)));
    const center = base.lat != null && base.lng != null ? { lat: base.lat, lng: base.lng } : isArea(base.area) ? AREA_CENTERS[base.area] : null;
    const dist = (l: Listing) => (center && l.lat != null && l.lng != null ? distanceKm(center, { lat: l.lat, lng: l.lng }) : l.area === base.area ? 0 : 999);
    const top = ok.sort((a, b) => dist(a) - dist(b)).slice(0, 5);
    return { date, results: await listingCards(top, lang, await ratingStats(top.map((l) => l.id))) };
  });

  // 「この店舗を報告」：運営が管理画面で確認する
  r.post('/listings/:id/report', async (ctx) => {
    const u = await currentUser(ctx);
    const b = parse(z.object({ reason: z.string().trim().min(1).max(LIMITS.reportMaxChars) }), ctx.body);
    const l = await prisma.listing.findUnique({ where: { id: ctx.params.id } });
    if (!l) throw new HttpError(404, 'not_found');
    const dup = await prisma.listingReport.findFirst({
      where: u ? { listingId: l.id, userId: u.id } : { listingId: l.id, userId: null, reason: b.reason, status: 'OPEN' },
    });
    if (!dup) await prisma.listingReport.create({ data: { listingId: l.id, userId: u?.id, reason: b.reason } });
    return { ok: true };
  });

  // キャラクターのAI：希望を絞り込み条件に置き換える（キャラクターが出ている間だけ呼ばれる）
  r.post('/ai/wish', async (ctx) => {
    const b = parse(z.object({ text: z.string().trim().min(1).max(LIMITS.aiInputMaxChars), lang: z.enum(LANGS) }), ctx.body);
    return wishToFilters(b.text, b.lang);
  });

  // キャラクターのAI：質疑応答（店ごとの質問は店の情報から、なければ問い合わせを提案。全体的な質問は一般的な傾向として）
  r.post('/ai/ask', async (ctx) => {
    const b = parse(z.object({ question: z.string().trim().min(1).max(LIMITS.aiInputMaxChars), lang: z.enum(LANGS), listingId: z.string().max(40).optional() }), ctx.body);
    if (b.listingId) {
      const l = await publishedListing(b.listingId);
      const shop = await answerShopQuestion(b.question, shopInfoForAi(l), b.lang);
      if (shop.known) return { scope: 'shop', known: true, answer: shop.answer };
      const general = await answerGeneralQuestion(b.question, b.lang);
      if (general.answer && general.faqId) return { scope: 'general', known: true, answer: general.answer };
      return { scope: 'shop', known: false, answer: '' };
    }
    const g = await answerGeneralQuestion(b.question, b.lang);
    return { scope: 'general', known: !!g.answer, answer: g.answer ?? '' };
  });

  // 保存リスト
  r.get('/saved', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    const saved = await prisma.savedListing.findMany({ where: { userId: u.id, listing: { status: 'PUBLISHED' } }, include: { listing: true }, orderBy: { createdAt: 'desc' } });
    const listings = saved.map((s) => s.listing);
    return { results: await listingCards(listings, langOf(ctx.query), await ratingStats(listings.map((l) => l.id))) };
  });
  r.post('/saved/:id', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    await publishedListing(ctx.params.id);
    await prisma.savedListing.upsert({ where: { userId_listingId: { userId: u.id, listingId: ctx.params.id } }, create: { userId: u.id, listingId: ctx.params.id }, update: {} });
    return { saved: true };
  });
  r.delete('/saved/:id', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    await prisma.savedListing.deleteMany({ where: { userId: u.id, listingId: ctx.params.id } });
    return { saved: false };
  });

  // 予約：時間枠の上限人数内なら即時確定（カードは登録のみ）
  r.post('/reservations', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    const b = parse(
      z.object({
        listingId: z.string().max(40),
        date: z.string().refine(isValidDateString),
        time: z.string().refine(isValidTimeString),
        partySize: z.number().int().min(1).max(LIMITS.partyMax),
        dietary: z.array(z.enum(DIETARY)).max(DIETARY.length).default([]),
        message: z.string().trim().max(LIMITS.messageMaxChars).default(''),
        policyAgreed: z.literal(true),
      }),
      ctx.body,
    );
    if (!u.cardRegisteredAt) throw new HttpError(403, 'card_required');
    const l = await publishedListing(b.listingId);
    if (await blocked(l.businessId, u.id)) throw new HttpError(403, 'blocked');
    const slot = slotsOf(l).find((s) => s.time === b.time);
    if (!slot) throw new HttpError(400, 'invalid_time');
    if (b.partySize < l.minParticipants) throw new HttpError(400, 'party_under_minimum', { min: l.minParticipants });
    const lang = userLang(u.lang);
    // 表示言語と違う言語で書かれていても訳せるよう、書かれた文字から言語を判定する
    const messageJa = b.message ? (await translateOne(b.message, detectLang(b.message, lang), 'ja')).text : '';
    const now = new Date();
    const visitAt = jstToDate(b.date, b.time);

    // 確定時に残り人数を再確認する。同じ枠への同時の予約は、枠ごとのロックで順番に処理する
    const res = await prisma.$transaction(async (tx) => {
      // ロックは常に「旅行者 → 枠」の順に取る（デッドロックを避ける）
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`traveler|${u.id}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${l.id}|${b.date}|${b.time}`}))`;
      const future = await tx.reservation.count({ where: { travelerId: u.id, status: 'CONFIRMED', visitAt: { gt: now } } });
      if (future >= LIMITS.futureReservationsPerTraveler) throw new HttpError(429, 'too_many_reservations', { max: LIMITS.futureReservationsPerTraveler });
      const rows = await tx.reservation.groupBy({ by: ['time'], where: { listingId: l.id, date: b.date, status: 'CONFIRMED' }, _sum: { partySize: true } });
      const booked = new Map(rows.map((x) => [x.time, x._sum.partySize ?? 0]));
      const day = dayAvailability(bookingConfig(l), b.date, booked, now);
      const s = day.slots.find((x) => x.time === b.time);
      if (!s || !s.open) throw new HttpError(409, day.state === 'open' || day.state === 'full' ? 'full' : 'not_bookable', { state: day.state });
      if (b.partySize > s.remaining) throw new HttpError(409, 'full', { remaining: s.remaining });
      return tx.reservation.create({
        data: {
          travelerId: u.id,
          listingId: l.id,
          date: b.date,
          time: b.time,
          visitAt,
          partySize: b.partySize,
          dietary: [...new Set(b.dietary)],
          message: b.message,
          messageLang: lang,
          messageJa,
          payJpy: (l.priceJpy ?? 0) * b.partySize,
          freeCancel: l.freeCancel,
          lateFeeJpy: l.lateFeeJpy,
          cancelDeadlineAt: freeCancelUntil(l.freeCancel, b.date, b.time),
          policyAgreedAt: now,
        },
      });
    });

    // 確定後の通知で失敗しても、予約は確定済みとして返す（再送による二重予約を防ぐ）
    await notifyBooked(res, l, u, lang, messageJa).catch((e) => console.error('booking notice failed', e));
    return { id: res.id };
  });

  // マイ予約
  r.get('/reservations', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    const lang = langOf(ctx.query);
    const list = await prisma.reservation.findMany({ where: { travelerId: u.id }, include: { listing: true, review: true }, orderBy: { visitAt: 'desc' }, take: 100 });
    const names = await translateMany(
      list.map((x) => x.listing.nameJa),
      'ja',
      lang,
    );
    const now = new Date();
    return {
      results: list.map((x, i) => ({
        id: x.id,
        status: displayStatus(x, now),
        date: x.date,
        time: x.time,
        partySize: x.partySize,
        listingId: x.listingId,
        shop: names[i].text,
        photo: photoUrl(x.listing),
        upcoming: x.status === 'CONFIRMED' && x.visitAt > now,
        canReview: canReview(x, now),
      })),
    };
  });

  r.get('/reservations/:id', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    const x = await prisma.reservation.findUnique({ where: { id: ctx.params.id }, include: { listing: true, review: true } });
    if (!x || x.travelerId !== u.id) throw new HttpError(404, 'not_found');
    return reservationView(x, langOf(ctx.query));
  });

  // キャンセル：期限内は無料。期限後はキャンセル料（設定があれば）を記録する。枠は自動で空く
  r.post('/reservations/:id/cancel', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    const b = parse(z.object({ confirmLate: z.boolean().default(false) }), ctx.body);
    const x = await prisma.reservation.findUnique({ where: { id: ctx.params.id }, include: { listing: true } });
    if (!x || x.travelerId !== u.id) throw new HttpError(404, 'not_found');
    const now = new Date();
    if (x.status !== 'CONFIRMED' || x.visitAt <= now) throw new HttpError(400, 'invalid_status');
    const terms = cancelTerms(x, now);
    // 確認画面を出した後に期限を過ぎた場合は、もう一度確認してもらう
    if (terms.late && !b.confirmLate) throw new HttpError(409, 'late_cancel', { feeJpy: terms.feeJpy });
    const { count } = await prisma.reservation.updateMany({
      where: { id: x.id, status: 'CONFIRMED' },
      data: { status: 'CANCELED_BY_TRAVELER', canceledAt: now, lateCancel: terms.late, cancelFeeJpy: terms.late ? terms.feeJpy : null },
    });
    if (!count) throw new HttpError(409, 'conflict');
    await cancelReservationNotices(x.id);
    const lang = userLang(u.lang);
    const shop = (await translateOne(x.listing.nameJa, 'ja', lang)).text;
    await sendMail({
      to: u.email,
      kind: 'travelerCanceled',
      ...travelerMail(lang, 'travelerCanceled', { shop, when: whenText(x), fee: terms.feeJpy ? yen(terms.feeJpy) : undefined, url: appUrl(`/${lang}/bookings/${x.id}`) }),
    });
    await notifyBusiness(x.listing.businessId, {
      type: 'bizTravelerCanceled',
      title: `【キャンセル】${x.date} ${x.time} ${x.partySize}名`,
      body:
        `${x.listing.nameJa}：${u.name}さんが ${whenText(x)}（${x.partySize}名）の予約をキャンセルしました。枠は自動で空きました。` +
        (terms.late ? `\n無料キャンセルの期限後のキャンセルです${terms.feeJpy ? `（キャンセル料の目安 ${yen(terms.feeJpy)}。請求は運営が判断します）` : ''}。` : ''),
      path: `/biz/reservations/${x.id}`,
    });
    return { ok: true, late: terms.late, feeJpy: terms.feeJpy };
  });

  // 来店後の評価：来店済みの予約だけ、1予約につき1件。星・タグ・写真（自由記述なし）と、任意の「あなたについて」
  r.post('/reservations/:id/review', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    const b = parse(ReviewInput, ctx.body);
    const x = await prisma.reservation.findUnique({ where: { id: ctx.params.id }, include: { review: true } });
    if (!x || x.travelerId !== u.id) throw new HttpError(404, 'not_found');
    if (x.review) throw new HttpError(409, 'already_reviewed');
    if (!canReview(x)) throw new HttpError(400, 'not_reviewable');
    await prisma.review.create({
      data: {
        reservationId: x.id,
        listingId: x.listingId,
        stars: b.stars,
        tags: [...new Set(b.tags)],
        photoCount: b.photos.length,
        photos: { create: b.photos.map((data, idx) => ({ idx, data })) },
        // 同意があるときだけ保存する
        ...(b.profileConsent ? { country: b.country ?? null, religion: b.religion ?? null, gender: b.gender ?? null, ageBand: b.ageBand ?? null, scene: b.scene ?? null } : {}),
      },
    });
    return { ok: true };
  });

  // チャット（旅行者 × 店舗ごとに1スレッド）
  r.get('/conversations', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    const lang = langOf(ctx.query);
    const list = await prisma.conversation.findMany({
      where: { travelerId: u.id, messages: { some: {} } },
      include: { listing: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
    const names = await translateMany(
      list.map((c) => c.listing.nameJa),
      'ja',
      lang,
    );
    const unread = await prisma.message.groupBy({ by: ['conversationId'], where: { conversation: { travelerId: u.id }, senderRole: 'BUSINESS', readAt: null }, _count: { _all: true } });
    const unreadMap = new Map(unread.map((x) => [x.conversationId, x._count._all]));
    return {
      results: list.map((c, i) => ({ listingId: c.listingId, shop: names[i].text, photo: photoUrl(c.listing), lastAt: c.messages[0]?.createdAt ?? c.updatedAt, unread: unreadMap.get(c.id) ?? 0 })),
      unreadTotal: [...unreadMap.values()].reduce((a, b) => a + b, 0),
    };
  });

  r.get('/listings/:id/chat', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    const lang = langOf(ctx.query);
    const l = await prisma.listing.findUnique({ where: { id: ctx.params.id } });
    if (!l) throw new HttpError(404, 'not_found');
    const c = await prisma.conversation.findUnique({
      where: { travelerId_listingId: { travelerId: u.id, listingId: l.id } },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 300 } },
    });
    // 予約前の問い合わせは公開中の店だけ。予約後や過去のやり取りは、店が非公開になっても読める
    if (!c && l.status !== 'PUBLISHED') throw new HttpError(404, 'not_found');
    if (c) await prisma.message.updateMany({ where: { conversationId: c.id, senderRole: 'BUSINESS', readAt: null }, data: { readAt: new Date() } });
    // 表示言語を後から変えた場合に備え、事業者のメッセージは今の表示言語に訳し直す（キャッシュされる）
    const biz = c?.messages.filter((m) => m.senderRole === 'BUSINESS') ?? [];
    const tr = await translateMany(
      biz.map((m) => m.body),
      'ja',
      lang,
    );
    const trMap = new Map(biz.map((m, i) => [m.id, tr[i]]));
    const shop = await translateOne(l.nameJa, 'ja', lang);
    return {
      listingId: l.id,
      shop: shop.text,
      canSend: l.status === 'PUBLISHED' || !!c,
      blocked: await blocked(l.businessId, u.id),
      messages: (c?.messages ?? []).map((m) =>
        m.senderRole === 'TRAVELER'
          ? { id: m.id, fromMe: true, text: m.body, original: m.body, machine: false, photo: chatPhotoUrl(m), at: m.createdAt }
          : { id: m.id, fromMe: false, text: trMap.get(m.id)!.text, original: m.body, machine: trMap.get(m.id)!.machine, photo: chatPhotoUrl(m), at: m.createdAt },
      ),
    };
  });

  r.post('/listings/:id/chat', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    const b = parse(ChatInput, ctx.body);
    const l = await prisma.listing.findUnique({ where: { id: ctx.params.id } });
    if (!l) throw new HttpError(404, 'not_found');
    if (await blocked(l.businessId, u.id)) throw new HttpError(403, 'blocked');
    let c = await prisma.conversation.findUnique({ where: { travelerId_listingId: { travelerId: u.id, listingId: l.id } } });
    if (!c) {
      if (l.status !== 'PUBLISHED') throw new HttpError(404, 'not_found');
      c = await prisma.conversation.create({ data: { travelerId: u.id, listingId: l.id } });
    }
    const lang = userLang(u.lang);
    const from = detectLang(b.text, lang);
    const t = b.text ? await translateOne(b.text, from, 'ja') : { text: '', machine: false };
    // 未読がたまっている間は通知を重ねて送らない
    const unreadBefore = await prisma.message.count({ where: { conversationId: c.id, senderRole: 'TRAVELER', readAt: null } });
    await prisma.message.create({
      data: {
        conversationId: c.id,
        senderRole: 'TRAVELER',
        body: b.text,
        lang: from,
        translated: t.text,
        translatedLang: 'ja',
        hasPhoto: !!b.photo,
        ...(b.photo ? { photo: { create: { data: b.photo } } } : {}),
      },
    });
    await prisma.conversation.update({ where: { id: c.id }, data: { updatedAt: new Date() } });
    if (!unreadBefore) {
      await notifyBusiness(l.businessId, {
        type: 'bizNewMessage',
        title: `【メッセージ】${u.name}さんから`,
        body: t.text
          ? `${l.nameJa} への新しいメッセージ（日本語訳）：「${t.text.slice(0, 200)}」${b.photo ? '（写真つき）' : ''}`
          : `${l.nameJa} に写真が届きました。`,
        path: `/biz/messages/${c.id}`,
      });
    }
    return { ok: true };
  });

  // アプリ内の通知（時刻が来たものだけ）
  r.get('/notifications', async (ctx) => {
    const u = await requireUser(ctx);
    void sweep();
    const list = await prisma.notification.findMany({ where: { userId: u.id, visibleAt: { lte: new Date() } }, orderBy: { visibleAt: 'desc' }, take: 50 });
    const unreadMessages = await prisma.message.count({ where: { conversation: { travelerId: u.id }, senderRole: 'BUSINESS', readAt: null } });
    return {
      results: list.map((n) => ({ id: n.id, type: n.type, payload: n.payload, at: n.visibleAt, read: !!n.readAt })),
      unread: list.filter((n) => !n.readAt).length,
      unreadMessages,
    };
  });
  r.post('/notifications/read', async (ctx) => {
    const u = await requireUser(ctx);
    await prisma.notification.updateMany({ where: { userId: u.id, readAt: null, visibleAt: { lte: new Date() } }, data: { readAt: new Date() } });
    return { ok: true };
  });

  // 「翻訳がおかしい」ボタン（旅行者・事業者の両方）
  r.post('/translation-report', async (ctx) => {
    const u = await currentUser(ctx);
    const b = parse(
      z.object({ source: z.string().max(2000), shown: z.string().max(2000), targetLang: z.string().max(5), context: z.string().max(100).default('') }),
      ctx.body,
    );
    // 同じ訳への報告がまだ対応前なら、1件にまとめる
    if (await prisma.translationReport.findFirst({ where: { source: b.source, shown: b.shown, targetLang: b.targetLang, status: 'OPEN' }, select: { id: true } })) return { ok: true };
    await prisma.translationReport.create({ data: { userId: u?.id, source: b.source, shown: b.shown, targetLang: b.targetLang, context: b.context } });
    return { ok: true };
  });
}

/** 来店済み（来店時刻を過ぎた確定済み）で、評価がまだで、来店から30日以内 */
function canReview(x: Reservation & { review: Review | null }, now = new Date()) {
  return x.status === 'CONFIRMED' && x.visitAt <= now && !x.review && now.getTime() - x.visitAt.getTime() < LIMITS.reviewDays * 86_400_000;
}

/** 予約確定のメール・通知（旅行者・事業者）と、リマインドなどの送信予約 */
async function notifyBooked(res: Reservation, l: ListingFull, u: { id: string; email: string; name: string; lang: string }, lang: Lang, messageJa: string) {
  const shop = (await translateOne(l.nameJa, 'ja', lang)).text;
  await sendMail({
    to: u.email,
    kind: 'bookingConfirmed',
    ...travelerMail(lang, 'bookingConfirmed', {
      shop,
      when: whenText(res),
      party: res.partySize,
      address: l.address,
      pay: `${yen(res.payJpy)}${l.paymentMethod ? ` (${PAY_TEXT[l.paymentMethod][lang]})` : ''}`,
      deadline: deadlineText(res.cancelDeadlineAt),
      url: appUrl(`/${lang}/bookings/${res.id}`),
    }),
  });
  // 先にリマインドなどを用意する（事業者が通知を見てすぐキャンセルしても、取り消せるように）
  await scheduleReservationNotices(res, l, u);
  const sameDay = res.date === jstDateString();
  await notifyBusiness(l.businessId, {
    type: 'bizNewReservation',
    title: `${sameDay ? '【当日の予約】' : '【新しい予約】'}${res.date} ${res.time} ${res.partySize}名`,
    body:
      `${l.nameJa} に予約が入りました（確定済み）。\n日時：${whenText(res)}\n人数：${res.partySize}名\nお名前：${u.name}` +
      (res.dietary.length ? `\n食事制限：${res.dietary.map((d) => DIETARY_JA[d as Dietary] ?? d).join('、')}` : '') +
      (messageJa ? `\nメッセージ（日本語訳）：${messageJa}` : ''),
    path: `/biz/reservations/${res.id}`,
    urgent: sameDay,
  });
}

/** 予約の詳細（確定画面・マイ予約） */
async function reservationView(x: Reservation & { listing: Listing; review: Review | null }, lang: Lang) {
  const l = x.listing;
  const tr = await translateMany([l.nameJa, l.meetingPointJa, l.itemsToBringJa, x.bizCancelNoteJa, l.dressJa], 'ja', lang);
  const now = new Date();
  const terms = cancelTerms(x, now);
  const tt = (i: number, original: string) => ({ text: tr[i].text, original, machine: tr[i].machine });
  return {
    id: x.id,
    status: displayStatus(x, now),
    date: x.date,
    time: x.time,
    partySize: x.partySize,
    dietary: x.dietary,
    message: x.message,
    payJpy: x.payJpy,
    freeCancel: x.freeCancel,
    lateFeeJpy: x.lateFeeJpy,
    cancelDeadlineAt: x.cancelDeadlineAt,
    canCancel: x.status === 'CONFIRMED' && x.visitAt > now,
    cancelNow: { late: terms.late, feeJpy: terms.feeJpy },
    lateCancel: x.lateCancel,
    cancelFeeJpy: x.cancelFeeJpy,
    bizCancelReason: x.bizCancelReason ? BIZ_REASON_TEXT[x.bizCancelReason][lang] : null,
    bizCancelNote: x.bizCancelNoteJa ? tt(3, x.bizCancelNoteJa) : null,
    review: x.review ? { stars: x.review.stars, tags: x.review.tags, photos: reviewPhotoUrls(x.review) } : null,
    canReview: canReview(x, now),
    listing: {
      id: l.id,
      name: tt(0, l.nameJa),
      nameJa: l.nameJa,
      category: l.category,
      address: l.address,
      lat: l.lat,
      lng: l.lng,
      area: areaLabel(l.area, lang),
      paymentMethod: l.paymentMethod,
      photo: photoUrl(l),
      meetingPoint: tt(1, l.meetingPointJa),
      itemsToBring: tt(2, l.itemsToBringJa),
      dress: tt(4, l.dressJa),
    },
  };
}
