// 予約：日付 → 空きのある時間枠 → 人数 → 食事制限・メッセージ → カード登録 → キャンセルポリシーに同意して確定
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { freeCancelUntil } from '../../shared/booking';
import { DIETARY, LIMITS, type Dietary } from '../../shared/constants';
import { addDays } from '../../shared/time';
import { ApiError, get, post } from '../api';
import { Chip, dateText, deadlineText, ErrorBox, FxNote, Money, Spinner, toggle, yen } from '../components/ui';
import { load, store, useApp } from '../store';
import type { DayAvail, Detail, Me } from '../types';
import { CardForm } from './Account';
import { useCharacter } from '../components/Character';
import { weekdayName } from './Shop';

interface Draft {
  date?: string;
  time?: string;
  party?: number;
  dietary?: Dietary[];
  message?: string;
}

export default function Book() {
  const { id } = useParams();
  const { t, lang, me, setMe } = useApp();
  const nav = useNavigate();
  const draftKey = `hl.draft.${id}`;
  const [d, setD] = useState<Detail | null>(null);
  const [days, setDays] = useState<DayAvail[] | null>(null);
  const [draft, setDraftState] = useState<Draft>(() => load(draftKey, {}));
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useCharacter({ line: t('say_book'), listingId: id });

  // 入力内容を端末に残し、途中で閉じても次に開いたときに再開できるようにする
  const setDraft = (p: Partial<Draft>) =>
    setDraftState((prev) => {
      const next = { ...prev, ...p };
      store(draftKey, next);
      return next;
    });

  const loadAvail = useCallback(async () => {
    const r = await get<{ days: DayAvail[] }>(`/listings/${id}/availability?days=42`);
    setDays(r.days);
    return r.days;
  }, [id]);

  useEffect(() => {
    get<Detail>(`/listings/${id}?lang=${lang}`)
      .then(setD)
      .catch(() => setErr(t('error')));
    loadAvail().catch(() => setErr(t('error')));
  }, [id, lang, loadAvail, t]);

  const day = days?.find((x) => x.date === draft.date && x.state === 'open');
  const slot = day?.slots.find((s) => s.time === draft.time && s.open);
  const maxParty = slot ? Math.min(slot.remaining, LIMITS.partyMax) : 0;
  const party = draft.party && slot && draft.party <= maxParty ? draft.party : undefined;

  // 保存していた日時が選べなくなっていたら外す
  useEffect(() => {
    if (!days) return;
    if (draft.date && !day) setDraft({ date: undefined, time: undefined, party: undefined });
    else if (draft.time && !slot) setDraft({ time: undefined, party: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  if (me?.role !== 'TRAVELER') return <Navigate to={`/${lang}/signup?next=${encodeURIComponent(`/${lang}/shop/${id}/book`)}`} replace />;
  if (err && (!d || !days)) return <ErrorBox text={err} />;
  if (!d || !days) return <Spinner />;
  if (!d.bookable) return <Navigate to={`/${lang}/shop/${id}`} replace />;

  const missing = [
    !draft.date && t('pickDate'),
    draft.date && !draft.time && t('pickTime'),
    draft.time && !party && t('pickParty'),
    party != null && party < d.minParticipants && t('minPeople', { n: d.minParticipants }),
    !me.cardRegistered && t('needCard'),
    !agree && t('needAgree'),
  ].filter(Boolean) as string[];

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ id: string }>('/reservations', {
        listingId: id,
        date: draft.date,
        time: draft.time,
        partySize: party,
        dietary: draft.dietary ?? [],
        message: draft.message ?? '',
        policyAgreed: true,
      });
      store(draftKey, undefined);
      nav(`/${lang}/bookings/${r.id}?new=1`, { replace: true });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      if (code === 'full' || code === 'not_bookable') {
        // 同じ枠を同時に予約した人がいた：最新の空きを取り直す
        setErr(t('slotJustFilled'));
        await loadAvail().catch(() => {});
        setDraft({ time: undefined, party: undefined });
      } else if (code === 'too_many_reservations') setErr(t('tooManyReservations', { n: LIMITS.futureReservationsPerTraveler }));
      else if (code === 'blocked') setErr(t('blockedByShop'));
      else if (code === 'party_under_minimum') setErr(t('minPeople', { n: d!.minParticipants }));
      else setErr(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const pay = party && d.priceJpy != null ? d.priceJpy * party : null;
  return (
    <div className="stack booking">
      <p className="small">
        <Link to={`/${lang}/shop/${d.id}`}>← {d.name.text}</Link>
      </p>
      <h1>{t('bookTitle')}</h1>

      <section className="stack-s">
        <h2>1. {t('date')}</h2>
        <Calendar days={days} value={draft.date} onPick={(date) => setDraft({ date, time: undefined, party: undefined })} />
      </section>

      {day && (
        <section className="stack-s">
          <h2>2. {t('time')}</h2>
          <div className="chips">
            {day.slots.map((s) => (
              <button
                key={s.time}
                type="button"
                className={`chip chip-toggle slot ${draft.time === s.time ? 'on' : ''}`}
                disabled={!s.open}
                onClick={() => setDraft({ time: s.time, party: undefined })}
              >
                {s.time}
                <span className="small muted"> {s.open ? t('remaining', { n: s.remaining }) : s.remaining ? t('closedForBooking') : t('full')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {slot && (
        <section className="stack-s">
          <h2>3. {t('peopleLabel')}</h2>
          <select value={party ?? ''} onChange={(e) => setDraft({ party: Number(e.target.value) || undefined })} aria-label={t('peopleLabel')}>
            <option value="">—</option>
            {Array.from({ length: maxParty }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n} disabled={n < d.minParticipants}>
                {t(n === 1 ? 'onePerson' : 'people', { n })}
              </option>
            ))}
          </select>
          <p className="small muted">{t('upToRemaining', { n: maxParty })}</p>
        </section>
      )}

      <section className="stack-s">
        <h2>4. {t('dietaryTitle')}</h2>
        <div className="chips">
          {DIETARY.map((x) => (
            <Chip key={x} on={!!draft.dietary?.includes(x)} onClick={() => setDraft({ dietary: toggle(draft.dietary, x) })}>
              {t(`dietary_${x}`)}
            </Chip>
          ))}
        </div>
        <label>
          {t('messageToShop')}
          <textarea
            rows={3}
            maxLength={LIMITS.messageMaxChars}
            value={draft.message ?? ''}
            onChange={(e) => setDraft({ message: e.target.value })}
            placeholder={t('messagePlaceholder')}
          />
          <span className="small muted">
            {t('translatedToJa')} · {(draft.message ?? '').length}/{LIMITS.messageMaxChars}
          </span>
        </label>
      </section>

      <section className="stack-s">
        <h2>5. {t('card')}</h2>
        {me.cardRegistered ? (
          <p className="notice notice-ok small">{t('cardRegistered')}</p>
        ) : (
          <CardForm
            onDone={async () => {
              const r = await post<{ user: Me }>('/me/card');
              setMe(r.user);
            }}
          />
        )}
      </section>

      <section className="stack-s">
        <h2>6. {t('cancelPolicy')}</h2>
        <ul className="small">
          <li>{t(`freeCancel_${d.freeCancel}`)}</li>
          {draft.date && draft.time && <FreeCancelLine until={freeCancelUntil(d.freeCancel, draft.date, draft.time)} />}
          <li>{d.lateFeeJpy ? t('lateFee', { amount: yen(d.lateFeeJpy) }) : t('noLateFee')}</li>
          <li>{t('noChargeNow')}</li>
        </ul>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          {t('agreePolicy')}
        </label>
      </section>

      {pay != null && (
        <div>
          {t('payAtPlace')}: <Money jpy={pay} />
          <FxNote />
        </div>
      )}
      {err && <p className="notice notice-error">{err}</p>}
      {missing.length > 0 && (
        <ul className="small muted missing">
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <div className="sticky-cta">
        <button className="btn btn-primary btn-big" disabled={busy || missing.length > 0} onClick={() => void confirm()}>
          {t('confirmBooking')}
        </button>
      </div>
    </div>
  );
}

function FreeCancelLine({ until }: { until: Date }) {
  const { t, lang } = useApp();
  if (until.getTime() <= Date.now()) return <li className="warn">{t('freeCancelPassed')}</li>;
  return <li>{t('freeCancelUntilAt', { at: deadlineText(until, lang) })}</li>;
}

/** 6週間分のカレンダー。選べない日（満席・定休日・受付停止日・締切後）は押せない */
function Calendar({ days, value, onPick }: { days: DayAvail[]; value?: string; onPick: (date: string) => void }) {
  const { t, lang } = useApp();
  const byDate = useMemo(() => new Map(days.map((x) => [x.date, x])), [days]);
  if (!days.length) return null;
  const first = days[0].date;
  const start = addDays(first, -new Date(`${first}T00:00:00Z`).getUTCDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div>
      <div className="calendar" role="grid">
        {[0, 1, 2, 3, 4, 5, 6].map((w) => (
          <div key={w} className="cal-head">
            {weekdayName(w, lang)}
          </div>
        ))}
        {cells.map((date) => {
          const x = byDate.get(date);
          const open = x?.state === 'open';
          return (
            <button
              key={date}
              type="button"
              className={`cal-cell ${open ? 'st-OK' : x ? 'st-FULL' : 'cal-out'} ${value === date ? 'on' : ''}`}
              disabled={!open}
              onClick={() => onPick(date)}
              aria-label={`${dateText(date, lang)}: ${x ? t(`day_${x.state}`) : ''}`}
              title={x ? t(`day_${x.state}`) : undefined}
            >
              <span className="cal-day">{Number(date.slice(8))}</span>
              {date.endsWith('-01') && <span className="cal-month">{new Date(`${date}T00:00:00Z`).toLocaleDateString(lang, { month: 'short', timeZone: 'UTC' })}</span>}
            </button>
          );
        })}
      </div>
      {value && <p className="small">{dateText(value, lang)}</p>}
    </div>
  );
}
