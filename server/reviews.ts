// レビュー：写真の配信と、お店のページに出す集計（評価の内訳・レビュー一覧・レビューした人の傾向）
import { z } from 'zod';
import {
  AGE_BANDS,
  LIMITS,
  REVIEW_COUNTRIES,
  REVIEW_GENDERS,
  REVIEW_RELIGIONS,
  REVIEW_TAGS,
  REVIEWER_FIELDS,
  TRAVEL_SCENES,
  type ReviewerField,
} from '../shared/constants.js';
import { currentUser } from './auth.js';
import { ChatPhoto } from './chatPhoto.js';
import { prisma } from './db.js';
import { HttpError, RAW, type Ctx } from './http.js';

export const ReviewInput = z
  .object({
    stars: z.number().int().min(1).max(5),
    tags: z.array(z.enum(REVIEW_TAGS)).max(REVIEW_TAGS.length),
    photos: z.array(ChatPhoto).max(LIMITS.reviewPhotosMax).default([]),
    country: z.enum(REVIEW_COUNTRIES).nullish(),
    religion: z.enum(REVIEW_RELIGIONS).nullish(),
    gender: z.enum(REVIEW_GENDERS).nullish(),
    ageBand: z.enum(AGE_BANDS).nullish(),
    scene: z.enum(TRAVEL_SCENES).nullish(),
    /** 「あなたについて」を集計して表示することへの同意（1つでも答えたときは必須） */
    profileConsent: z.boolean().default(false),
  })
  .refine((b) => b.profileConsent || REVIEWER_FIELDS.every((k) => !b[k]), { message: 'consent_required', path: ['profileConsent'] });

export const reviewPhotoUrls = (r: { id: string; photoCount: number }) => Array.from({ length: r.photoCount }, (_, i) => `/api/review-photos/${r.id}/${i}`);

/** レビューの写真。非表示にしたレビューの写真は運営だけが見られる */
export async function serveReviewPhoto(ctx: Ctx, reviewId: string, idx: number) {
  const p = await prisma.reviewPhoto.findUnique({ where: { reviewId_idx: { reviewId, idx } }, include: { review: { select: { hidden: true } } } });
  if (p?.review.hidden && (await currentUser(ctx))?.role !== 'ADMIN') throw new HttpError(404, 'not_found');
  const m = p && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(p.data);
  if (!m) throw new HttpError(404, 'not_found');
  const buf = Buffer.from(m[2], 'base64');
  ctx.res.statusCode = 200;
  ctx.res.setHeader('Content-Type', m[1]);
  ctx.res.setHeader('Content-Length', buf.length);
  // 非表示にされたら見えなくなるよう、長く置かせすぎない
  ctx.res.setHeader('Cache-Control', 'public, max-age=3600');
  ctx.res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  ctx.res.setHeader('X-Content-Type-Options', 'nosniff');
  ctx.res.end(buf);
  return RAW;
}

export interface Bar {
  key: string;
  count: number;
}

/** 多い順。国は上位5つまで出し、残りは「その他」にまとめる */
export function bars(values: string[], field: ReviewerField): Bar[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  if (field !== 'country') {
    const order: readonly string[] = { religion: REVIEW_RELIGIONS, gender: REVIEW_GENDERS, ageBand: AGE_BANDS, scene: TRAVEL_SCENES }[field];
    // 年代は年齢順、そのほかは多い順（同数なら選択肢の順）
    const keys = [...counts.keys()].sort((a, b) => (field === 'ageBand' ? 0 : counts.get(b)! - counts.get(a)!) || order.indexOf(a) - order.indexOf(b));
    return keys.map((key) => ({ key, count: counts.get(key)! }));
  }
  const sorted = [...counts.entries()].filter(([k]) => k !== 'OTHER').sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5).map(([key, count]) => ({ key, count }));
  const rest = sorted.slice(5).reduce((n, [, c]) => n + c, 0) + (counts.get('OTHER') ?? 0);
  return rest ? [...top, { key: 'OTHER', count: rest }] : top;
}

/** お店のページの下に出すレビューのまとめ */
export async function reviewSummary(listingId: string) {
  const list = await prisma.review.findMany({
    where: { listingId, hidden: false },
    include: { reservation: { select: { date: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const dist = [5, 4, 3, 2, 1].map((stars) => ({ key: String(stars), count: list.filter((r) => r.stars === stars).length }));
  const reviewers = Object.fromEntries(
    REVIEWER_FIELDS.map((field) => {
      const values = list.map((r) => r[field]).filter((v): v is string => !!v);
      // 回答が少ない項目は出さない（誰の回答か推測できてしまうため）
      return [field, values.length >= LIMITS.reviewerStatsMin ? { answered: values.length, bars: bars(values, field) } : null];
    }),
  ) as Record<ReviewerField, { answered: number; bars: Bar[] } | null>;
  return {
    count: list.length,
    avg: list.length ? Math.round((list.reduce((n, r) => n + r.stars, 0) / list.length) * 10) / 10 : null,
    dist,
    // 個々のレビューには「あなたについて」の回答を出さない
    reviews: list.slice(0, 30).map((r) => ({ id: r.id, stars: r.stars, tags: r.tags, photos: reviewPhotoUrls(r), visitedMonth: r.reservation.date.slice(0, 7) })),
    reviewers,
    reviewerStatsMin: LIMITS.reviewerStatsMin,
  };
}
