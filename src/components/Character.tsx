// オリジナルキャラクター「まる」：各画面に登場して一言添え、AIで希望を絞り込み条件に置き換えたり、質問に答えたりする。
// 画面上部の言語の横にアイコンだけ置き、タップで開く。設定で非表示（HIDE）にでき、薄く残したアイコンをタッチすると、また話しかけられる。AI機能はキャラクターが出ている間だけ働く
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FAQ, FAQ_IDS, type FaqId } from '../../shared/faq';
import type { Filters } from '../../shared/filters';
import { jstDateString } from '../../shared/time';
import { ApiError, get, post } from '../api';
import { useApp } from '../store';
import { filterChipLabels } from './filterLabels';

export type Mood = 'happy' | 'sorry' | 'wow';

/** まる：宇治の茶葉から生まれた抹茶の精 */
export function Mascot({ size = 56, mood = 'happy' }: { size?: number; mood?: Mood }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="mascot-svg">
      <path d="M6 40l-4 7M58 40l4 7" stroke="#24302a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="2" cy="47" r="2" fill="#24302a" />
      <circle cx="62" cy="47" r="2" fill="#24302a" />
      <path d="M25 56l-1 5M39 56l1 5" stroke="#24302a" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="23" cy="61.5" rx="4" ry="1.8" fill="#24302a" />
      <ellipse cx="41" cy="61.5" rx="4" ry="1.8" fill="#24302a" />
      <ellipse cx="32" cy="36" rx="26" ry="22" fill="#86bf6e" stroke="#2f5d3a" strokeWidth="1.5" />
      <path d="M8 30c5-12 43-12 48 0c-6-4-42-4-48 0z" fill="#c8e6a6" />
      <path d="M33 14c0-4 1-6 2-7M34 10c4-5 10-4 12-1-4 2-8 3-12 1zM33 11c-3-4-8-4-10-1 3 2 7 2 10 1z" fill="#3f8f4a" stroke="#2f5d3a" strokeWidth="1" />
      {mood === 'sorry' ? (
        <>
          <path d="M20 31l6 2M44 31l-6 2" stroke="#24302a" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="24" cy="36" r="2.6" fill="#24302a" />
          <circle cx="40" cy="36" r="2.6" fill="#24302a" />
          <path d="M28 46c2.5-2 5.5-2 8 0" fill="none" stroke="#24302a" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M52 22c2 3 2 5 0 6-2-1-2-3 0-6z" fill="#9fd3ff" />
        </>
      ) : (
        <>
          <circle cx="24" cy="36" r="3.2" fill="#24302a" />
          <circle cx="40" cy="36" r="3.2" fill="#24302a" />
          <circle cx="25" cy="35" r="1" fill="#fff" />
          <circle cx="41" cy="35" r="1" fill="#fff" />
          {mood === 'wow' ? (
            <ellipse cx="32" cy="45" rx="3.5" ry="4" fill="#6b1f2a" />
          ) : (
            <path d="M27 43c3 3.5 7 3.5 10 0" fill="none" stroke="#24302a" strokeWidth="2.4" strokeLinecap="round" />
          )}
        </>
      )}
      <ellipse cx="16" cy="42" rx="4" ry="2.4" fill="#f59a92" opacity=".75" />
      <ellipse cx="48" cy="42" rx="4" ry="2.4" fill="#f59a92" opacity=".75" />
    </svg>
  );
}

interface Scope {
  line?: string;
  mood?: Mood;
  listingId?: string;
  /** 探す画面：AIが置き換えた条件を一覧に反映する */
  onFilters?: (f: Filters) => void;
  /** 探す画面：今の絞り込み条件（希望はこれに足す） */
  filters?: Filters;
  /** false のときは一言を変えない（一覧の上に重ねて開いた画面など） */
  enabled?: boolean;
}

const CharCtx = createContext<{ scope: Scope; setScope: (s: Scope) => void } | null>(null);

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<Scope>({});
  return <CharCtx.Provider value={{ scope, setScope }}>{children}</CharCtx.Provider>;
}

/** 各画面でキャラクターに一言添えてもらう */
export function useCharacter(s: Scope) {
  const c = useContext(CharCtx)!;
  const { line, mood, listingId, onFilters, filters, enabled = true } = s;
  const filtersKey = JSON.stringify(filters ?? null);
  useEffect(() => {
    if (!enabled) return;
    c.setScope({ line, mood, listingId, onFilters, filters });
    return () => c.setScope({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, mood, listingId, onFilters, filtersKey, enabled]);
}

// タップで選べる希望（文言は辞書の wishChips と同じ順）
const WISH_CODES: ((today: string) => Filters)[] = [
  () => ({ crowd: ['LOCAL'] }),
  () => ({ category: ['RESTAURANT'] }),
  () => ({ category: ['EXPERIENCE'] }),
  () => ({ dietary: ['vegetarian'] }),
  () => ({ solo: true }),
  () => ({ ownerDistance: ['OWNER'] }),
  () => ({ guidebook: 'none' }),
  (today) => ({ date: today }),
];

function mergeFilters(a: Filters, b: Filters): Filters {
  const out: Filters = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Filters, unknown][]) {
    const prev = out[k];
    if (Array.isArray(prev) && Array.isArray(v)) (out as Record<string, unknown>)[k] = [...new Set([...prev, ...v])];
    else (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

const INTRO_KEY = 'hl.charIntroSeen';

type Bubble = { who: 'me' | 'char'; text: string; extra?: ReactNode };

export function Character() {
  const c = useContext(CharCtx)!;
  const { t, lang, profile, setPrefs, me, config } = useApp();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Bubble[]>([]);
  const [mode, setMode] = useState<'menu' | 'wish' | 'ask'>('menu');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<Mood>('happy');
  // 「ちがうよ」で戻せるよう、まるが条件を変える前の絞り込みを覚えておく
  const [before, setBefore] = useState<Filters | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);
  const { line, listingId, onFilters } = c.scope;
  const current = c.scope.filters ?? {};

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' });
  }, [log]);
  useEffect(() => {
    setMode(onFilters ? 'wish' : listingId ? 'ask' : 'menu');
  }, [onFilters, listingId, open]);

  // 初めて来た人には、まるの横に「わからないことがあったらタップしてね」を数秒だけ出す（1回だけ）
  const [intro, setIntro] = useState(false);
  // 吹き出しは、まるの左に空いている幅に収める
  const anchor = useRef<HTMLSpanElement>(null);
  const [introWidth, setIntroWidth] = useState(240);
  // 各画面の一言も、まるの左に吹き出しで数秒しゃべる（タップか時間で引っ込む。初回の案内が先）
  const [lineSeen, setLineSeen] = useState<string | undefined>();
  useEffect(() => {
    if (intro || !line) return;
    const id = setTimeout(() => setLineSeen(line), 8000);
    return () => clearTimeout(id);
  }, [line, intro]);
  const bubble = intro ? t('charIntro') : line && lineSeen !== line ? line : null;
  useEffect(() => {
    if (!bubble || !anchor.current) return;
    setIntroWidth(Math.max(80, Math.min(240, anchor.current.getBoundingClientRect().left - 18)));
  }, [bubble]);
  const endIntro = useCallback(() => {
    setIntro(false);
    try {
      localStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* 保存できなくても表示には影響しない */
    }
  }, []);
  useEffect(() => {
    if (profile.characterHidden) return;
    try {
      if (localStorage.getItem(INTRO_KEY)) return;
    } catch {
      /* 読めない環境でも表示はする */
    }
    setIntro(true);
    // 見せ終えてから「表示済み」にする（すぐ別の画面へ移ったときは、次に出す）
    const id = setTimeout(endIntro, 6000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.characterHidden]);

  const say = useCallback((b: Bubble) => setLog((l) => [...l.slice(-20), b]), []);

  if (profile.characterHidden) {
    return (
      <button
        className="char-tab"
        aria-label={t('showCharacter')}
        onClick={() => {
          void setPrefs({ characterHidden: false });
          setOpen(true);
        }}
      >
        <Mascot size={28} />
      </button>
    );
  }

  const chipLabels = t('wishChips').split('|');

  async function sendWish(raw: string) {
    if (!raw.trim() || busy) return;
    say({ who: 'me', text: raw });
    setBusy(true);
    try {
      const r = await post<{ filters: Filters; understood: boolean; source: 'ai' | 'rules' }>('/ai/wish', { text: raw, lang });
      if (!r.understood) {
        setMood('sorry');
        say({ who: 'char', text: t('charSorry') });
      } else {
        setMood('happy');
        // 今の絞り込みに足す（ほかの条件は消さない）。誤解だったときは、変える前に戻す
        const base = correcting && before ? before : current;
        const merged = mergeFilters(base, r.filters);
        setBefore(base);
        say({
          who: 'char',
          text: correcting ? t('charRetry') : t('charUsedConditions'),
          extra: (
            <>
              <ConditionChips f={r.filters} />
              {r.source === 'rules' && !config?.ai && <p className="small muted">{t('charAiOff')}</p>}
            </>
          ),
        });
        setCorrecting(false);
        onFilters?.(merged);
      }
    } catch {
      say({ who: 'char', text: t('error') });
    } finally {
      setBusy(false);
      setText('');
    }
  }

  function tapWish(i: number) {
    const f = WISH_CODES[i](jstDateString());
    const merged = mergeFilters(current, f);
    setBefore(current);
    say({ who: 'me', text: chipLabels[i] });
    say({ who: 'char', text: t('charUsedConditions'), extra: <ConditionChips f={f} /> });
    onFilters?.(merged);
  }

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    say({ who: 'me', text: question });
    setBusy(true);
    try {
      const r = await post<{ scope: 'shop' | 'general'; known: boolean; answer: string }>('/ai/ask', { question, lang, listingId });
      if (r.known) {
        setMood('happy');
        say({ who: 'char', text: r.answer, extra: r.scope === 'general' ? <p className="small muted">{t('charGeneralNote')}</p> : undefined });
      } else if (r.scope === 'shop') {
        setMood('sorry');
        say({
          who: 'char',
          text: t('charNotKnown'),
          extra: (
            <button className="btn btn-small" onClick={() => void inquire(question)}>
              {t('charAskShopYes')}
            </button>
          ),
        });
      } else {
        setMood('sorry');
        say({ who: 'char', text: t('charCannotAnswer'), extra: <p className="small">{t('charSupport')}</p> });
      }
    } catch {
      say({ who: 'char', text: t('error') });
    } finally {
      setBusy(false);
      setText('');
    }
  }

  /** 持っていない情報は、旅行者が望めば事業者へ翻訳メッセージで問い合わせる */
  async function inquire(question: string) {
    if (!listingId) return;
    if (me?.role !== 'TRAVELER') {
      say({
        who: 'char',
        text: t('inquiryNeedsAccount'),
        extra: (
          <Link className="btn btn-small" to={`/${lang}/signup?next=${encodeURIComponent(location.pathname)}`}>
            {t('signup')}
          </Link>
        ),
      });
      return;
    }
    try {
      try {
        await post(`/listings/${listingId}/chat`, { text: question });
      } catch (e) {
        // 通信が途中で切れても届いていることがある。届いていれば成功として扱う
        if (e instanceof ApiError && e.code === 'blocked') throw e;
        const r = await get<{ messages: { fromMe: boolean; original: string }[] }>(`/listings/${listingId}/chat?lang=${lang}`).catch(() => null);
        const last = r?.messages.filter((m) => m.fromMe).pop();
        if (last?.original.trim() !== question.trim()) throw e;
      }
      setMood('wow');
      say({
        who: 'char',
        text: t('inquirySent'),
        extra: (
          <Link className="btn btn-small" to={`/${lang}/chat/${listingId}`}>
            {t('chatWithShop')}
          </Link>
        ),
      });
    } catch (e) {
      say({ who: 'char', text: e instanceof ApiError && e.code === 'blocked' ? t('blockedByShop') : t('error') });
    }
  }

  function showFaq(id: FaqId) {
    const f = FAQ[id][lang];
    say({ who: 'me', text: f.q });
    say({ who: 'char', text: f.a, extra: <p className="small muted">{t('charGeneralNote')}</p> });
  }

  return (
    <span className="char-anchor" ref={anchor}>
      <button
        className="char-fab"
        aria-label={`${t('charName')} – ${t('charFaq')}`}
        aria-expanded={open}
        onClick={() => {
          if (!open && !log.length) {
            const pokes = t('charPokes').split('|');
            say({ who: 'char', text: pokes[Math.floor(Math.random() * pokes.length)] });
          }
          setOpen(!open);
          if (intro) endIntro();
          setLineSeen(line);
        }}
      >
        <Mascot size={34} mood={c.scope.mood ?? mood} />
      </button>
      {bubble && !open && (
        <span
          key={bubble}
          className={`char-intro${introWidth < 170 ? ' char-intro-tall' : ''}`}
          role="status"
          style={{ maxWidth: introWidth }}
          onClick={() => (intro ? endIntro() : setLineSeen(line))}
        >
          {bubble}
        </span>
      )}
      {open && (
        <div className="char-panel" role="dialog" aria-label={t('charName')}>
          <header className="char-head">
            <Mascot size={36} mood={mood} />
            <span className="stack-s">
              <strong>{t('charName')}</strong>
              <span className="small muted">{t('charTitle')}</span>
            </span>
            <span className="spacer" />
            <button
              className="link small"
              onClick={() => {
                setOpen(false);
                void setPrefs({ characterHidden: true });
              }}
            >
              {t('charHide')}
            </button>
            <button className="icon-btn" aria-label={t('close')} onClick={() => setOpen(false)}>
              ✕
            </button>
          </header>
          <div className="char-log" aria-live="polite">
            {line && <div className="msg msg-char">{line}</div>}
            {log.map((b, i) => (
              <div key={i} className={`msg msg-${b.who === 'me' ? 'me' : 'char'}`}>
                {b.text}
                {b.extra}
              </div>
            ))}
            {busy && <div className="msg msg-char muted">{t('charThinking')}</div>}
            <div ref={logEnd} />
          </div>
          <nav className="char-tabs" role="tablist">
            {onFilters && (
              <button role="tab" aria-selected={mode === 'wish'} className={mode === 'wish' ? 'on' : ''} onClick={() => setMode('wish')}>
                {t('charWishTitle')}
              </button>
            )}
            <button role="tab" aria-selected={mode === 'ask'} className={mode === 'ask' ? 'on' : ''} onClick={() => setMode('ask')}>
              {listingId ? t('charAskShop') : t('charAskGeneral')}
            </button>
            <button role="tab" aria-selected={mode === 'menu'} className={mode === 'menu' ? 'on' : ''} onClick={() => setMode('menu')}>
              {t('charFaq')}
            </button>
          </nav>
          {mode === 'menu' && (
            <div className="char-chips">
              {FAQ_IDS.map((id) => (
                <button key={id} className="chip" onClick={() => showFaq(id)}>
                  {FAQ[id][lang].q}
                </button>
              ))}
            </div>
          )}
          {mode === 'wish' && (
            <>
              <div className="char-chips">
                {chipLabels.map((label, i) => (
                  <button key={label} className="chip" onClick={() => tapWish(i)}>
                    {label}
                  </button>
                ))}
                {log.some((b) => b.who === 'char' && b.extra) && (
                  <button
                    className="chip chip-warn"
                    onClick={() => {
                      // 誤解したときは謝って、希望を確かめ直してから調べ直す
                      setMood('sorry');
                      setCorrecting(true);
                      if (before) onFilters?.(before);
                      say({ who: 'char', text: t('charSorry') });
                    }}
                  >
                    {t('charWrong')}
                  </button>
                )}
              </div>
              <form
                className="char-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendWish(text);
                }}
              >
                <input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder={t('charWishPlaceholder')} aria-label={t('charWishTitle')} />
                <button className="btn btn-small" disabled={busy || !text.trim()}>
                  {t('charWishGo')}
                </button>
              </form>
            </>
          )}
          {mode === 'ask' && (
            <>
              {listingId && (
                <div className="char-chips">
                  {(['cash', 'solo', 'tip'] as FaqId[]).map((id) => (
                    <button key={id} className="chip" onClick={() => void ask(FAQ[id][lang].q)}>
                      {FAQ[id][lang].q}
                    </button>
                  ))}
                </div>
              )}
              <form
                className="char-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(text);
                }}
              >
                <input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder={t('charAskPlaceholder')} aria-label={t('charAsk')} />
                <button className="btn btn-small" disabled={busy || !text.trim()}>
                  {t('charAsk')}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </span>
  );
}

function ConditionChips({ f }: { f: Filters }) {
  const { lang } = useApp();
  return (
    <ul className="chips">
      {filterChipLabels(f, lang).map((l) => (
        <li key={l.key + l.label} className="chip chip-cond">
          {l.label}
        </li>
      ))}
    </ul>
  );
}
