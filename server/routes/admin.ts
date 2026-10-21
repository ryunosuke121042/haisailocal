// 運営の最小限の管理画面：掲載の確認と非公開化（即公開のため、報告を受けて対応する）、予約とトラブルの確認、
// 翻訳エラー報告の確認、評価の確認と非表示（削除申出への対応を含む）、送ったメールの確認
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { prisma } from '../db.js';
import { reviewPhotoUrls } from '../reviews.js';
import { emailMode } from '../email.js';
import { HttpError, parse, type Router } from '../http.js';
import { missingFields } from '../listings.js';
import { cacheKey } from '../translate.js';
import type { Lang } from '../../shared/constants.js';

export function adminRoutes(r: Router) {
  r.get('/admin/overview', async (ctx) => {
    await requireUser(ctx, 'ADMIN');
    const [listings, reports, reservations, translationReports, reviews, emails] = await Promise.all([
      prisma.listing.findMany({ include: { business: true, _count: { select: { reports: true } } }, orderBy: { updatedAt: 'desc' }, take: 300 }),
      prisma.listingReport.findMany({ include: { listing: { select: { id: true, nameJa: true, status: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.reservation.findMany({ include: { listing: { select: { nameJa: true } }, traveler: { select: { email: true, name: true, lang: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.translationReport.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.review.findMany({ include: { listing: { select: { nameJa: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.emailOutbox.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    return {
      emailMode: emailMode(),
      listings: listings.map((l) => ({
        id: l.id,
        nameJa: l.nameJa,
        status: l.status,
        category: l.category,
        area: l.area,
        business: { id: l.businessId, name: l.business.name },
        reports: l._count.reports,
        halalCertified: l.halalCertified,
        updatedAt: l.updatedAt,
      })),
      reports: reports.map((x) => ({ id: x.id, reason: x.reason, status: x.status, createdAt: x.createdAt, listing: x.listing })),
      reservations: reservations.map((x) => ({
        id: x.id,
        status: x.status,
        listing: x.listing.nameJa,
        traveler: `${x.traveler.name} <${x.traveler.email}>`,
        date: x.date,
        time: x.time,
        partySize: x.partySize,
        lateCancel: x.lateCancel,
        cancelFeeJpy: x.cancelFeeJpy,
        lateFeeJpy: x.lateFeeJpy,
        createdAt: x.createdAt,
      })),
      translationReports,
      reviews: reviews.map((v) => ({
        id: v.id,
        listing: v.listing.nameJa,
        stars: v.stars,
        tags: v.tags,
        photos: reviewPhotoUrls(v),
        hidden: v.hidden,
        takedownReason: v.takedownReason,
        takedownAt: v.takedownAt,
        createdAt: v.createdAt,
      })),
      emails,
    };
  });

  // 掲載の非公開化（運営）と再公開。運営が止めた掲載は、事業者からは公開に戻せない
  r.post('/admin/listings/:id/:action', async (ctx) => {
    await requireUser(ctx, 'ADMIN');
    const action = parse(z.enum(['suspend', 'restore']), ctx.params.action);
    const l = await prisma.listing.findUnique({ where: { id: ctx.params.id } });
    if (!l) throw new HttpError(404, 'not_found');
    if (action === 'restore' && l.status !== 'SUSPENDED') throw new HttpError(400, 'invalid_status');
    if (action === 'suspend' && l.status === 'SUSPENDED') throw new HttpError(400, 'invalid_status');
    // 再公開：止めている間に必須項目が消えていたら、公開せず下書きに戻す
    const status = action === 'suspend' ? 'SUSPENDED' : missingFields(l).length ? 'DRAFT' : 'PUBLISHED';
    await prisma.listing.update({ where: { id: l.id }, data: { status, publishedAt: status === 'PUBLISHED' ? (l.publishedAt ?? new Date()) : l.publishedAt } });
    await prisma.notification.create({
      data: {
        businessId: l.businessId,
        type: 'bizAdmin',
        payload: {
          title: action === 'suspend' ? '掲載が運営により非公開になりました' : status === 'PUBLISHED' ? '掲載が再び公開されました' : '掲載の停止を解除しました（下書きに戻しました）',
          body: `${l.nameJa}${action === 'suspend' ? '：内容の確認のため、運営から連絡します。' : ''}`,
          path: `/biz/listing/${l.id}`,
        },
      },
    });
    return { status };
  });

  r.post('/admin/reports/:id/close', async (ctx) => {
    await requireUser(ctx, 'ADMIN');
    const { count } = await prisma.listingReport.updateMany({ where: { id: ctx.params.id }, data: { status: 'DONE' } });
    if (!count) throw new HttpError(404, 'not_found');
    return { ok: true };
  });

  r.post('/admin/reviews/:id/visibility', async (ctx) => {
    await requireUser(ctx, 'ADMIN');
    const b = parse(z.object({ hidden: z.boolean() }), ctx.body);
    const { count } = await prisma.review.updateMany({ where: { id: ctx.params.id }, data: { hidden: b.hidden } });
    if (!count) throw new HttpError(404, 'not_found');
    return { ok: true };
  });

  // 翻訳エラー報告：対応済みにする。必要なら翻訳キャッシュを消し、次回は翻訳し直す
  r.post('/admin/translation-reports/:id/close', async (ctx) => {
    await requireUser(ctx, 'ADMIN');
    const b = parse(z.object({ retranslate: z.boolean().default(false), from: z.enum(['ja', 'en', 'zh', 'ko', 'fr', 'es']).default('ja') }), ctx.body ?? {});
    const t = await prisma.translationReport.findUnique({ where: { id: ctx.params.id } });
    if (!t) throw new HttpError(404, 'not_found');
    if (b.retranslate) await prisma.translation.deleteMany({ where: { key: cacheKey(t.source, b.from as Lang, t.targetLang as Lang) } });
    await prisma.translationReport.update({ where: { id: t.id }, data: { status: 'DONE' } });
    return { ok: true };
  });
}
