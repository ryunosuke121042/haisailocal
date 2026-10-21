// 詳細ページ（表示言語に自動翻訳）。「質問する」「予約する」はどちらも押した時点でログインを求める
import { Fragment, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ALLERGENS, LIMITS, REVIEW_TAGS } from '../../shared/constants';
import { ApiError, del, get, post } from '../api';
import { useCharacter } from '../components/Character';
import { areaName, ErrorBox, FxNote, LocalInfoView, MapsButton, Money, Photo, Sheet, Spinner, Stars, TT, yen } from '../components/ui';
import { useApp } from '../store';
import type { Detail } from '../types';
import { replyText } from './List';
import { lazyWithReload } from '../lib/lazyReload';
import { ShopReviews } from './ShopReviews';

const MapView = lazyWithReload(() => import('../components/MapView').then((m) => ({ default: m.MapView })));

export function useLoginGate() {
  const { me, lang } = useApp();
  const nav = useNavigate();
  return (path: string) => {
    if (me?.role === 'TRAVELER') nav(path);
    else nav(`/${lang}/signup?next=${encodeURIComponent(path)}`);
  };
}

export function weekdayName(w: number, lang: string) {
  // 2023-01-01 は日曜日
  return new Date(Date.UTC(2023, 0, 1 + w)).toLocaleDateString(lang, { weekday: 'short', timeZone: 'UTC' });
}

export default function Shop() {
  const { id } = useParams();
  return <ShopDetail id={id!} />;
}

/** お店のページ。embedded のときは、探す画面の地図の上に重ねて開く（小さい地図は出さない） */
export function ShopDetail({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const { t, lang, me } = useApp();
  const loc = useLocation();
  const gate = useLoginGate();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<'notFound' | 'error' | null>(null);
  const [report, setReport] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setErr(null);
    get<Detail>(`/listings/${id}?lang=${lang}`)
      .then((r) => {
        setD(r);
        setSaved(r.saved);
      })
      .catch((e) => setErr(e instanceof ApiError && e.status === 404 ? 'notFound' : 'error'));
  }, [id, lang]);
  useEffect(load, [load]);

  // キャラクター：おすすめの理由を一言で伝える。店についての質問にも答える
  const reasons = (loc.state as { reasons?: string[] } | null)?.reasons ?? [];
  useCharacter({ line: d ? (reasons.length ? t('say_detailReason', { reasons: reasons.slice(0, 2).join(' · ') }) : t('say_detail')) : undefined, listingId: d?.id, enabled: !embedded });

  if (err === 'notFound')
    return (
      <div className="notice">
        {t('shopNotFound')} <Link to={`/${lang}`}>{t('backToList')}</Link>
      </div>
    );
  if (err) return <ErrorBox onRetry={load} />;
  if (!d) return <Spinner />;

  async function toggleSave() {
    if (me?.role !== 'TRAVELER') return gate(`/${lang}/shop/${d!.id}`);
    const next = !saved;
    setSaved(next);
    await (next ? post(`/saved/${d!.id}`) : del(`/saved/${d!.id}`)).catch(() => setSaved(!next));
  }

  const tags = REVIEW_TAGS.filter((x) => d.reviewTags[x]);
  return (
    <article className="detail stack">
      {d.photos.length > 0 ? (
        <div className="photos">
          {d.photos.map((p, i) => (
            <img key={i} src={p} alt="" loading={i ? 'lazy' : 'eager'} />
          ))}
        </div>
      ) : (
        <div className="shop-photo">
          <Photo src={null} alt="" />
        </div>
      )}
      <header className="stack-s">
        <div className="row gap-s">
          {d.category && <span className="badge badge-cat">{t(`cat_${d.category}`)}</span>}
          <span className="spacer" />
          <button className={`btn btn-small ${saved ? 'on' : ''}`} onClick={() => void toggleSave()} aria-pressed={saved}>
            {saved ? '♥' : '♡'} {saved ? t('saved') : t('save')}
          </button>
        </div>
        <h1>
          <TT v={d.name} context="shop name" />
        </h1>
        {lang !== 'ja' && <p className="ja-name">{d.nameJa}</p>}
        <p className="muted">{areaName(d.area, lang)}</p>
        <div className="row gap-s wrap">
          <Stars rating={d.rating} />
          {d.food.halalCertified && <span className="badge badge-halal">{t('halalMark')}</span>}
        </div>
        {tags.length > 0 && (
          <ul className="chips">
            {tags.map((x) => (
              <li key={x} className="chip">
                {t(`tag_${x}`)} ×{d.reviewTags[x]}
              </li>
            ))}
          </ul>
        )}
        {d.avgReplyMinutes != null && <p className="small muted">{t('avgReply', { time: replyText(d.avgReplyMinutes, t) })}</p>}
      </header>

      {d.appeal.text && (
        <section>
          <TT v={d.appeal} as="p" context="appeal" />
        </section>
      )}

      <section>
        <dl className="kv">
          {d.priceJpy != null && (
            <>
              <dt>{t('price')}</dt>
              <dd>
                <Money jpy={d.priceJpy} suffix={t('perPerson')} />
                <FxNote />
              </dd>
            </>
          )}
          {d.durationMin != null && (
            <>
              <dt>{t('duration')}</dt>
              <dd>{t('minutes', { n: d.durationMin })}</dd>
            </>
          )}
          {d.capacityMax != null && (
            <>
              <dt>{t('capacity')}</dt>
              <dd>{t('upToPeople', { n: d.capacityMax })}</dd>
            </>
          )}
          {d.paymentMethod && (
            <>
              <dt>{t('payment')}</dt>
              <dd>{t(`pay_${d.paymentMethod}`)}</dd>
            </>
          )}
          {d.languages.length > 0 && (
            <>
              <dt>{t('f_languages')}</dt>
              <dd>{d.languages.map((x) => t(`lang_${x as 'en'}`)).join(', ')}</dd>
            </>
          )}
          {d.soloWelcome && (
            <>
              <dt>{t('soloWelcome')}</dt>
              <dd>✓</dd>
            </>
          )}
          {d.dress.text && (
            <>
              <dt>{t('dress')}</dt>
              <dd>
                <TT v={d.dress} context="dress" />
              </dd>
            </>
          )}
          {d.extraInfo.map((x, i) => (
            <Fragment key={i}>
              {/* 項目名は短いので、翻訳の操作（原文を見る等）は内容の側だけに出す */}
              <dt title={x.label.machine ? x.label.original : undefined}>{x.label.text}</dt>
              <dd>
                <TT v={x.value} />
              </dd>
            </Fragment>
          ))}
          <dt>{t('address')}</dt>
          <dd>{d.address}</dd>
        </dl>
        {!embedded && d.lat != null && d.lng != null && (
          <Suspense fallback={null}>
            <MapView pins={[{ id: d.id, lat: d.lat, lng: d.lng, label: d.name.text }]} height={220} lang={lang} />
          </Suspense>
        )}
        <MapsButton lat={d.lat} lng={d.lng} address={d.address} />
      </section>

      <section>
        <h2>{t('localInfo')}</h2>
        <p className="small muted">{t('localInfoNote')}</p>
        <LocalInfoView info={d.local} station={d.stationMinutes != null ? t('stationMin', { station: d.station.text, n: d.stationMinutes }) : null} />
      </section>

      <section>
        <h2>{t('about')}</h2>
        <TT v={d.description} as="div" context="description" />
      </section>

      <FoodSection d={d} />
      <CategorySection d={d} />

      <section>
        <h2>{t('bookingRules')}</h2>
        <dl className="kv">
          {d.closedWeekdays.length > 0 && (
            <>
              <dt>{t('closedDays')}</dt>
              <dd>{d.closedWeekdays.map((w) => weekdayName(w, lang)).join(', ')}</dd>
            </>
          )}
          <dt>{t('cutoff')}</dt>
          <dd>{t(`cutoff_${d.cutoff}`)}</dd>
          <dt>{t('cancelPolicy')}</dt>
          <dd>
            {t(`freeCancel_${d.freeCancel}`)}
            <br />
            {d.lateFeeJpy ? t('lateFee', { amount: yen(d.lateFeeJpy) }) : t('noLateFee')}
          </dd>
        </dl>
        {!d.bookable && <p className="notice small">{t('chatOnlyLong')}</p>}
      </section>

      <ShopReviews listingId={d.id} />

      <p className="small">
        <button className="link small muted" onClick={() => setReport(true)}>
          {t('reportShop')}
        </button>
      </p>

      <div className="sticky-cta">
        <button className="btn" onClick={() => gate(`/${lang}/chat/${d.id}`)}>
          💬 {t('ask')}
        </button>
        {d.bookable && (
          <button className="btn btn-primary" onClick={() => gate(`/${lang}/shop/${d.id}/book`)}>
            {t('book')}
          </button>
        )}
      </div>
      <ReportSheet open={report} onClose={() => setReport(false)} listingId={d.id} />
    </article>
  );
}

/** 食べ物の情報：ハラルマーク（認証店だけ）、料理ごとのアレルギー物質、材料の調整。自己申告であることを添える */
function FoodSection({ d }: { d: Detail }) {
  const { t } = useApp();
  const f = d.food;
  const hasAny = f.halalCertified || f.porkFreeMention || f.dietSupport.length || f.allergenFreeShop.length || f.dishes.length || f.adjustLess || f.adjustRemove;
  if (!hasAny) return null;
  const used = ALLERGENS.filter((a) => f.dishes.some((x) => x.allergens.includes(a)) || f.allergenFreeShop.includes(a));
  return (
    <section>
      <h2>{t('food')}</h2>
      <ul className="chips">
        {f.halalCertified && <li className="chip badge-halal">{t('halalMark')}</li>}
        {!f.halalCertified && f.porkFreeMention && <li className="chip">{t('porkFreeRef')}</li>}
        {f.dietSupport.map((x) => (
          <li key={x} className="chip">
            {t(`diet_${x as 'vegan'}`)}
          </li>
        ))}
        {f.adjustLess && <li className="chip">{t('adjust_less')}</li>}
        {f.adjustRemove && <li className="chip">{t('adjust_remove')}</li>}
      </ul>
      {f.allergenFreeShop.length > 0 && (
        <p className="small">
          {t('allergenFreeShop')}: {f.allergenFreeShop.map((a) => t(`allergen_${a as 'egg'}`)).join(', ')}
        </p>
      )}
      {f.dishes.length > 0 && used.length > 0 && (
        <div className="table-wrap">
          <table className="allergens">
            <caption className="small muted">{t('allergenTable')}</caption>
            <thead>
              <tr>
                <th />
                {used.map((a) => (
                  <th key={a} scope="col">
                    {t(`allergen_${a}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.dishes.map((x, i) => (
                <tr key={i}>
                  <th scope="row">
                    <TT v={x.name} context="dish" />
                  </th>
                  {used.map((a) => (
                    <td key={a} className={x.allergens.includes(a) ? 'has' : ''}>
                      {f.allergenFreeShop.includes(a) ? '−' : x.allergens.includes(a) ? '●' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">{t('foodSelfReported')}</p>
    </section>
  );
}

function CategorySection({ d }: { d: Detail }) {
  const { t } = useApp();
  if (d.category === 'EXPERIENCE') {
    return (
      <section>
        <h2>{t('cat_EXPERIENCE')}</h2>
        <dl className="kv">
          <dt>{t('itemsToBring')}</dt>
          <dd>{d.itemsToBring.text ? <TT v={d.itemsToBring} /> : t('nothingNeeded')}</dd>
          <dt>{t('minParticipants')}</dt>
          <dd>{t(d.minParticipants === 1 ? 'onePerson' : 'people', { n: d.minParticipants })}</dd>
        </dl>
      </section>
    );
  }
  if (d.category === 'RESTAURANT') {
    return d.courseStyle ? (
      <section>
        <h2>{t('cat_RESTAURANT')}</h2>
        <dl className="kv">
          <dt>{t('menuStyle')}</dt>
          <dd>{t(`course_${d.courseStyle}`)}</dd>
        </dl>
      </section>
    ) : null;
  }
  if (d.category === 'TOUR') {
    return (
      <section>
        <h2>{t('cat_TOUR')}</h2>
        <dl className="kv">
          <dt>{t('meetingPoint')}</dt>
          <dd>
            <TT v={d.meetingPoint} />
          </dd>
          {d.itinerary.text && (
            <>
              <dt>{t('itinerary')}</dt>
              <dd>
                <TT v={d.itinerary} as="div" />
              </dd>
            </>
          )}
          <dt>{t('guideLanguages')}</dt>
          <dd>{d.guideLanguages.map((g) => t(`guide_${g as 'en'}`)).join(', ')}</dd>
        </dl>
      </section>
    );
  }
  return null;
}

function ReportSheet({ open, onClose, listingId }: { open: boolean; onClose: () => void; listingId: string }) {
  const { t } = useApp();
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={t('reportShop')}>
      {done ? (
        <p className="notice notice-ok">{t('reportThanks')}</p>
      ) : (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(false);
            try {
              await post(`/listings/${listingId}/report`, { reason });
              setDone(true);
            } catch {
              setErr(true);
            }
          }}
        >
          <label>
            {t('reportReason')}
            <textarea required rows={4} maxLength={LIMITS.reportMaxChars} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {err && <ErrorBox />}
          <button className="btn btn-primary" disabled={!reason.trim()}>
            {t('send')}
          </button>
        </form>
      )}
    </Sheet>
  );
}
