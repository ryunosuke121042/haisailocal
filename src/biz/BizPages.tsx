// 事業者画面：予約一覧・予約の詳細（キャンセル・来店なし）・チャット
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BIZ_CANCEL_REASON_JA,
  BIZ_CANCEL_REASONS,
  DIETARY_JA,
  LIMITS,
  REVIEW_TAG_JA,
  type BizCancelReason,
  type Dietary,
  type ReviewTag,
} from '../../shared/constants';
import { ApiError, get, post, put } from '../api';
import type { ChatMessage, ReservationStatus } from '../types';
import { PushPrompt, useBiz } from './BizApp';
import { suggestReplies } from './quickReplies';
import { MessagePhoto, PhotoAttachButton, PhotoPreview } from '../components/ChatPhoto';

const ST_JA: Record<ReservationStatus, string> = {
  CONFIRMED: '確定',
  VISITED: '来店済み',
  NO_SHOW: '来店なし',
  CANCELED_BY_TRAVELER: '旅行者キャンセル',
  CANCELED_BY_BUSINESS: '事業者キャンセル',
};

interface BizRes {
  id: string;
  status: ReservationStatus;
  date: string;
  time: string;
  visitAt: string;
  partySize: number;
  traveler: string;
  dietary: string[];
  messageJa: string;
  message: string;
  payJpy: number;
  lateCancel: boolean;
  cancelFeeJpy: number | null;
  bizCancelReason: BizCancelReason | null;
  bizCancelNoteJa: string;
  listing: { id: string; nameJa: string };
  canCancel: boolean;
  canMarkNoShow: boolean;
  conversationId?: string | null;
}

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const dietJa = (list: string[]) => list.map((d) => DIETARY_JA[d as Dietary] ?? d).join('、');

function dateJa(date: string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short' });
}

/** 旅行者の文（日本語訳）。「原文を見る」で原文も確認できる */
function Translated({ ja, original }: { ja: string; original: string }) {
  const [orig, setOrig] = useState(false);
  if (!ja && !original) return null;
  return (
    <span className="tt">
      <span className="pre">{orig ? original : ja || original}</span>
      {ja && original && ja !== original && (
        <button type="button" className="link small tt-toggle" onClick={() => setOrig(!orig)}>
          {orig ? '日本語訳を見る' : '原文を見る'}
        </button>
      )}
    </span>
  );
}

export function BizReservations() {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [list, setList] = useState<BizRes[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setList(null);
    get<{ results: BizRes[] }>(`/biz/reservations?scope=${scope}`)
      .then((r) => setList(r.results))
      .catch(() => setErr(true));
  }, [scope]);

  const byDate = new Map<string, BizRes[]>();
  for (const r of list ?? []) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  const multiShop = new Set((list ?? []).map((r) => r.listing.id)).size > 1;

  return (
    <div className="stack">
      <h1>予約一覧</h1>
      <div className="seg" role="group">
        <button className={scope === 'upcoming' ? 'on' : ''} onClick={() => setScope('upcoming')}>
          今日以降
        </button>
        <button className={scope === 'past' ? 'on' : ''} onClick={() => setScope('past')}>
          過去
        </button>
      </div>
      {err && <p className="notice notice-error">読み込めませんでした。</p>}
      {!list && !err && <div className="spinner" />}
      {list?.length === 0 && <p className="notice">予約はありません。新しい予約が入ると、メールでお知らせします。</p>}
      {[...byDate].map(([date, rows]) => (
        <section key={date} className="stack-s">
          <h2>{dateJa(date)}</h2>
          <ul className="list">
            {rows.map((r) => (
              <li key={r.id}>
                <Link to={`/biz/reservations/${r.id}`} className="list-item biz-res">
                  <strong className="biz-time">{r.time}</strong>
                  <span className="grow">
                    {r.traveler}さん・{r.partySize}名{multiShop && <span className="small muted">（{r.listing.nameJa}）</span>}
                    {r.dietary.length > 0 && (
                      <>
                        <br />
                        <span className="small warn">食事制限：{dietJa(r.dietary)}</span>
                      </>
                    )}
                    {r.messageJa && (
                      <>
                        <br />
                        <span className="small muted">「{r.messageJa.slice(0, 60)}」</span>
                      </>
                    )}
                  </span>
                  <span className={`status status-${r.status}`}>{ST_JA[r.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function BizReservation() {
  const { id } = useParams();
  const { reload } = useBiz();
  const [r, setR] = useState<BizRes | null>(null);
  const [err, setErr] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState<BizCancelReason>('CLOSURE');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    get<BizRes>(`/biz/reservations/${id}`)
      .then(setR)
      .catch(() => setErr(true));
  }, [id]);
  useEffect(load, [load]);

  if (err) return <p className="notice notice-error">読み込めませんでした。</p>;
  if (!r) return <div className="spinner" />;

  async function act(path: string, body: unknown, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      await post(path, body);
      setMsg(done);
      setCancelOpen(false);
      load();
      await reload();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setMsg(
        code === 'invalid_status'
          ? 'この予約は変更できません（状態が変わった可能性があります）。'
          : code === 'too_late'
            ? '来店から48時間を過ぎたため、「来店なし」は変更できません。'
            : code === 'already_reviewed'
              ? 'この予約はすでに旅行者が評価しているため、「来店なし」は付けられません。'
              : 'エラーが発生しました。',
      );
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <p className="small">
        <Link to="/biz/reservations">← 予約一覧</Link>
      </p>
      <h1>
        {dateJa(r.date)} {r.time}
      </h1>
      <p>
        <span className={`status status-${r.status}`}>{ST_JA[r.status]}</span>
      </p>
      <dl className="kv">
        <dt>店舗</dt>
        <dd>{r.listing.nameJa}</dd>
        <dt>旅行者</dt>
        <dd>{r.traveler}さん</dd>
        <dt>人数</dt>
        <dd>{r.partySize}名</dd>
        <dt>現地で受け取る金額</dt>
        <dd>{yen(r.payJpy)}</dd>
        <dt>食事制限</dt>
        <dd>{r.dietary.length ? <strong className="warn">{dietJa(r.dietary)}</strong> : 'なし'}</dd>
        <dt>メッセージ</dt>
        <dd>{r.messageJa || r.message ? <Translated ja={r.messageJa} original={r.message} /> : 'なし'}</dd>
      </dl>
      {r.status === 'CANCELED_BY_TRAVELER' && r.lateCancel && (
        <p className="notice notice-warn small">
          無料キャンセルの期限後のキャンセルです{r.cancelFeeJpy ? `（キャンセル料の目安 ${yen(r.cancelFeeJpy)}。請求は運営が判断します）` : ''}。
        </p>
      )}
      {r.status === 'CANCELED_BY_BUSINESS' && r.bizCancelReason && (
        <p className="notice small">
          キャンセル理由：{BIZ_CANCEL_REASON_JA[r.bizCancelReason]}
          {r.bizCancelNoteJa && `（${r.bizCancelNoteJa}）`}
        </p>
      )}
      {msg && <p className="notice notice-info">{msg}</p>}
      <div className="actions">
        {r.conversationId ? (
          <Link to={`/biz/messages/${r.conversationId}`} className="btn">
            💬 チャット
          </Link>
        ) : (
          <span className="small muted">この旅行者とのチャットはまだありません。</span>
        )}
        {r.canMarkNoShow &&
          (r.status === 'NO_SHOW' ? (
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void act(`/biz/reservations/${r.id}/no-show`, { noShow: false }, '「来店なし」を取り消しました。')}
            >
              「来店なし」を取り消す
            </button>
          ) : (
            <button
              className="btn"
              disabled={busy}
              onClick={() => void act(`/biz/reservations/${r.id}/no-show`, { noShow: true }, '「来店なし」を記録しました。')}
            >
              来店なし
            </button>
          ))}
        {r.canCancel && !cancelOpen && (
          <button className="btn btn-danger" onClick={() => setCancelOpen(true)}>
            この予約をキャンセル
          </button>
        )}
      </div>
      {r.canCancel && cancelOpen && (
        <div className="card stack-s">
          <h2>予約のキャンセル</h2>
          <p className="small">旅行者には、選んだ理由を翻訳してメールで知らせます。旅行者にキャンセル料はかかりません。</p>
          <div className="chips">
            {BIZ_CANCEL_REASONS.map((x) => (
              <button key={x} type="button" className={`chip chip-toggle ${reason === x ? 'on' : ''}`} onClick={() => setReason(x)}>
                {BIZ_CANCEL_REASON_JA[x]}
              </button>
            ))}
          </div>
          <label>
            ひとこと（任意・翻訳して伝えます）
            <textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="actions">
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={() => void act(`/biz/reservations/${r.id}/cancel`, { reason, noteJa: note }, 'キャンセルし、旅行者にメールで知らせました。')}
            >
              キャンセルを確定
            </button>
            <button className="btn btn-ghost" onClick={() => setCancelOpen(false)}>
              やめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ConvSummary {
  id: string;
  traveler: string;
  listing: string;
  last: string;
  lastAt: string;
  unread: number;
}

export function BizMessages() {
  const [list, setList] = useState<ConvSummary[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    get<{ results: ConvSummary[] }>('/biz/conversations')
      .then((r) => setList(r.results))
      .catch(() => setErr(true));
  }, []);
  if (err) return <p className="notice notice-error">読み込めませんでした。</p>;
  if (!list) return <div className="spinner" />;
  return (
    <div className="stack">
      <h1>チャット</h1>
      {list.length === 0 && <p className="notice">まだメッセージはありません。旅行者からの質問は日本語に翻訳されて届きます。</p>}
      <ul className="list">
        {list.map((c) => (
          <li key={c.id} className={c.unread ? 'unread' : ''}>
            <Link to={`/biz/messages/${c.id}`} className="list-item">
              <span className="grow">
                <strong>{c.traveler}さん</strong> <span className="small muted">{c.listing}</span>
                <br />
                <span className="small muted">{c.last}</span>
              </span>
              {c.unread > 0 && <span className="dot">{c.unread}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Conv {
  id: string;
  traveler: string;
  travelerLang: string;
  listing: { id: string; nameJa: string };
  blocked: boolean;
  reservations: { id: string; date: string; time: string; partySize: number; status: ReservationStatus }[];
  messages: ChatMessage[];
}

const LANG_JA: Record<string, string> = { en: '英語', zh: '中国語（簡体字）', ja: '日本語' };

/** よく使う返信：旅行者の最新の質問に合うもの（おすすめ）を先に出す。タップで入力欄に入る */
function QuickReplies({ messages, onPick }: { messages: ChatMessage[]; onPick: (text: string) => void }) {
  const last = [...messages].reverse().find((m) => !m.fromMe);
  const { suggested, common } = suggestReplies(last ? `${last.text}\n${last.original}` : '');
  return (
    <section className="chat-quick" aria-label="よく使う返信">
      <p className="small muted">よく使う返信（タップで入力されます。書き足してから送れます）</p>
      <div className="scene-row">
        {suggested.map((r) => (
          <button key={r} type="button" className="chip chip-suggest" onClick={() => onPick(r)}>
            {r}
          </button>
        ))}
        {common.map((r) => (
          <button key={r} type="button" className="chip" onClick={() => onPick(r)}>
            {r}
          </button>
        ))}
      </div>
    </section>
  );
}

export function BizConversation() {
  const { id } = useParams();
  const { reload } = useBiz();
  const [c, setC] = useState<Conv | null>(null);
  const [err, setErr] = useState(false);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(() => {
    get<Conv>(`/biz/conversations/${id}`)
      .then((r) => {
        setC(r);
        setErr(false);
        void reload().catch(() => {});
      })
      .catch(() => setErr(true));
  }, [id, reload]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);
  // scrollIntoView は新しいブラウザでは Promise を返すので、{ } で包んで何も返さない
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [c?.messages.length]);

  // 一度読み込めていれば、定期確認の失敗では画面を消さない
  if (!c) return err ? <p className="notice notice-error">読み込めませんでした。</p> : <div className="spinner" />;

  return (
    <div className="chat stack">
      <p className="small">
        <Link to="/biz/messages">← チャット一覧</Link>
      </p>
      <h1>{c.traveler}さん</h1>
      <p className="small muted">
        {c.listing.nameJa}・旅行者の言語：{LANG_JA[c.travelerLang] ?? c.travelerLang}。日本語で書けば、旅行者の言語に翻訳して届きます。
      </p>
      {c.reservations.length > 0 && (
        <ul className="chips">
          {c.reservations.map((r) => (
            <li key={r.id}>
              <Link to={`/biz/reservations/${r.id}`} className="chip">
                予約 {r.date} {r.time}・{r.partySize}名（{ST_JA[r.status]}）
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="chat-log">
        {c.messages.map((m) => (
          <div key={m.id} className={`msg ${m.fromMe ? 'msg-me' : 'msg-them'}`}>
            {m.photo && <MessagePhoto src={m.photo} alt="写真" />}
            {m.text && (m.fromMe ? <span className="pre">{m.text}</span> : <Translated ja={m.text} original={m.original} />)}
            <time className="small muted">
              {new Date(m.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
        ))}
        <div ref={end} />
      </div>
      <QuickReplies
        messages={c.messages}
        onPick={(r) => {
          // 同じ文は二重に入れない。すでに書いた文には改行して足す
          setText((cur) => (cur.includes(r) ? cur : cur.trim() ? `${cur.trimEnd()}\n${r}` : r).slice(0, LIMITS.messageMaxChars));
          input.current?.focus();
        }}
      />
      {photo && <PhotoPreview src={photo} removeLabel="写真を外す" onRemove={() => setPhoto(null)} />}
      <form
        className="chat-input"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim() && !photo) return;
          setBusy(true);
          setSendErr(null);
          try {
            await post(`/biz/conversations/${c.id}/messages`, { text, ...(photo ? { photo } : {}) });
            setText('');
            setPhoto(null);
            load();
          } catch {
            setSendErr('送信できませんでした。もう一度お試しください。');
          } finally {
            setBusy(false);
          }
        }}
      >
        <PhotoAttachButton
          labels={{ attach: '写真を添付', remove: '写真を外す', unreadable: 'この写真は読み込めませんでした。JPEG か PNG の写真を選んでください。' }}
          disabled={busy}
          onPick={setPhoto}
        />
        <textarea
          ref={input}
          rows={2}
          maxLength={LIMITS.messageMaxChars}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="日本語で入力"
          aria-label="メッセージ"
        />
        <button className="btn btn-primary" disabled={busy || (!text.trim() && !photo)}>
          送信
        </button>
      </form>
      <p className={`chat-count small muted ${text.length > LIMITS.messageMaxChars * 0.9 ? 'warn' : ''}`} aria-live="polite">
        {text.length}/{LIMITS.messageMaxChars}
      </p>
      {sendErr && <p className="notice notice-error">{sendErr}</p>}
      <p className="small">
        <button
          className="link small muted"
          onClick={async () => {
            if (!c.blocked && !confirm(`${c.traveler}さんをブロックしますか？ ブロック中はこの旅行者からのメッセージと予約を受け付けません。`)) return;
            setSendErr(null);
            try {
              await post(`/biz/conversations/${c.id}/block`, { blocked: !c.blocked });
              load();
            } catch {
              setSendErr('変更できませんでした。もう一度お試しください。');
            }
          }}
        >
          {c.blocked ? 'ブロックを解除する' : 'この旅行者をブロックする'}
        </button>
      </p>
    </div>
  );
}

interface Notice {
  id: string;
  payload: { title: string; body: string; path: string };
  at: string;
  read: boolean;
}

/** お知らせ（アプリ内の通知）。プッシュ通知・メールと同じ内容 */
export function BizNotifications() {
  const { reload } = useBiz();
  const [list, setList] = useState<Notice[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    get<{ results: Notice[] }>('/biz/notifications')
      .then((r) => {
        setList(r.results);
        return post('/biz/notifications/read').then(() => reload());
      })
      .catch(() => setErr(true));
  }, [reload]);
  if (err) return <p className="notice notice-error">読み込めませんでした。</p>;
  if (!list) return <div className="spinner" />;
  return (
    <div className="stack">
      <h1>お知らせ</h1>
      {list.length === 0 && <p className="notice">お知らせはありません。</p>}
      <ul className="list">
        {list.map((n) => (
          <li key={n.id} className={n.read ? '' : 'unread'}>
            <Link to={n.payload.path} className="list-item">
              <span className="grow">
                <strong>{n.payload.title}</strong>
                <br />
                <span className="small pre">{n.payload.body}</span>
                <br />
                <span className="small muted">
                  {new Date(n.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface BizReview {
  id: string;
  listing: string;
  stars: number;
  tags: ReviewTag[];
  hidden: boolean;
  date: string;
  takedown: { at: string; reason: string } | null;
  photos: string[];
}

/** 評価の確認と、削除の申出（運営が規約の基準に当たるか確認する） */
export function BizReviews() {
  const [list, setList] = useState<BizReview[] | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [tdErr, setTdErr] = useState(false);
  const load = useCallback(() => {
    get<{ results: BizReview[] }>('/biz/reviews')
      .then((r) => setList(r.results))
      .catch(() => setErr(true));
  }, []);
  useEffect(load, [load]);
  if (err) return <p className="notice notice-error">読み込めませんでした。</p>;
  if (!list) return <div className="spinner" />;
  return (
    <div className="stack">
      <h1>評価</h1>
      <p className="small muted">
        アプリで予約して来店した旅行者だけが、1回の予約につき1件、星とタグで評価します（自由記述はありません）。高い評価を頼んだり、見返りと引き換えに評価を求めたりすることは規約で禁止しています。
      </p>
      {list.length === 0 && <p className="notice">まだ評価はありません。</p>}
      <ul className="list">
        {list.map((r) => (
          <li key={r.id} className="card stack-s">
            <div className="row gap-s">
              <strong className="grow">
                {'★'.repeat(r.stars)}
                {'☆'.repeat(5 - r.stars)}
              </strong>
              <span className="small muted">
                {r.date} · {r.listing}
              </span>
            </div>
            {r.tags.length > 0 && <p className="small">{r.tags.map((x) => REVIEW_TAG_JA[x] ?? x).join('、')}</p>}
            {r.photos.length > 0 && (
              <div className="review-photos">
                {r.photos.map((p) => (
                  <a key={p} href={p} target="_blank" rel="noreferrer">
                    <img src={p} alt="レビューの写真" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
            {r.hidden && <p className="small muted">運営により非表示</p>}
            {r.takedown ? (
              <p className="small muted">削除を申し出ました（{new Date(r.takedown.at).toLocaleDateString('ja-JP')}）。運営が確認します。</p>
            ) : open === r.id ? (
              <form
                className="stack-s"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await post(`/biz/reviews/${r.id}/takedown`, { reason });
                    setOpen(null);
                    setReason('');
                    setTdErr(false);
                    load();
                  } catch {
                    setTdErr(true);
                  }
                }}
              >
                <label>
                  削除を求める理由
                  <textarea rows={3} maxLength={1000} required value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
                {tdErr && <p className="small warn">送れませんでした。もう一度お試しください。</p>}
                <div className="actions">
                  <button className="btn btn-small btn-primary" disabled={!reason.trim()}>
                    申し出る
                  </button>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => setOpen(null)}>
                    やめる
                  </button>
                </div>
              </form>
            ) : (
              <button className="link small muted" onClick={() => setOpen(r.id)}>
                この評価の削除を申し出る
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 設定：事業者名、当日予約の来店前メールの時間、プッシュ通知 */
export function BizSettings() {
  const { home, reload } = useBiz();
  const [name, setName] = useState(home?.business.name ?? '');
  const [minutes, setMinutes] = useState(home?.business.reminderMinutes ?? 15);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (home) {
      setName(home.business.name);
      setMinutes(home.business.reminderMinutes);
    }
    // 定期的な読み込み直し（1分ごと）で入力中の値を戻さないよう、事業者が変わったときだけ入れ直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home?.business.id]);
  if (!home) return <div className="spinner" />;
  return (
    <form
      className="stack biz-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        try {
          await put('/biz/settings', { name, reminderMinutes: minutes });
          await reload();
          setMsg('保存しました。');
        } catch {
          setMsg('保存できませんでした。');
        }
      }}
    >
      <h1>設定</h1>
      <PushPrompt dismissible={false} />
      <label>
        事業者名（屋号）
        <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        当日の予約で、旅行者に来店前メールを送る時間
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {[10, 15, 30, 60, 120].map((m) => (
            <option key={m} value={m}>
              来店の{m}分前
            </option>
          ))}
        </select>
        <span className="small muted">前日までの予約には、前日18時にリマインドを送ります。</span>
      </label>
      {msg && <p className="notice notice-info">{msg}</p>}
      <button className="btn btn-primary">保存</button>
      <p className="small">
        <Link to="/biz/reviews">評価を見る</Link> · <a href="/ja/terms">掲載規約</a>
      </p>
    </form>
  );
}
