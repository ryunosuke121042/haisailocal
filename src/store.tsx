import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CURRENCIES, LANGS, type Lang } from '../shared/constants';
import type { Prefs } from '../shared/filters';
import { jstDateString } from '../shared/time';
import { get, put } from './api';
import { translate, type Key } from './i18n';
import type { Config, Me } from './types';

// 端末に残す情報（表示言語・通貨、最初の質問の答え、予約の下書きなど）。使えない環境でも動くようにする
export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function store(key: string, value: unknown) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 保存できなくても画面は動く */
  }
}

/** アカウントがなくても端末に残す設定（ログイン中はアカウントの値を優先する） */
export interface LocalPrefs {
  lang?: Lang;
  currency?: string;
  /** 最初の質問を終えたか（スキップを含む） */
  chosen?: boolean;
  prefs?: Prefs;
  prefsDate?: string;
  sensitiveConsent?: boolean;
  characterHidden?: boolean;
}

export interface Profile {
  currency: string;
  prefs: Prefs;
  prefsDate?: string;
  sensitiveConsent: boolean;
  characterHidden: boolean;
}

export interface Fx {
  rates: Record<string, number>;
  fetchedAt: string | null;
  source: string;
  stale: boolean;
}

interface Ctx {
  me: Me | null;
  setMe: (m: Me | null) => void;
  refreshMe: () => Promise<Me | null>;
  config: Config | null;
  ready: boolean;
  lang: Lang;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  currency: string;
  prefs: LocalPrefs;
  profile: Profile;
  setPrefs: (p: LocalPrefs) => Promise<void>;
  fx: Fx | null;
  unreadMessages: number;
  unreadNotifications: number;
  refreshUnread: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

/** 端末の言語設定から表示言語を推定する */
export function guessLang(): Lang {
  const saved = load<LocalPrefs>('hl.prefs', {}).lang;
  if (saved && (LANGS as readonly string[]).includes(saved)) return saved;
  const n = (navigator.language || 'en').toLowerCase().slice(0, 2);
  return (LANGS as readonly string[]).includes(n) ? (n as Lang) : 'en';
}

/** 端末の地域設定から通貨を推定する */
export function guessCurrency(): string {
  const n = navigator.language || '';
  const map: [RegExp, string][] = [
    [/SG/, 'SGD'],
    [/HK/, 'HKD'],
    [/TW/, 'TWD'],
    [/GB/, 'GBP'],
    [/AU/, 'AUD'],
    [/^zh/, 'CNY'],
    [/^ko/, 'KRW'],
    [/^ja/, 'JPY'],
    [/^th/, 'THB'],
    [/^(fr|de|es|it|nl|pt-PT|fi|el)/, 'EUR'],
  ];
  const hit = map.find(([re]) => re.test(n))?.[1] ?? 'USD';
  return (CURRENCIES as readonly string[]).includes(hit) ? hit : 'USD';
}

/** 今日の希望を、その日に初めて開いたときに確認し直す */
export function needsTodayCheck(p: Profile, chosen: boolean | undefined) {
  const has = !!p.prefs.budget || !!p.prefs.dietary?.length || !!p.prefs.religious?.length || !!p.prefs.allergens?.length;
  return !!chosen && has && p.prefsDate !== jstDateString();
}

export function AppProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [ready, setReady] = useState(false);
  const [prefs, setLocal] = useState<LocalPrefs>(() => load('hl.prefs', {}));
  const [fx, setFx] = useState<Fx | null>(null);
  const [unread, setUnread] = useState({ messages: 0, notifications: 0 });

  const refreshMe = useCallback(async () => {
    const r = await get<{ user: Me | null; config: Config }>('/me');
    setMe(r.user);
    setConfig(r.config);
    return r.user;
  }, []);

  useEffect(() => {
    refreshMe()
      .catch(() => {})
      .finally(() => setReady(true));
    get<Fx>('/fx').then(setFx).catch(() => {});
  }, [refreshMe]);

  const refreshUnread = useCallback(() => {
    if (me?.role !== 'TRAVELER') return setUnread((u) => (u.messages || u.notifications ? { messages: 0, notifications: 0 } : u));
    get<{ unread: number; unreadMessages: number }>('/notifications')
      .then((r) => setUnread({ messages: r.unreadMessages, notifications: r.unread }))
      .catch(() => {});
  }, [me]);

  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 60_000);
    return () => clearInterval(id);
  }, [refreshUnread]);

  // 表示言語は URL で決める。ログイン中なら、メールの言語にも使うためアカウントに保存する
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
    if (prefs.lang !== lang) {
      const next = { ...prefs, lang };
      setLocal(next);
      store('hl.prefs', next);
    }
    if (me?.role === 'TRAVELER' && me.lang !== lang) {
      put<{ user: Me }>('/me', { lang })
        .then((r) => setMe(r.user))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, me?.id]);

  const traveler = me?.role === 'TRAVELER' ? me : null;
  // 最初の質問はアカウントに答えが残っていれば済んだものとする（別の端末でログインしたとき）
  const prefsView = useMemo<LocalPrefs>(() => (traveler?.prefsDate && !prefs.chosen ? { ...prefs, chosen: true } : prefs), [traveler, prefs]);
  const currency = (traveler ? traveler.currency : prefs.currency) ?? guessCurrency();
  const profile = useMemo<Profile>(
    () => ({
      currency,
      prefs: (traveler ? traveler.prefs : prefs.prefs) ?? {},
      prefsDate: (traveler ? traveler.prefsDate : prefs.prefsDate) ?? undefined,
      sensitiveConsent: traveler ? !!traveler.sensitiveConsentAt : !!prefs.sensitiveConsent,
      characterHidden: (traveler ? traveler.characterHidden : prefs.characterHidden) ?? false,
    }),
    [traveler, prefs, currency],
  );

  const setPrefs = useCallback(
    async (p: LocalPrefs) => {
      const next = { ...load<LocalPrefs>('hl.prefs', {}), ...p };
      setLocal(next);
      store('hl.prefs', next);
      if (me?.role === 'TRAVELER') {
        const body: Record<string, unknown> = {};
        if (p.currency && p.currency !== me.currency) body.currency = p.currency;
        if (p.prefs) body.prefs = p.prefs;
        if (p.prefsDate) body.prefsDate = p.prefsDate;
        if (p.sensitiveConsent !== undefined) body.sensitiveConsent = p.sensitiveConsent;
        if (p.characterHidden !== undefined) body.characterHidden = p.characterHidden;
        if (Object.keys(body).length) {
          const r = await put<{ user: Me }>('/me', body);
          setMe(r.user);
        }
      }
    },
    [me],
  );

  const t = useCallback((key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);

  const value = useMemo<Ctx>(
    () => ({
      me,
      setMe,
      refreshMe,
      config,
      ready,
      lang,
      t,
      currency,
      prefs: prefsView,
      profile,
      setPrefs,
      fx,
      unreadMessages: unread.messages,
      unreadNotifications: unread.notifications,
      refreshUnread,
    }),
    [me, refreshMe, config, ready, lang, t, currency, prefsView, profile, setPrefs, fx, unread, refreshUnread],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppProvider missing');
  return c;
}
