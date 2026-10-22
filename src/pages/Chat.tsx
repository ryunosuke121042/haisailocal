// 翻訳チャット：旅行者は英語か簡体字で書き、事業者には日本語で届く。事業者の返信は旅行者の言語に翻訳して表示する
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { LIMITS } from '../../shared/constants';
import { ApiError, get, post } from '../api';
import { ErrorBox, Photo, Spinner, TT } from '../components/ui';
import { useApp } from '../store';
import { useCharacter } from '../components/Character';
import { MessagePhoto, PhotoAttachButton, PhotoPreview } from '../components/ChatPhoto';
import type { ChatMessage } from '../types';

interface Thread {
  listingId: string;
  shop: string;
  canSend: boolean;
  blocked: boolean;
  messages: ChatMessage[];
}

export function Chat() {
  const { listingId } = useParams();
  const { t, lang, me, config, refreshUnread } = useApp();
  const [th, setTh] = useState<Thread | null>(null);
  const [err, setErr] = useState(false);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useCharacter({ line: t('say_chat'), listingId });

  const load = useCallback(() => {
    if (me?.role !== 'TRAVELER') return;
    get<Thread>(`/listings/${listingId}/chat?lang=${lang}`)
      .then((r) => {
        setTh(r);
        setErr(false);
        refreshUnread();
      })
      .catch(() => setErr(true));
  }, [listingId, lang, me, refreshUnread]);

  useEffect(() => {
    load();
    // 開いている間は返信を確認する
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);
  // scrollIntoView は新しいブラウザでは Promise を返す。返り値を React に渡すと「片付けの関数」として呼ばれて落ちるので、{ } で包んで何も返さない
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [th?.messages.length]);

  if (me?.role !== 'TRAVELER') return <Navigate to={`/${lang}/signup?next=${encodeURIComponent(`/${lang}/chat/${listingId}`)}`} replace />;
  if (!th) return err ? <ErrorBox onRetry={load} /> : <Spinner />;

  /** 送信がエラーになったとき、実際には届いていたかを会話を読み直して確かめる */
  async function delivered(sentBefore: number, body: string, withPhoto: boolean) {
    try {
      const r = await get<Thread>(`/listings/${listingId}/chat?lang=${lang}`);
      setTh(r);
      const mine = r.messages.filter((m) => m.fromMe);
      const last = mine[mine.length - 1];
      return mine.length > sentBefore && last.original.trim() === body.trim() && (!withPhoto || !!last.photo);
    } catch {
      return false;
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !photo) return;
    setBusy(true);
    setSendErr(null);
    const sentBefore = th?.messages.filter((m) => m.fromMe).length ?? 0;
    const done = () => {
      setText('');
      setPhoto(null);
    };
    try {
      await post(`/listings/${listingId}/chat`, { text, ...(photo ? { photo } : {}) });
      done();
      load();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'blocked') setSendErr(t('blockedByShop'));
      // 通信が途中で切れても、メッセージ自体は届いていることがある。届いていればエラーにしない
      else if (await delivered(sentBefore, text, !!photo)) done();
      else setSendErr(t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat stack">
      <header className="row gap-s">
        <Link to={`/${lang}/shop/${th.listingId}`} className="grow">
          <h1>{th.shop}</h1>
        </Link>
      </header>
      <p className="small muted">{config?.translator === 'none' ? t('translatorOff') : t('chatHelp')}</p>
      <div className="chat-log">
        {th.messages.length === 0 && <p className="muted small">{t('chatEmpty')}</p>}
        {th.messages.map((m) => (
          <div key={m.id} className={`msg ${m.fromMe ? 'msg-me' : 'msg-them'}`}>
            {m.photo && <MessagePhoto src={m.photo} alt={t('photo')} />}
            <TT v={m} as="div" />
            <time className="small muted">
              {new Date(m.at).toLocaleString(lang, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
        ))}
        <div ref={end} />
      </div>
      {th.blocked ? (
        <p className="notice notice-warn">{t('blockedByShop')}</p>
      ) : th.canSend ? (
        <>
          {/* よくある質問：タップすると入力欄に入る（そのまま送るか、書き足して送る） */}
          <section className="chat-quick" aria-label={t('chatQuickTitle')}>
            <p className="small muted">{t('chatQuickTitle')}</p>
            <div className="scene-row">
              {t('chatQuick')
                .split('|')
                .map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="chip"
                    onClick={() => {
                      // 同じ質問は二重に入れない
                      setText((cur) => (cur.includes(q) ? cur : cur.trim() ? `${cur.trimEnd()}\n${q}` : q).slice(0, LIMITS.messageMaxChars));
                      input.current?.focus();
                    }}
                  >
                    {q}
                  </button>
                ))}
            </div>
          </section>
          {photo && <PhotoPreview src={photo} removeLabel={t('removePhoto')} onRemove={() => setPhoto(null)} />}
          <form className="chat-input" onSubmit={send}>
            <PhotoAttachButton
              labels={{ attach: t('attachPhoto'), remove: t('removePhoto'), unreadable: t('photoUnreadable') }}
              disabled={busy}
              onPick={setPhoto}
            />
            <textarea
              ref={input}
              rows={2}
              maxLength={LIMITS.messageMaxChars}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('chatPlaceholder')}
              aria-label={t('chatPlaceholder')}
            />
            <button className="btn btn-primary" disabled={busy || (!text.trim() && !photo)}>
              {t('send')}
            </button>
          </form>
          <p className={`chat-count small muted ${text.length > LIMITS.messageMaxChars * 0.9 ? 'warn' : ''}`} aria-live="polite">
            {text.length}/{LIMITS.messageMaxChars}
          </p>
        </>
      ) : null}
      {sendErr && <p className="notice notice-error">{sendErr}</p>}
    </div>
  );
}

interface ThreadSummary {
  listingId: string;
  shop: string;
  photo: string | null;
  lastAt: string;
  unread: number;
}

export function Messages() {
  const { t, lang, me } = useApp();
  const [list, setList] = useState<ThreadSummary[] | null>(null);
  const [err, setErr] = useState(false);
  useCharacter({ line: t('say_messages') });
  const load = useCallback(() => {
    if (me?.role !== 'TRAVELER') return;
    setErr(false);
    get<{ results: ThreadSummary[] }>(`/conversations?lang=${lang}`)
      .then((r) => setList(r.results))
      .catch(() => setErr(true));
  }, [lang, me]);
  useEffect(load, [load]);

  if (me?.role !== 'TRAVELER') return <Navigate to={`/${lang}/login?next=${encodeURIComponent(`/${lang}/messages`)}`} replace />;
  if (err) return <ErrorBox onRetry={load} />;
  if (!list) return <Spinner />;
  return (
    <div className="stack">
      <h1>{t('navMessages')}</h1>
      {list.length === 0 && <p className="notice">{t('noMessages')}</p>}
      <ul className="list">
        {list.map((c) => (
          <li key={c.listingId} className={c.unread ? 'unread' : ''}>
            <Link to={`/${lang}/chat/${c.listingId}`} className="list-item">
              <span className="thumb">
                <Photo src={c.photo} alt="" />
              </span>
              <span className="grow">
                <strong>{c.shop}</strong>
                <br />
                <span className="small muted">
                  {new Date(c.lastAt).toLocaleString(lang, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
              {c.unread > 0 && <span className="dot">{c.unread}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
