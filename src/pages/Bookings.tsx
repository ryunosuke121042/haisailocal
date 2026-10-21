// マイ予約：一覧、確定画面を兼ねた詳細、キャンセル
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, get, post } from '../api';
import {
  AGE_BANDS,
  DIETARY_JA,
  LIMITS,
  REVIEW_COUNTRIES,
  REVIEW_GENDERS,
  REVIEW_RELIGIONS,
  REVIEW_TAGS,
  REVIEWER_FIELDS,
  TRAVEL_SCENES,
  type Dietary,
  type ReviewerField,
} from '../../shared/constants';
import { PhotoAttachButton, PhotoPreview } from '../components/ChatPhoto';
import { countryName } from './ShopReviews';
import { useCharacter } from '../components/Character';
import { Chip, dateText, deadlineText, ErrorBox, FxNote, MapsButton, Money, Photo, Sheet, Spinner, toggle, TT, yen } from '../components/ui';
import { useApp } from '../store';
import type { Card, ReservationStatus, TText } from '../types';
import { lazyWithReload } from '../lib/lazyReload';

const MapView = lazyWithReload(() => import('../components/MapView').then((m) => ({ default: m.MapView })));

interface Row {
  id: string;
  status: ReservationStatus;
  date: string;
  time: string;
  partySize: number;
  listingId: string;
  shop: string;
  photo: string | null;
  upcoming: boolean;
  canReview: boolean;
}

export function Bookings() {
  const { t, lang, me } = useApp();
  const [list, setList] = useState<Row[] | null>(null);
  const [err, setErr] = useState(false);
  const load = useCallback(() => {
    if (me?.role !== 'TRAVELER') return;
    setErr(false);
    get<{ results: Row[] }>(`/reservations?lang=${lang}`)
      .then((r) => setList(r.results))
      .catch(() => setErr(true));
  }, [lang, me]);
  useEffect(load, [load]);

  useCharacter({ line: t('say_bookings') });
  if (me?.role !== 'TRAVELER') return <Navigate to={`/${lang}/login?next=${encodeURIComponent(`/${lang}/bookings`)}`} replace />;
  if (err) return <ErrorBox onRetry={load} />;
  if (!list) return <Spinner />;
  const upcoming = list.filter((x) => x.upcoming).reverse();
  const others = list.filter((x) => !x.upcoming);
  return (
    <div className="stack">
      <h1>{t('navBookings')}</h1>
      {list.length === 0 && (
        <p className="notice">
          {t('noBookings')} <Link to={`/${lang}`}>{t('backToList')}</Link>
        </p>
      )}
      {upcoming.length > 0 && <RowList title={t('upcoming')} rows={upcoming} />}
      {others.length > 0 && <RowList title={t('pastAndCanceled')} rows={others} />}
    </div>
  );
}

function RowList({ title, rows }: { title: string; rows: Row[] }) {
  const { t, lang } = useApp();
  return (
    <section className="stack-s">
      <h2>{title}</h2>
      <ul className="list">
        {rows.map((x) => (
          <li key={x.id}>
            <Link to={`/${lang}/bookings/${x.id}`} className="list-item">
              <span className="thumb">
                <Photo src={x.photo} alt="" />
              </span>
              <span className="grow">
                <strong>{x.shop}</strong>
                <br />
                <span className="small">
                  {dateText(x.date, lang)} {x.time} · {t(x.partySize === 1 ? 'onePerson' : 'people', { n: x.partySize })}
                </span>
              </span>
              <span className={`status status-${x.status}`}>{t(`st_${x.status}`)}</span>
              {x.canReview && <span className="badge badge-new">{t('reviewNow')}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface View {
  id: string;
  status: ReservationStatus;
  date: string;
  time: string;
  partySize: number;
  dietary: string[];
  message: string;
  payJpy: number;
  freeCancel: 'SAME_DAY' | 'DAY_BEFORE' | 'THREE_DAYS_BEFORE';
  lateFeeJpy: number | null;
  cancelDeadlineAt: string;
  canCancel: boolean;
  cancelNow: { late: boolean; feeJpy: number };
  lateCancel: boolean;
  cancelFeeJpy: number | null;
  bizCancelReason: string | null;
  bizCancelNote: TText | null;
  review: { stars: number; tags: string[] } | null;
  canReview: boolean;
  listing: {
    id: string;
    name: TText;
    nameJa: string;
    category: 'EXPERIENCE' | 'RESTAURANT' | 'TOUR' | null;
    address: string;
    lat: number | null;
    lng: number | null;
    area: string;
    paymentMethod: 'CASH_ONLY' | 'CARD_OK' | null;
    photo: string | null;
    meetingPoint: TText;
    itemsToBring: TText;
    dress: TText;
  };
}

export function BookingDetail() {
  const { id } = useParams();
  const [p] = useSearchParams();
  const { t, lang, me } = useApp();
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const load = useCallback(() => {
    if (me?.role !== 'TRAVELER') return;
    setErr(false);
    get<View>(`/reservations/${id}?lang=${lang}`)
      .then(setV)
      .catch(() => setErr(true));
  }, [id, lang, me]);
  useEffect(load, [load]);
  // 評価のお願いの通知・メール（#review）から来たら、評価欄まで移動する
  useEffect(() => {
    if (v && location.hash === '#review') document.getElementById('review')?.scrollIntoView({ behavior: 'smooth' });
  }, [v]);

  // キャラクター：予約確定を一緒に喜ぶ。お店の都合でキャンセルされたら、近くの似たお店を紹介する
  const fresh = !!p.get('new') && v?.status === 'CONFIRMED';
  useCharacter({
    line: !v ? undefined : fresh ? t('say_confirmed') : v.status === 'CANCELED_BY_BUSINESS' ? t('say_alternatives') : v.canReview ? t('say_review') : t('say_booking'),
    mood: fresh ? 'wow' : v?.status === 'CANCELED_BY_BUSINESS' ? 'sorry' : 'happy',
  });

  if (me?.role !== 'TRAVELER') return <Navigate to={`/${lang}/login?next=${encodeURIComponent(`/${lang}/bookings/${id}`)}`} replace />;
  if (err) return <ErrorBox onRetry={load} />;
  if (!v) return <Spinner />;
  const l = v.listing;
  const active = v.status === 'CONFIRMED';
  return (
    <div className="reservation stack">
      {fresh && (
        <div className="notice notice-ok celebrate">
          <strong>🎉 {t('bookingConfirmed')}</strong>
          <br />
          <span className="small">{t('confirmMailSent')}</span>
        </div>
      )}
      <header className="row gap-s">
        <span className="thumb">
          <Photo src={l.photo} alt="" />
        </span>
        <div className="grow">
          <h1>
            <Link to={`/${lang}/shop/${l.id}`}>{l.name.text}</Link>
          </h1>
          <span className={`status status-${v.status}`}>{t(`st_${v.status}`)}</span>
        </div>
      </header>

      <section>
        <dl className="kv">
          <dt>{t('dateTime')}</dt>
          <dd>
            {dateText(v.date, lang)} {v.time} (JST)
          </dd>
          <dt>{t('peopleLabel')}</dt>
          <dd>{t(v.partySize === 1 ? 'onePerson' : 'people', { n: v.partySize })}</dd>
          <dt>{t('address')}</dt>
          <dd>{l.address}</dd>
          {l.category === 'TOUR' && l.meetingPoint.text && (
            <>
              <dt>{t('meetingPoint')}</dt>
              <dd>
                <TT v={l.meetingPoint} />
              </dd>
            </>
          )}
          {l.category === 'EXPERIENCE' && l.itemsToBring.text && (
            <>
              <dt>{t('itemsToBring')}</dt>
              <dd>
                <TT v={l.itemsToBring} />
              </dd>
            </>
          )}
          {l.dress.text && (
            <>
              <dt>{t('dress')}</dt>
              <dd>
                <TT v={l.dress} />
              </dd>
            </>
          )}
          <dt>{t('payAtPlace')}</dt>
          <dd>
            <Money jpy={v.payJpy} />
            {l.paymentMethod && <span className="small muted"> · {t(`pay_${l.paymentMethod}`)}</span>}
            <FxNote />
          </dd>
          {active && (
            <>
              <dt>{t('freeCancelUntil')}</dt>
              <dd>
                {deadlineText(v.cancelDeadlineAt, lang)}
                <br />
                <span className="small muted">{v.lateFeeJpy ? t('lateFee', { amount: yen(v.lateFeeJpy) }) : t('noLateFee')}</span>
              </dd>
            </>
          )}
          {v.dietary.length > 0 && (
            <>
              <dt>{t('dietaryTitle')}</dt>
              <dd>{v.dietary.map((x) => t(`dietary_${x as 'vegan'}`)).join(', ')}</dd>
            </>
          )}
          {v.message && (
            <>
              <dt>{t('messageToShop')}</dt>
              <dd className="pre">{v.message}</dd>
            </>
          )}
        </dl>
      </section>

      {active && (
        <>
          <section>
            <h2>{l.category === 'TOUR' ? t('meetingPoint') : t('mapTitle')}</h2>
            {l.lat != null && l.lng != null && (
              <Suspense fallback={null}>
                <MapView pins={[{ id: l.id, lat: l.lat, lng: l.lng, label: l.name.text }]} height={220} lang={lang} />
              </Suspense>
            )}
            <MapsButton lat={l.lat} lng={l.lng} address={l.address} />
          </section>
          <section>
            <h2>{t('firstTimeGuide')}</h2>
            <ul className="guide">
              {t('guideItems')
                .split('|')
                .map((g) => (
                  <li key={g}>{g}</li>
                ))}
            </ul>
          </section>
          <JapaneseCard v={v} name={me.name} />
        </>
      )}

      {v.status === 'CANCELED_BY_BUSINESS' && (
        <section className="stack-s">
          <div className="notice notice-warn">
            <strong>{t('canceledByShop')}</strong>
            <p>{v.bizCancelReason}</p>
            {v.bizCancelNote && <TT v={v.bizCancelNote} as="p" />}
            <p className="small">{t('noFeeShopCancel')}</p>
          </div>
          <Alternatives listingId={l.id} date={v.date} />
        </section>
      )}
      {v.status === 'CANCELED_BY_TRAVELER' && v.lateCancel && v.cancelFeeJpy ? (
        <p className="notice notice-warn small">{t('lateCanceledFee', { amount: yen(v.cancelFeeJpy) })}</p>
      ) : null}
      {v.status === 'NO_SHOW' && <p className="notice notice-warn small">{t('noShowNote')}</p>}

      {(v.canReview || v.review) && <ReviewForm id={v.id} existing={v.review} onDone={load} />}

      <div className="actions">
        <Link className="btn" to={`/${lang}/chat/${l.id}`}>
          💬 {t('chatWithShop')}
        </Link>
        {v.canCancel && (
          <button className="btn btn-danger" onClick={() => setCancelOpen(true)}>
            {t('cancelBooking')}
          </button>
        )}
      </div>
      <CancelSheet open={cancelOpen} onClose={() => setCancelOpen(false)} v={v} onDone={load} />
    </div>
  );
}

/** 困ったときに見せる日本語カード（どの表示言語でも日本語で表示する） */
function JapaneseCard({ v, name }: { v: View; name: string }) {
  const { t } = useApp();
  const md = `${Number(v.date.slice(5, 7))}月${Number(v.date.slice(8))}日`;
  const diet = v.dietary.map((d) => DIETARY_JA[d as Dietary] ?? d).join('、');
  return (
    <section className="jp-card">
      <h2>{t('japaneseCard')}</h2>
      <p className="jp-text" lang="ja">
        こんにちは。{md} {v.time}から{v.partySize}名で予約している{name}です。
        {diet && <>食事制限があります：{diet}。</>}
        日本語が話せないので、ゆっくり話すか、指さしで教えていただけると助かります。
      </p>
      <p className="small muted">{t('japaneseCardTranslation', { name, date: v.date, time: v.time, n: v.partySize })}</p>
    </section>
  );
}

function Alternatives({ listingId, date }: { listingId: string; date: string }) {
  const { t, lang } = useApp();
  const [list, setList] = useState<Card[] | null>(null);
  useEffect(() => {
    get<{ results: Card[] }>(`/listings/${listingId}/alternatives?date=${date}&lang=${lang}`)
      .then((r) => setList(r.results))
      .catch(() => setList([]));
  }, [listingId, date, lang]);
  return (
    <>
      <h2>{t('alternatives')}</h2>
      {!list ? (
        <Spinner />
      ) : list.length ? (
        <ul className="list">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/${lang}/shop/${c.id}`} className="list-item">
                <span className="thumb">
                  <Photo src={c.photo} alt="" />
                </span>
                <span className="grow">
                  <strong>{c.name.text}</strong>
                  <br />
                  {c.priceJpy != null && <Money jpy={c.priceJpy} suffix={t('perPerson')} />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          {t('noAlternatives')} <Link to={`/${lang}?date=${date}`}>{t('backToList')}</Link>
        </p>
      )}
    </>
  );
}

/** 来店後の評価：星（1〜5）と選択式のタグだけ（自由記述なし）。スキップ可 */
function ReviewForm({ id, existing, onDone }: { id: string; existing: { stars: number; tags: string[]; photos?: string[] } | null; onDone: () => void }) {
  const { t, lang } = useApp();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  // 任意の「あなたについて」。お店のページでは集計（グラフ）だけに使う
  const [about, setAbout] = useState<Partial<Record<ReviewerField, string>>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (existing)
    return (
      <div className="notice notice-ok stack-s">
        <p>
          {t('reviewThanks')} {'★'.repeat(existing.stars)}
        </p>
        {!!existing.photos?.length && (
          <div className="review-photos">
            {existing.photos.map((p) => (
              <img key={p} src={p} alt={t('reviewPhotoAlt')} />
            ))}
          </div>
        )}
      </div>
    );
  const answered = REVIEWER_FIELDS.some((f) => about[f]);
  const setField = (f: ReviewerField, v: string) => setAbout((a) => ({ ...a, [f]: v || undefined }));
  const select = (f: ReviewerField, label: string, values: readonly string[], name: (v: string) => string) => (
    <label className="stack-s">
      <span className="small">{label}</span>
      <select value={about[f] ?? ''} onChange={(e) => setField(f, e.target.value)}>
        <option value="">{t('notAnswered')}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {name(v)}
          </option>
        ))}
      </select>
    </label>
  );
  const countries = [...REVIEW_COUNTRIES]
    .filter((c) => c !== 'OTHER')
    .map((c) => ({ c, name: countryName(c, lang, t('country_OTHER')) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
  return (
    <section id="review" className="review stack-s">
      <h2>{t('reviewTitle')}</h2>
      <div className="stars-input" role="radiogroup" aria-label={t('reviewStars')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={stars === n} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>
            ★
          </button>
        ))}
      </div>
      <p className="small">{t('reviewTags')}</p>
      <div className="chips">
        {REVIEW_TAGS.map((tag) => (
          <Chip key={tag} on={tags.includes(tag)} onClick={() => setTags(toggle(tags, tag))}>
            {t(`tag_${tag}`)}
          </Chip>
        ))}
      </div>

      <p className="small">{t('reviewPhotos', { n: LIMITS.reviewPhotosMax })}</p>
      <div className="row gap-s wrap">
        {photos.map((p, i) => (
          <PhotoPreview key={i} src={p} removeLabel={t('removePhoto')} onRemove={() => setPhotos(photos.filter((_, k) => k !== i))} />
        ))}
        {photos.length < LIMITS.reviewPhotosMax && (
          <PhotoAttachButton
            labels={{ attach: t('attachPhoto'), remove: t('removePhoto'), unreadable: t('photoUnreadable') }}
            disabled={busy}
            onPick={(url) => setPhotos((ps) => [...ps, url].slice(0, LIMITS.reviewPhotosMax))}
          />
        )}
      </div>

      <details className="review-about">
        <summary>{t('reviewAbout')}</summary>
        <div className="stack-s">
          <p className="small muted">{t('reviewAboutNote')}</p>
          <div className="about-grid">
            <label className="stack-s">
              <span className="small">{t('f_country')}</span>
              <select value={about.country ?? ''} onChange={(e) => setField('country', e.target.value)}>
                <option value="">{t('notAnswered')}</option>
                {countries.map(({ c, name }) => (
                  <option key={c} value={c}>
                    {name}
                  </option>
                ))}
                <option value="OTHER">{t('country_OTHER')}</option>
              </select>
            </label>
            {select('religion', t('f_religion'), REVIEW_RELIGIONS, (v) => t(`religion_${v}` as Parameters<typeof t>[0]))}
            {select('gender', t('f_gender'), REVIEW_GENDERS, (v) => t(`gender_${v}` as Parameters<typeof t>[0]))}
            {select('ageBand', t('f_age'), AGE_BANDS, (v) => t(`age_${v}` as Parameters<typeof t>[0]))}
            {select('scene', t('f_scene'), TRAVEL_SCENES, (v) => t(`trip_${v}` as Parameters<typeof t>[0]))}
          </div>
          {answered && (
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="small">{t('reviewConsent')}</span>
            </label>
          )}
        </div>
      </details>

      {err && <p className="notice notice-error">{err}</p>}
      <button
        className="btn btn-primary"
        disabled={!stars || busy || (answered && !consent)}
        onClick={async () => {
          setErr(null);
          setBusy(true);
          try {
            await post(`/reservations/${id}/review`, { stars, tags, photos, ...about, profileConsent: answered && consent });
            onDone();
          } catch (e) {
            setErr(e instanceof ApiError && e.status === 413 ? t('photoTooLarge') : t('error'));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('reviewSubmit')}
      </button>
      {answered && !consent && <p className="small muted">{t('reviewConsentNeeded')}</p>}
    </section>
  );
}

function CancelSheet({ open, onClose, v, onDone }: { open: boolean; onClose: () => void; v: View; onDone: () => void }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [terms, setTerms] = useState(v.cancelNow);
  useEffect(() => setTerms(v.cancelNow), [v]);
  async function cancel() {
    setBusy(true);
    setErr(false);
    try {
      await post(`/reservations/${v.id}/cancel`, { confirmLate: terms.late });
      onClose();
      onDone();
    } catch (e) {
      // 確認画面を出している間に期限を過ぎた：内容を出し直して、もう一度確認してもらう
      if (e instanceof ApiError && e.code === 'late_cancel') setTerms({ late: true, feeJpy: (e.detail as { feeJpy: number }).feeJpy });
      else setErr(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('cancelBooking')}>
      <div className="stack">
        {terms.late ? (
          <p className="notice notice-warn">{terms.feeJpy ? t('cancelLateFee', { amount: yen(terms.feeJpy) }) : t('cancelLateNoFee')}</p>
        ) : (
          <p className="notice notice-ok">{t('cancelFree')}</p>
        )}
        {err && <ErrorBox />}
        <button className="btn btn-danger" disabled={busy} onClick={() => void cancel()}>
          {t('cancelConfirm')}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          {t('keepBooking')}
        </button>
      </div>
    </Sheet>
  );
}
