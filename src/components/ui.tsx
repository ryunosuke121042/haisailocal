import { useState, type ReactNode } from 'react';
import { areaLabel } from '../../shared/areas';
import type { Lang } from '../../shared/constants';
import { post } from '../api';
import { useApp } from '../store';
import type { LocalInfo, Rating, TText } from '../types';

/** 自動翻訳された文。「原文を見る」で原文を確認でき、「翻訳がおかしい」で報告できる */
export function TT({ v, as = 'span', context = '' }: { v: TText | undefined | null; as?: 'span' | 'p' | 'div'; context?: string }) {
  const { t, lang } = useApp();
  const [orig, setOrig] = useState(false);
  const [reported, setReported] = useState(false);
  if (!v || !v.text) return null;
  const Tag = as;
  const translated = v.machine && v.text !== v.original;
  return (
    <Tag className="tt">
      <span className={as === 'span' ? undefined : 'pre'}>{orig ? v.original : v.text}</span>
      {translated && (
        <span className="tt-tools">
          <button type="button" className="link small tt-toggle" onClick={() => setOrig(!orig)}>
            {orig ? t('showTranslation') : t('showOriginal')}
          </button>
          {reported ? (
            <span className="small muted">{t('reportThanks')}</span>
          ) : (
            <button
              type="button"
              className="link small tt-toggle"
              onClick={async () => {
                await post('/translation-report', { source: v.original, shown: v.text, targetLang: lang, context }).catch(() => {});
                setReported(true);
              }}
            >
              {t('reportTranslation')}
            </button>
          )}
        </span>
      )}
    </Tag>
  );
}

/** お店の目安情報（自己申告）。判定や点数は載せない */
export function LocalInfoView({ info, station, compact }: { info: LocalInfo; station?: string | null; compact?: boolean }) {
  const { t } = useApp();
  const rows: [string, string | null][] = [
    [t('f_crowd'), info.crowd && t(`crowd_${info.crowd}`)],
    [t('f_regulars'), info.regulars && t(`regulars_${info.regulars}`)],
    [t('f_guidebook'), info.guidebook == null ? null : t(info.guidebook ? 'guidebook_listed' : 'guidebook_none')],
    [t('f_years'), info.yearsBand && t(`years_${info.yearsBand}`)],
    [t('f_ownerDistance'), info.ownerDistance && t(`owner_${info.ownerDistance}`)],
    [t('f_stationMax'), station ?? null],
  ];
  if (compact) {
    return (
      <ul className="chips local-chips">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <li key={k} className="chip chip-local" title={k}>
              {v}
            </li>
          ))}
      </ul>
    );
  }
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} className="kv-row">
          <dt>{k}</dt>
          <dd>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 評価（アプリで予約して来店した旅行者の星の平均と件数）。評価がなければ「新しいお店」 */
export function Stars({ rating }: { rating: Rating }) {
  const { t } = useApp();
  if (!rating.count) return <span className="badge badge-new">{t('newShop')}</span>;
  return (
    <span className="stars" aria-label={`${rating.avg} / 5`}>
      ★ {rating.avg?.toFixed(1)} <span className="muted small">({t('ratingCount', { n: rating.count })})</span>
    </span>
  );
}

/** おすすめの理由（当てはまった条件）を一言にする */
export function reasonText(code: string, t: ReturnType<typeof useApp>['t']): string {
  const [k, v] = code.split(':');
  const map: Record<string, () => string> = {
    crowd: () => t(`crowd_${v as 'LOCAL'}`),
    regulars: () => t(`regulars_${v as 'REGULARS'}`),
    guidebook: () => t(`guidebook_${v as 'none'}`),
    years: () => t(`years_${v as 'OVER_30'}`),
    owner: () => t(`owner_${v as 'OWNER'}`),
    station: () => t('withinMin', { n: v }),
    avail: () => t('reasonAvail'),
    dietary: () => t(`diet_${v as 'vegan'}`),
    halal: () => t('halalMark'),
    porkFree: () => t('porkFreeRef'),
    adjust: () => t(`adjust_${v as 'less'}`),
    lang: () => t('speaksLang', { lang: t(`lang_${v as 'en'}`) }),
    solo: () => t('soloWelcome'),
    allergen: () => (v === 'partial' ? t('allergenPartialShort') : t('allergenShop')),
  };
  return map[k]?.() ?? code;
}

export function MapsButton({ lat, lng, address }: { lat: number | null; lng: number | null; address: string }) {
  const { t } = useApp();
  // Android・iPhone では Google マップのアプリが入っていればアプリで、なければブラウザ版で開く
  const q = lat != null && lng != null ? `${lat},${lng}` : address;
  return (
    <a className="btn btn-maps" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`} target="_blank" rel="noopener noreferrer">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
      </svg>
      {t('openInMaps')}
    </a>
  );
}

const CUR_FMT: Record<string, Intl.NumberFormatOptions> = { JPY: { maximumFractionDigits: 0 }, KRW: { maximumFractionDigits: 0 }, TWD: { maximumFractionDigits: 0 } };

export function formatCurrency(amount: number, cur: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, ...(CUR_FMT[cur] ?? { maximumFractionDigits: amount < 100 ? 2 : 0 }) }).format(amount);
  } catch {
    return `${cur} ${amount.toFixed(2)}`;
  }
}

export function yen(n: number) {
  return `¥${n.toLocaleString('ja-JP')}`;
}

/** 料金は日本円を正とし、選んだ通貨の目安額を併記する */
export function Money({ jpy, suffix }: { jpy: number; suffix?: string }) {
  const { fx, currency, lang, t } = useApp();
  const rate = fx?.rates[currency];
  return (
    <span className="money">
      <strong>{yen(jpy)}</strong>
      {suffix && <span className="muted"> {suffix}</span>}
      {currency !== 'JPY' && rate ? <span className="muted"> {t('fxEstimate', { amount: formatCurrency(jpy * rate, currency, lang) })}</span> : null}
    </span>
  );
}

/** 為替の目安の注記：「目安・○月○日時点」。取得に失敗したら最後のレートと取得日時 */
export function FxNote() {
  const { fx, currency, lang, t } = useApp();
  if (currency === 'JPY') return null;
  if (!fx?.rates[currency]) return <p className="fxnote">{t('fxUnavailable')}</p>;
  const date = fx.fetchedAt ? new Date(fx.fetchedAt).toLocaleDateString(lang, { month: 'short', day: 'numeric' }) : '—';
  return (
    <p className="fxnote">
      {fx.stale && <>{t('fxStale')} </>}
      {t('fxNote', { date })}
    </p>
  );
}

export function areaName(area: string, lang: Lang) {
  return areaLabel(area, lang);
}

export function Spinner() {
  const { t } = useApp();
  return <div className="spinner" role="status" aria-label={t('loading')} />;
}

export function ErrorBox({ onRetry, text }: { onRetry?: () => void; text?: string }) {
  const { t } = useApp();
  return (
    <div className="notice notice-error">
      {text ?? t('error')}{' '}
      {onRetry && (
        <button className="link" onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`chip chip-toggle ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

export function toggle<T>(arr: T[] | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useApp();
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('close')}>
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Photo({ src, alt }: { src: string | null; alt: string }) {
  return src ? <img src={src} alt={alt} loading="lazy" /> : <div className="photo-ph" aria-hidden />;
}

/** 日本時間の日時を表示する（旅行者の端末の時刻に引きずられないように） */
export function jstText(iso: string | Date, lang: string) {
  return `${new Date(iso).toLocaleString(lang, { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })} (JST)`;
}

/** 期限は「その時刻より前」なので、1分前（「前日まで」なら前日の23:59）を表示する */
export function deadlineText(iso: string | Date, lang: string) {
  return jstText(new Date(new Date(iso).getTime() - 60_000), lang);
}

export function dateText(date: string, lang: string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString(lang, { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
}
