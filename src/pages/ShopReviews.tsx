// お店のページの下：評価の内訳、レビュー一覧（写真つき）、レビューした人の傾向（任意回答の集計）
import { useEffect, useState } from 'react';
import { get } from '../api';
import { REVIEWER_FIELDS, type ReviewerField } from '../../shared/constants';
import { Bars } from '../components/Bars';
import { useApp } from '../store';

type Key = Parameters<ReturnType<typeof useApp>['t']>[0];

interface Bar {
  key: string;
  count: number;
}

interface Summary {
  count: number;
  avg: number | null;
  dist: Bar[];
  reviews: { id: string; stars: number; tags: string[]; photos: string[]; visitedMonth: string }[];
  reviewers: Record<ReviewerField, { answered: number; bars: Bar[] } | null>;
  reviewerStatsMin: number;
}

const FIELD_TITLE: Record<ReviewerField, Key> = { country: 'f_country', religion: 'f_religion', gender: 'f_gender', ageBand: 'f_age', scene: 'f_scene' };
const FIELD_PREFIX: Record<Exclude<ReviewerField, 'country'>, string> = { religion: 'religion_', gender: 'gender_', ageBand: 'age_', scene: 'trip_' };

/** 国・地域名をその言語で（ブラウザの機能を使う） */
export function countryName(code: string, lang: string, otherLabel: string) {
  if (code === 'OTHER') return otherLabel;
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function ShopReviews({ listingId }: { listingId: string }) {
  const { t, lang } = useApp();
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    let alive = true;
    get<Summary>(`/listings/${listingId}/reviews`)
      .then((r) => alive && setS(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [listingId]);
  if (!s) return null;

  const label = (field: ReviewerField, key: string) => (field === 'country' ? countryName(key, lang, t('country_OTHER')) : t(`${FIELD_PREFIX[field]}${key}` as Key));
  const shownFields = REVIEWER_FIELDS.filter((f) => s.reviewers[f]);
  const month = (ym: string) => new Date(`${ym}-01T00:00:00+09:00`).toLocaleDateString(lang, { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'short' });

  return (
    <section className="shop-reviews stack" aria-labelledby="reviews-title">
      <h2 id="reviews-title">
        {t('reviewsTitle')}
        {s.avg != null && (
          <span className="reviews-avg">
            {' '}
            ★ {s.avg.toFixed(1)} <span className="small muted">({t('ratingsCount', { n: s.count })})</span>
          </span>
        )}
      </h2>
      {s.count === 0 ? (
        <p className="muted small">{t('reviewsNone')}</p>
      ) : (
        <>
          <Bars title={t('ratingDist')} rows={s.dist.map((b) => ({ key: b.key, label: `★${b.key}`, count: b.count }))} total={s.count} unit={(n) => t('ratingsCount', { n })} />

          <div className="stack-s">
            <h3>{t('reviewersTitle')}</h3>
            <p className="small muted">{t('reviewersNote', { n: s.reviewerStatsMin })}</p>
            {shownFields.length === 0 ? (
              <p className="small muted">{t('reviewersNotEnough')}</p>
            ) : (
              <div className="bars-grid">
                {shownFields.map((f) => {
                  const r = s.reviewers[f]!;
                  return (
                    <Bars
                      key={f}
                      title={t(FIELD_TITLE[f])}
                      note={t('answersCount', { n: r.answered })}
                      rows={r.bars.map((b) => ({ key: b.key, label: label(f, b.key), count: b.count }))}
                      total={r.answered}
                      unit={(n) => t('answersCount', { n })}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <ul className="review-list">
            {s.reviews.map((r) => (
              <li key={r.id} className="review-item stack-s">
                <div className="row gap-s">
                  <span className="review-stars" aria-label={t('starsOf', { n: r.stars })}>
                    {'★'.repeat(r.stars)}
                    <span className="muted">{'★'.repeat(5 - r.stars)}</span>
                  </span>
                  <span className="small muted">{t('visitedIn', { month: month(r.visitedMonth) })}</span>
                </div>
                {r.tags.length > 0 && (
                  <ul className="chips">
                    {r.tags.map((x) => (
                      <li key={x} className="chip small">
                        {t(`tag_${x}` as Key)}
                      </li>
                    ))}
                  </ul>
                )}
                {r.photos.length > 0 && (
                  <div className="review-photos">
                    {r.photos.map((p) => (
                      <a key={p} href={p} target="_blank" rel="noreferrer">
                        <img src={p} alt={t('reviewPhotoAlt')} loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
