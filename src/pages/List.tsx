// 探す：お店の目安情報を一番上に置いた絞り込み、おすすめ順（評価順・理由つき）、一覧と地図、現在地から探す
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AREAS, type AreaCode } from '../../shared/areas';
import { addFilters, removeFilters, sceneActive, sceneFilters, SCENES } from '../../shared/scenes';
import {
  ALLERGENS,
  BUDGET_BANDS,
  CATEGORIES,
  CROWDS,
  CURRENCIES,
  DIET_SUPPORT,
  LANG_LABELS,
  LANGS,
  OWNER_DISTANCES,
  REGULARS,
  SHOP_LANGS,
  STATION_MAX,
  YEARS,
} from '../../shared/constants';
import { filtersFromQuery, filtersToQuery, SORTS, withoutKey, type FilterKey, type Filters, type SortCode } from '../../shared/filters';
import { addDays, daysBetween, jstDateString } from '../../shared/time';
import { post } from '../api';
import { useCharacter } from '../components/Character';
import { filterChipLabels, removeChip } from '../components/filterLabels';
import { areaName, Chip, ErrorBox, FxNote, LocalInfoView, Money, Photo, reasonText, Sheet, Spinner, Stars, toggle } from '../components/ui';
import { load, needsTodayCheck, store, useApp } from '../store';
import type { Card } from '../types';
import { ShopDetail } from './Shop';
import { lazyWithReload } from '../lib/lazyReload';

const MapView = lazyWithReload(() => import('../components/MapView').then((m) => ({ default: m.MapView })));

interface SearchResult {
  results: Card[];
  total: number;
  relax: { key: FilterKey; count: number }[];
}

export default function List() {
  const { t, lang, prefs, profile } = useApp();
  const [q, setQ] = useSearchParams();
  const filters = filtersFromQuery(q);
  const key = filtersToQuery(filters);
  const [sort, setSortState] = useState<SortCode>(() => {
    const saved = load<SortCode>('hl.sort', 'recommended');
    return saved === 'distance' && filtersFromQuery(new URLSearchParams(location.search)).area?.length !== 1 ? 'recommended' : saved;
  });
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locErr, setLocErr] = useState(false);
  const [data, setData] = useState<SearchResult | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState(false);
  // 地図のピンを押したお店（URL の ?shop= に入れて、戻るボタンで閉じられるようにする）
  const openShop = q.get('shop');
  const showShop = (id: string | null) => {
    const next = new URLSearchParams(q);
    if (id) next.set('shop', id);
    else next.delete('shop');
    setQ(next, { replace: !id });
  };

  const prefsKey = JSON.stringify(profile.prefs);
  const run = useCallback(() => {
    let stale = false;
    setErr(false);
    post<SearchResult>('/listings/search', { lang, filters: filtersFromQuery(new URLSearchParams(key)), prefs: JSON.parse(prefsKey), sort, here: here ?? undefined })
      .then((r) => !stale && setData(r))
      .catch(() => !stale && setErr(true));
    return () => {
      stale = true;
    };
  }, [lang, key, prefsKey, sort, here]);
  useEffect(run, [run]);

  const setFilters = useCallback((f: Filters) => setQ(new URLSearchParams(filtersToQuery(f)), { replace: true }), [setQ]);
  const setSort = (s: SortCode) => {
    setSortState(s);
    store('hl.sort', s);
  };

  // キャラクター：一覧の件数を一言で伝え、希望を絞り込み条件に置き換える
  const line = !data ? t('say_explore') : data.results.length ? t('say_found', { n: data.results.length }) : t('say_none');
  useCharacter({ line, mood: data && !data.results.length ? 'sorry' : 'happy', onFilters: setFilters, filters });

  // 初めての人には、まずキャラクターが質問する（共有された絞り込みつきのURLから来た人は、そのまま一覧を見せる）
  if (!prefs.chosen && !key) return <Navigate to={`/${lang}/start`} replace />;

  const chips = filterChipLabels(filters, lang);
  const autoReligious = profile.prefs.religious?.length ?? 0;
  const autoAllergens = profile.prefs.allergens?.length ?? 0;

  function locate() {
    setLocErr(false);
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude });
        setSort('distance');
      },
      () => setLocErr(true),
      { timeout: 8000 },
    );
  }

  return (
    <div className="stack">
      {!prefs.chosen && <FirstRun />}
      {needsTodayCheck(profile, prefs.chosen) && <TodayCheck />}
      <h1 className="list-title">{t('listTitle')}</h1>
      <SceneChips filters={filters} onChange={setFilters} />
      <div className="quickbar">
        <label>
          <span className="sr-only">{t('f_date')}</span>
          <select value={filters.date ?? ''} onChange={(e) => setFilters({ ...withoutKey(filters, 'date'), ...(e.target.value ? { date: e.target.value } : {}) })}>
            <option value="">{t('anyDate')}</option>
            {Array.from({ length: 7 }, (_, i) => addDays(jstDateString(), i)).map((d, i) => (
              <option key={d} value={d}>
                {i === 0 ? `${t('today')} ` : i === 1 ? `${t('tomorrow')} ` : ''}
                {new Date(`${d}T00:00:00+09:00`).toLocaleDateString(lang, { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', weekday: 'short' })}
              </option>
            ))}
            {filters.date && daysBetween(jstDateString(), filters.date) > 6 && <option value={filters.date}>{filters.date}</option>}
          </select>
        </label>
        <label>
          <span className="sr-only">{t('f_area')}</span>
          <select
            value={filters.area?.length === 1 ? filters.area[0] : filters.area?.length ? '__multi' : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__multi') return;
              setFilters({ ...withoutKey(filters, 'area'), ...(v ? { area: [v as AreaCode] } : {}) });
            }}
          >
            <option value="">{t('allAreas')}</option>
            {(filters.area?.length ?? 0) > 1 && <option value="__multi">{t('severalAreas', { n: filters.area!.length })}</option>}
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {areaName(a, lang)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{t('sortLabel')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortCode)}>
            {SORTS.map((s) => (
              <option key={s} value={s} disabled={s === 'distance' && !here && filters.area?.length !== 1}>
                {t(`sort_${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="toolbar result-bar">
        <span className="grow small result-count">{data ? t('foundCount', { n: data.results.length }) : '\u00a0'}</span>
        <button className="btn btn-small" onClick={locate}>
          📍 {t('nearMe')}
        </button>
        <button className={`btn btn-small ${chips.length ? 'on' : ''}`} onClick={() => setOpen(true)}>
          {t('filters')}
          {chips.length > 0 && ` (${chips.length})`}
        </button>
      </div>
      {locErr && <p className="notice notice-warn small">{t('locationError')}</p>}
      <Suspense fallback={<div className="map map-placeholder" style={{ height: 300 }} />}>
        <MapView
          pins={(data?.results ?? []).filter((c) => c.lat != null && c.lng != null).map((c) => ({ id: c.id, lat: c.lat!, lng: c.lng!, label: c.name.text }))}
          onSelect={(id) => showShop(id)}
          selectedId={openShop ?? undefined}
          userLocation={here ?? undefined}
          lang={lang}
          height={300}
        />
      </Suspense>
      {chips.length > 0 && (
        <ul className="chips active-filters">
          {chips.map((c) => (
            <li key={c.key + (c.value ?? '')}>
              <button className="chip removable" onClick={() => setFilters(removeChip(filters, c))}>
                {c.label} ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {(autoReligious > 0 || autoAllergens > 0) && (
        <p className="small muted auto-conds">
          {t('autoConditions')} <Link to={`/${lang}/settings`}>{t('change')}</Link>
        </p>
      )}
      <FxNote />
      {err && <ErrorBox onRetry={() => void run()} />}
      {!data && !err && <Spinner />}
      {data && data.results.length === 0 && (
        <div className="notice">
          <p>{data.total === 0 ? t('noShopsYet') : t('noResults')}</p>
          {data.relax.length > 0 && (
            <ul className="relax">
              {data.relax.map((r) => (
                <li key={r.key}>
                  <button className="link" onClick={() => setFilters(withoutKey(filters, r.key))}>
                    {t('relaxOne', { filter: t(`f_${r.key}`), n: r.count })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {data?.results.some((c) => c.week?.length) && (
        <p className="week-legend small muted">
          {t('availWeek')}：{(['open', 'few', 'full', 'closed'] as const).map((k) => `${LEVEL_MARK[k]} ${t(`avail_${k}`)}`).join('　')}
        </p>
      )}
      {data && data.results.length > 0 && (
        <ul className="cards">
          {data.results.map((c) => (
            <ShopCard key={c.id} c={c} />
          ))}
        </ul>
      )}
      <p className="small muted biz-link">
        <Link to="/biz">事業者の方はこちら（日本語）</Link>
      </p>
      <FilterSheet open={open} onClose={() => setOpen(false)} value={filters} onApply={setFilters} />
      {openShop && (
        <Sheet open onClose={() => showShop(null)} title={data?.results.find((c) => c.id === openShop)?.name.text ?? t('loading')}>
          <div className="shop-sheet">
            <ShopDetail id={openShop} embedded />
            <Link className="btn btn-ghost" to={`/${lang}/shop/${openShop}`}>
              {t('openFullPage')}
            </Link>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** よく使う条件：タップで今の絞り込みに足す。もう一度タップで外す */
function SceneChips({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const { t } = useApp();
  const today = jstDateString();
  return (
    <section className="scenes" aria-label={t('scenesTitle')}>
      <h2 className="small">{t('scenesTitle')}</h2>
      <div className="scene-row">
        {SCENES.map((sc) => {
          const f = sceneFilters(sc, today);
          const on = sceneActive(filters, f);
          return (
            <button key={sc.id} type="button" className={`chip chip-toggle scene ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? removeFilters(filters, f) : addFilters(filters, f))}>
              {t(`scene_${sc.id}`)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** 絞り込みつきのURLから初めて来た人：表示言語と通貨だけ聞く */
function FirstRun() {
  const { t, lang, currency, setPrefs } = useApp();
  const nav = useNavigate();
  const [cur, setCur] = useState(currency);
  return (
    <section className="card first-run stack-s">
      <h2>{t('firstRunTitle')}</h2>
      <div className="seg wrap" role="group" aria-label={t('language')}>
        {LANGS.map((l) => (
          <button key={l} className={l === lang ? 'on' : ''} onClick={() => nav(`/${l}${location.search}`, { replace: true })}>
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>
      <label>
        {t('currency')}
        <select value={cur} onChange={(e) => setCur(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <button className="btn btn-primary" onClick={() => void setPrefs({ currency: cur, chosen: true })}>
        {t('start')}
      </button>
    </section>
  );
}

/** 今日の希望は日によって変わるため、その日に初めて開いたときに確認し直す */
function TodayCheck() {
  const { t, lang, profile, setPrefs } = useApp();
  const nav = useNavigate();
  const p = profile.prefs;
  const parts = [
    p.budget && t(`budget_${p.budget}`),
    ...(p.dietary ?? []).map((d) => t(`diet_${d}`)),
    ...(p.religious ?? []).map((r) => t(`religious_${r}`)),
    ...(p.allergens ?? []).map((a) => t(`allergen_${a}`)),
  ].filter(Boolean);
  return (
    <div className="notice notice-info today-check">
      <p>{t('todayCheck', { list: parts.join(', ') || '—' })}</p>
      <div className="row gap-s">
        <button className="btn btn-small btn-primary" onClick={() => void setPrefs({ prefsDate: jstDateString() })}>
          {t('todaySame')}
        </button>
        <button
          className="btn btn-small"
          onClick={() => {
            store('hl.onboarding', { step: 'budget', answers: {} });
            nav(`/${lang}/start`);
          }}
        >
          {t('todayChange')}
        </button>
      </div>
    </div>
  );
}

function ShopCard({ c }: { c: Card }) {
  const { t, lang } = useApp();
  const reasons = useMemo(() => (c.hit?.reasons ?? []).map((r) => reasonText(r, t)), [c.hit, t]);
  return (
    <li className="card">
      <Link to={`/${lang}/shop/${c.id}`} state={{ reasons }} className="shop-link">
        <div className="shop-photo">
          <Photo src={c.photo} alt="" />
          {c.category && <span className="badge badge-cat">{t(`cat_${c.category}`)}</span>}
        </div>
        <div className="shop-body stack-s">
          <h3>{c.name.text}</h3>
          <p className="small muted">
            {areaName(c.area, lang)}
            {c.hit?.distanceKm != null && ` · ${t('kmAway', { n: c.hit.distanceKm })}`}
          </p>
          <div className="row gap-s wrap">
            <Stars rating={c.rating} />
            {c.halalCertified && <span className="badge badge-halal">{t('halalMark')}</span>}
            {c.hit?.halalGroup === 'reference' && <span className="badge badge-ref">{t('porkFreeRef')}</span>}
          </div>
          {c.priceJpy != null && <Money jpy={c.priceJpy} suffix={t('perPerson')} />}
          <LocalInfoView info={c.local} station={c.stationMinutes != null ? t('stationMin', { station: c.station.text, n: c.stationMinutes }) : null} compact />
          {reasons.length > 0 && <p className="reasons small">✓ {reasons.join(' · ')}</p>}
          {c.hit?.allergenPartial && <p className="small warn">{t('allergenPartial')}</p>}
          {c.avgReplyMinutes != null && <p className="small muted">{t('avgReply', { time: replyText(c.avgReplyMinutes, t) })}</p>}
          {c.bookable && <WeekStrip c={c} />}
          {c.bookable && <OpenSlots c={c} />}
          {!c.bookable && <p className="small muted">{t('chatOnly')}</p>}
        </div>
      </Link>
    </li>
  );
}

export function shortDate(date: string, lang: string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString(lang, { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', weekday: 'short' });
}

const LEVEL_MARK = { open: '○', few: '△', full: '×', closed: '－' } as const;

/** 7日間のおおよその空き具合（○空きあり △残りわずか ×満席 －休み） */
function WeekStrip({ c }: { c: Card }) {
  const { t, lang } = useApp();
  if (!c.week?.length) return null;
  return (
    <div className="week-strip" role="list" aria-label={t('availWeek')}>
      {c.week.map((d) => {
        const date = new Date(`${d.date}T00:00:00+09:00`);
        const wd = date.toLocaleDateString(lang, { timeZone: 'Asia/Tokyo', weekday: 'short' });
        const day = date.toLocaleDateString(lang, { timeZone: 'Asia/Tokyo', day: 'numeric' });
        return (
          <span key={d.date} role="listitem" className={`wk wk-${d.level}`} title={`${shortDate(d.date, lang)}: ${t(`avail_${d.level}`)}`}>
            <span className="wk-day">{wd}</span>
            <span className="wk-date">{day}</span>
            <span className="wk-mark" aria-label={t(`avail_${d.level}`)}>
              {LEVEL_MARK[d.level]}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** 空き枠：日付を選んでいればその日の枠と残り人数、選んでいなければ一番早い空き */
function OpenSlots({ c }: { c: Card }) {
  const { t, lang } = useApp();
  const slots = c.openSlots ?? [];
  if (!slots.length) return <p className="small muted">{t('noOpenSoon')}</p>;
  const one = slots.length === 1 && !c.hit?.reasons.includes('avail');
  return (
    <p className="open-slots small">
      <span className="avail-dot" aria-hidden>
        ●
      </span>{' '}
      {one
        ? t('nextOpen', { when: `${shortDate(slots[0].date, lang)} ${slots[0].time}` })
        : `${shortDate(slots[0].date, lang)} ` + slots.map((s) => t('slotLeft', { time: s.time, n: s.remaining })).join(' · ')}
    </p>
  );
}

export function replyText(min: number, t: ReturnType<typeof useApp>['t']) {
  if (min < 60) return t('minutesShort', { n: Math.max(1, min) });
  if (min < 60 * 48) return t('hoursShort', { n: Math.round(min / 60) });
  return t('daysShort', { n: Math.round(min / 1440) });
}

function FilterSheet({ open, onClose, value, onApply }: { open: boolean; onClose: () => void; value: Filters; onApply: (f: Filters) => void }) {
  const { t, lang } = useApp();
  const [f, setF] = useState<Filters>(value);
  useEffect(() => {
    if (open) setF(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (p: Partial<Filters>) => setF((prev) => JSON.parse(JSON.stringify({ ...prev, ...p })) as Filters);
  const today = jstDateString();
  const chipsOf = <T extends string>(key: keyof Filters, values: readonly T[], label: (v: T) => string) => (
    <div className="chips">
      {values.map((v) => (
        <Chip key={v} on={!!(f[key] as string[] | undefined)?.includes(v)} onClick={() => set({ [key]: toggle(f[key] as T[] | undefined, v) } as Partial<Filters>)}>
          {label(v)}
        </Chip>
      ))}
    </div>
  );
  return (
    <Sheet open={open} onClose={onClose} title={t('filters')}>
      <div className="stack">
        <fieldset className="fs-local">
          <legend>{t('localInfo')}</legend>
          <p className="small muted">{t('localInfoNote')}</p>
          <div className="fgroup">
            <span className="fgroup-label">{t('f_crowd')}</span>
            {chipsOf('crowd', CROWDS, (v) => t(`crowd_${v}`))}
          </div>
          <div className="fgroup">
            <span className="fgroup-label">{t('f_regulars')}</span>
            {chipsOf('regulars', REGULARS, (v) => t(`regulars_${v}`))}
          </div>
          <div className="fgroup">
            <span className="fgroup-label">{t('f_guidebook')}</span>
            <div className="chips">
              {(['none', 'listed'] as const).map((g) => (
                <Chip key={g} on={f.guidebook === g} onClick={() => set({ guidebook: f.guidebook === g ? undefined : g })}>
                  {t(`guidebook_${g}`)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="fgroup">
            <span className="fgroup-label">{t('f_years')}</span>
            {chipsOf('years', YEARS, (v) => t(`years_${v}`))}
          </div>
          <div className="fgroup">
            <span className="fgroup-label">{t('f_ownerDistance')}</span>
            {chipsOf('ownerDistance', OWNER_DISTANCES, (v) => t(`owner_${v}`))}
          </div>
          <div className="fgroup">
            <span className="fgroup-label">{t('f_stationMax')}</span>
            <div className="chips">
              {STATION_MAX.map((m) => (
                <Chip key={m} on={f.stationMax === m} onClick={() => set({ stationMax: f.stationMax === m ? undefined : m })}>
                  {t('withinMin', { n: m })}
                </Chip>
              ))}
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>{t('f_category')}</legend>
          {chipsOf('category', CATEGORIES, (v) => t(`cat_${v}`))}
        </fieldset>
        <fieldset>
          <legend>{t('f_area')}</legend>
          {chipsOf('area', AREAS, (v) => areaName(v, lang))}
        </fieldset>
        <fieldset>
          <legend>{t('f_date')}</legend>
          <div className="chips">
            <Chip on={f.date === today} onClick={() => set({ date: f.date === today ? undefined : today, time: undefined })}>
              {t('today')}
            </Chip>
            <Chip on={f.date === addDays(today, 1)} onClick={() => set({ date: f.date === addDays(today, 1) ? undefined : addDays(today, 1), time: undefined })}>
              {t('tomorrow')}
            </Chip>
          </div>
          <div className="row gap-s">
            <input type="date" min={today} value={f.date ?? ''} onChange={(e) => set({ date: e.target.value || undefined })} aria-label={t('f_date')} />
            <input type="time" value={f.time ?? ''} disabled={!f.date} onChange={(e) => set({ time: e.target.value || undefined })} aria-label={t('time')} />
          </div>
          <label>
            {t('f_party')}
            <select value={f.party ?? ''} onChange={(e) => set({ party: Number(e.target.value) || undefined })}>
              <option value="">—</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t(n === 1 ? 'onePerson' : 'people', { n })}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>{t('f_budget')}</legend>
          {chipsOf('budget', BUDGET_BANDS, (v) => t(`budget_${v}`))}
        </fieldset>
        <fieldset>
          <legend>{t('food')}</legend>
          {chipsOf('dietary', DIET_SUPPORT, (v) => t(`diet_${v}`))}
          <div className="chips">
            <Chip on={!!f.halal} onClick={() => set({ halal: f.halal ? undefined : true })}>
              {t('halalMark')}
            </Chip>
          </div>
          <div className="fgroup">
            <span className="fgroup-label">{t('f_allergens')}</span>
            {chipsOf('allergens', ALLERGENS, (v) => t(`allergen_${v}`))}
          </div>
          <div className="fgroup">
            <span className="fgroup-label">{t('f_adjust')}</span>
            {chipsOf('adjust', ['less', 'remove'] as const, (v) => t(`adjust_${v}`))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t('f_languages')}</legend>
          {chipsOf('languages', SHOP_LANGS, (v) => t(`lang_${v}`))}
          <div className="chips">
            <Chip on={!!f.solo} onClick={() => set({ solo: f.solo ? undefined : true })}>
              {t('soloWelcome')}
            </Chip>
          </div>
        </fieldset>
        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => setF({})}>
            {t('clear')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onApply(f);
              onClose();
            }}
          >
            {t('apply')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
