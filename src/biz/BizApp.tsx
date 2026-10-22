// 事業者画面（スマホファースト、日本語のみ）
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, get, post } from '../api';
import type { Me } from '../types';
import { ErrorBoundary } from '../App';
import { LogoMark } from '../components/Logo';
import { BizClosed } from './BizClosed';
import { BizListing } from './BizListing';
import { BizConversation, BizMessages, BizNotifications, BizReservation, BizReservations, BizReviews, BizSettings } from './BizPages';

export interface BizHomeData {
  business: { id: string; name: string; reminderMinutes: number };
  email: string;
  unreadNotices: number;
  push: { enabled: boolean; registeredOnThisAccount: boolean; publicKey: string | null };
  listings: {
    id: string;
    nameJa: string;
    status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'SUSPENDED';
    missing: string[];
    photo: string | null;
    hasSlots: boolean;
  }[];
  upcomingWeek: number;
  unreadMessages: number;
}

const Ctx = createContext<{ home: BizHomeData | null; reload: () => Promise<void> } | null>(null);
export const useBiz = () => useContext(Ctx)!;

function applyManifest() {
  // 事業者画面だけをホーム画面に追加できるようにする（iPhone はホーム画面に追加しないとプッシュ通知が届かない）
  if (!document.querySelector('link[rel="manifest"]')) {
    const l = document.createElement('link');
    l.rel = 'manifest';
    l.href = '/biz.webmanifest';
    document.head.appendChild(l);
    const a = document.createElement('link');
    a.rel = 'apple-touch-icon';
    a.href = '/icons/apple-touch-icon.png';
    document.head.appendChild(a);
  }
  document.documentElement.lang = 'ja';
  document.title = 'haisailocal 事業者';
}

export default function BizApp() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    applyManifest();
    get<{ user: Me | null }>('/me')
      .then((r) => setMe(r.user))
      .catch(() => setMe(null));
  }, []);
  if (me === undefined) return <div className="spinner" />;
  return (
    <div className="app biz">
      <Routes>
        <Route path="login" element={<BizLogin onLogin={setMe} />} />
        <Route path="signup" element={<BizSignup onLogin={setMe} />} />
        <Route path="forgot" element={<BizForgot />} />
        <Route path="reset" element={<BizReset onLogin={setMe} />} />
        <Route path="*" element={me?.role === 'BUSINESS' ? <BizShell /> : <Navigate to="/biz/login" replace />} />
      </Routes>
    </div>
  );
}

function BizShell() {
  const loc = useLocation();
  const [home, setHome] = useState<BizHomeData | null>(null);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    get<{ config: { demo: boolean } }>('/me')
      .then((r) => setDemo(r.config.demo))
      .catch(() => {});
  }, []);
  const reload = useCallback(async () => {
    setHome(await get<BizHomeData>('/biz/home'));
  }, []);
  useEffect(() => {
    void reload().catch(() => {});
    const id = setInterval(() => void reload().catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, [reload]);
  return (
    <Ctx.Provider value={{ home, reload }}>
      <header className="topbar">
        <Link to="/biz" className="brand">
          <LogoMark size={28} className="brand-mark" />
          <span className="brand-biz">事業者{home?.business.name && `｜${home.business.name}`}</span>
        </Link>
        <span className="spacer" />
        <Link to="/biz/notifications" className="icon-btn bell" aria-label="お知らせ">
          🔔{!!home?.unreadNotices && <span className="dot">{home.unreadNotices}</span>}
        </Link>
        <button
          className="link small"
          onClick={async () => {
            await post('/auth/logout');
            location.href = '/biz/login';
          }}
        >
          ログアウト
        </button>
      </header>
      {demo && (
        <div className="demo-banner small">
          デモ：表示されている店舗・予約・旅行者はすべて架空のサンプルデータです。メールは送られません（運営画面の「送信メール」で確認できます）。
        </div>
      )}
      <main className="main">
        {/* 画面の中身だけが落ちたときは、メニューを残して「再試行／戻る」を出す（旅行者側と同じ） */}
        <ErrorBoundary
          resetKey={loc.pathname}
          fallback={(reset) => (
            <div className="notice notice-error stack-s">
              <p>エラーが発生しました。もう一度お試しください。入力中の内容が消えることがあります。</p>
              <p className="row gap-s">
                <button className="btn btn-primary" onClick={reset}>
                  再試行
                </button>
                <button className="btn" onClick={() => history.back()}>
                  戻る
                </button>
              </p>
            </div>
          )}
        >
          <Routes>
            <Route index element={<BizHome />} />
            <Route path="listing/:id" element={<BizListing />} />
            <Route path="listing/:id/closed" element={<BizClosed />} />
            <Route path="reservations" element={<BizReservations />} />
            <Route path="reservations/:id" element={<BizReservation />} />
            <Route path="messages" element={<BizMessages />} />
            <Route path="messages/:id" element={<BizConversation />} />
            <Route path="notifications" element={<BizNotifications />} />
            <Route path="reviews" element={<BizReviews />} />
            <Route path="settings" element={<BizSettings />} />
            <Route path="*" element={<Navigate to="/biz" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <nav className="bottomnav">
        <NavLink to="/biz" end>
          <span aria-hidden>🏠</span>ホーム
        </NavLink>
        <NavLink to="/biz/reservations">
          <span aria-hidden>📋</span>予約
        </NavLink>
        <NavLink to="/biz/messages">
          <span aria-hidden>💬</span>チャット
          {!!home?.unreadMessages && <span className="dot">{home.unreadMessages}</span>}
        </NavLink>
        <NavLink to="/biz/settings">
          <span aria-hidden>⚙︎</span>設定
        </NavLink>
      </nav>
    </Ctx.Provider>
  );
}

export const STATUS_JA = { DRAFT: '下書き', PUBLISHED: '公開中', HIDDEN: '非公開', SUSPENDED: '運営が非公開にしました' } as const;

function BizHome() {
  const { home, reload } = useBiz();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!home) return <div className="spinner" />;
  return (
    <div className="stack">
      <PushPrompt />
      <div className="grid-buttons">
        <Link to="/biz/reservations" className="btn btn-big">
          今後7日の予約
          <br />
          <strong>{home.upcomingWeek}件</strong>
        </Link>
        <Link to="/biz/messages" className="btn btn-big">
          未読メッセージ
          <br />
          <strong>{home.unreadMessages}件</strong>
        </Link>
      </div>

      <section className="stack-s">
        <h1>店舗</h1>
        {home.listings.length === 0 && (
          <p className="notice notice-info">まず店舗を登録しましょう。日本語で入力すれば、英語と中国語（簡体字）に自動で翻訳して旅行者に表示します。</p>
        )}
        <ul className="list">
          {home.listings.map((l) => (
            <li key={l.id} className="card stack-s">
              <div className="row gap-s">
                <span className="thumb">{l.photo ? <img src={l.photo} alt="" /> : <span className="photo-ph" />}</span>
                <div className="grow">
                  <strong>{l.nameJa || '（店名未入力）'}</strong>
                  <br />
                  <span className={`status status-${l.status}`}>{STATUS_JA[l.status]}</span>
                </div>
              </div>
              {l.status === 'DRAFT' && l.missing.length > 0 && <p className="small warn">公開に必要な項目：{l.missing.join('、')}</p>}
              {l.status === 'PUBLISHED' && !l.hasSlots && <p className="small muted">時間枠が未登録のため、旅行者はチャットでの問い合わせのみできます。</p>}
              <div className="actions">
                <Link to={`/biz/listing/${l.id}`} className="btn btn-small">
                  編集
                </Link>
                <Link to={`/biz/listing/${l.id}/closed`} className="btn btn-small">
                  受付停止日
                </Link>
                {l.status === 'PUBLISHED' && (
                  <a href={`/ja/shop/${l.id}`} target="_blank" rel="noopener" className="btn btn-small btn-ghost">
                    旅行者の見え方
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            // 押しただけで空の下書きができないよう、先に確かめる
            if (!confirm('新しい店舗の下書きを作りますか？（入力して保存するまで旅行者には公開されません）')) return;
            setBusy(true);
            setErr(null);
            try {
              const r = await post<{ id: string }>('/biz/listings');
              await reload();
              nav(`/biz/listing/${r.id}`);
            } catch (e) {
              setErr(
                e instanceof ApiError && e.code === 'too_many_listings'
                  ? '1つのアカウントで登録できる店舗は10件までです。'
                  : '店舗を追加できませんでした。もう一度お試しください。',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          ＋ 店舗を追加
        </button>
        {err && <p className="notice notice-error">{err}</p>}
      </section>
      <div className="actions">
        <Link to="/biz/reviews" className="btn btn-small">
          評価を見る
        </Link>
        <Link to="/biz/notifications" className="btn btn-small">
          お知らせ
        </Link>
      </div>
      <p className="small muted">ログイン中：{home.email}（ご家族の端末からも同じアカウントでログインできます）</p>
    </div>
  );
}

function BizLogin({ onLogin }: { onLogin: (m: Me) => void }) {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="auth stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          const r = await post<{ user: Me }>('/auth/login', { email, password: pw });
          if (r.user.role !== 'BUSINESS') {
            await post('/auth/logout');
            setErr('事業者のアカウントではありません。');
            return;
          }
          onLogin(r.user);
          nav('/biz');
        } catch (e) {
          setErr(e instanceof ApiError && e.status === 401 ? 'メールアドレスかパスワードが違います。' : 'エラーが発生しました。');
        }
      }}
    >
      <h1>事業者ログイン</h1>
      <label>
        メールアドレス
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        パスワード
        <input type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      {err && <p className="notice notice-error">{err}</p>}
      <button className="btn btn-primary">ログイン</button>
      <p className="small">
        <Link to="/biz/forgot">パスワードを忘れた場合</Link>
      </p>
      <p className="small">
        はじめての方は <Link to="/biz/signup">アカウント登録</Link>
      </p>
      <p className="small">
        <Link to="/">← トップへ（旅行者の方はこちら）</Link>
      </p>
    </form>
  );
}

function BizSignup({ onLogin }: { onLogin: (m: Me) => void }) {
  // 掲載文やメッセージの送り先（翻訳サービス）は、実際の設定に合わせて示す
  const [translatorText, setTranslatorText] = useState('翻訳サービス');
  useEffect(() => {
    get<{ config: { translator: string; aiProviders?: ('claude' | 'gemini')[] } }>('/me')
      .then(({ config }) => {
        const ai = { gemini: 'AI（Google の Gemini、米国）', claude: 'AI（Anthropic の Claude、米国）' } as const;
        const names = (config.aiProviders ?? []).map((p) => ai[p]);
        setTranslatorText(
          names.length
            ? `${names.join('または')}（使えないときは無料の機械翻訳 MyMemory、イタリア）`
            : config.translator === 'mymemory'
              ? '無料の機械翻訳 MyMemory（Translated S.r.l.、イタリア）'
              : '翻訳サービス',
        );
      })
      .catch(() => {});
  }, []);
  const nav = useNavigate();
  const [businessName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="auth stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          const r = await post<{ user: Me }>('/auth/biz-signup', { businessName, email, password: pw, termsConsent: true });
          onLogin(r.user);
          nav('/biz');
        } catch (e) {
          setErr(e instanceof ApiError && e.code === 'email_taken' ? 'このメールアドレスは登録済みです。ログインしてください。' : 'エラーが発生しました。');
        }
      }}
    >
      <h1>事業者アカウント登録</h1>
      <p className="small muted">メールアドレスで登録します。予約やメッセージのお知らせは、このメールアドレスに届きます。</p>
      <label>
        事業者名（屋号）
        <input required maxLength={80} value={businessName} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        メールアドレス
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        パスワード
        <input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <span className="small muted">8文字以上。ご家族と共有する場合は、推測されにくいものにしてください。</span>
      </label>
      <div className="consent-box small">
        <p>
          登録した店舗は、保存すると旅行者にすぐ公開されます。掲載文と旅行者とのメッセージは、{translatorText}
          で翻訳します（送るのは文章だけです）。事実と異なる掲載は、報告を受けて運営が非公開にすることがあります。
        </p>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
          上記に同意する
        </label>
      </div>
      {err && <p className="notice notice-error">{err}</p>}
      <button className="btn btn-primary" disabled={!agree}>
        登録する
      </button>
      <p className="small">
        登録済みの方は <Link to="/biz/login">ログイン</Link>
      </p>
      <p className="small">
        <Link to="/">← トップへ</Link>
      </p>
    </form>
  );
}

function BizForgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <form
      className="auth stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await post('/auth/forgot', { email }).catch(() => {});
        setSent(true);
      }}
    >
      <h1>パスワードの再設定</h1>
      {sent ? (
        <p className="notice">登録済みのメールアドレスであれば、再設定用のリンクを送りました。</p>
      ) : (
        <>
          <label>
            メールアドレス
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn btn-primary">送信</button>
        </>
      )}
      <Link to="/biz/login" className="small">
        ログインに戻る
      </Link>
    </form>
  );
}

function BizReset({ onLogin }: { onLogin: (m: Me) => void }) {
  const [p] = useSearchParams();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="auth stack"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const r = await post<{ user: Me }>('/auth/reset', { token: p.get('token'), password: pw });
          onLogin(r.user);
          nav('/biz');
        } catch {
          setErr('リンクの有効期限が切れています。もう一度お手続きください。');
        }
      }}
    >
      <h1>新しいパスワード</h1>
      <label>
        パスワード（8文字以上）
        <input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      {err && <p className="notice notice-error">{err}</p>}
      <button className="btn btn-primary">保存</button>
    </form>
  );
}

function urlB64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/**
 * プッシュ通知を推進する：オンにしていない端末では、ホームの一番上で強く勧める（オフでも使える。メールでも届く）。
 * オンにした端末は、開くたびに宛先を登録し直す
 */
/** dismissible：ホームでは閉じられる。設定画面では閉じたあとも出す（そこからオンにできるように） */
export function PushPrompt({ dismissible = true }: { dismissible?: boolean }) {
  const { home, reload } = useBiz();
  const key = home?.push.publicKey;
  const [state, setState] = useState<'checking' | 'ok' | 'need' | 'denied' | 'ios-home' | 'unsupported'>('checking');
  const [err, setErr] = useState(false);
  // 「閉じる」を押したら、この端末では次から出さない
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem('hl.pushPromptClosed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    (async () => {
      if (!key || !home?.push.enabled) return setState('unsupported');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return setState(isIos() && !isStandalone() ? 'ios-home' : 'unsupported');
      }
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.register('/biz-sw.js', { scope: '/biz' });
      const sub = await reg.pushManager.getSubscription();
      if (Notification.permission === 'granted' && sub) {
        await post('/biz/push/subscribe', sub.toJSON()).catch(() => {});
        return setState('ok');
      }
      setState('need');
    })().catch(() => setState('unsupported'));
  }, [key, home?.push.enabled]);

  async function enable() {
    setErr(false);
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'denied') return setState('denied');
      if (perm !== 'granted') return; // 許可の確認を閉じただけなら、もう一度押せるようにしておく
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key!) });
      await post('/biz/push/subscribe', sub.toJSON());
      await reload();
      setState('ok');
    } catch {
      setErr(true);
    }
  }

  if ((dismissible && closed) || state === 'ok' || state === 'checking' || state === 'unsupported') return null;
  return (
    <div className="notice notice-warn push-prompt stack-s">
      <div className="row gap-s">
        <strong className="grow">📣 プッシュ通知をオンにしてください</strong>
        {dismissible && (
          <button
            type="button"
            className="icon-btn"
            aria-label="閉じる（設定からいつでもオンにできます）"
            title="閉じる"
            onClick={() => {
              setClosed(true);
              try {
                localStorage.setItem('hl.pushPromptClosed', '1');
              } catch {
                /* 保存できなくても、この画面では閉じる */
              }
            }}
          >
            ✕
          </button>
        )}
      </div>
      <p className="small">新しい予約（とくに当日の予約）やメッセージに、すぐ気づけます。オフのままでもメールでお知らせしますが、気づくのが遅れがちです。</p>
      {state === 'need' && (
        <button className="btn btn-primary" onClick={() => void enable()}>
          通知をオンにする
        </button>
      )}
      {state === 'denied' && (
        <ol className="small">
          <li>端末の「設定」を開きます。</li>
          <li>Android：アプリ ＞ Chrome ＞ 通知 ＞ オン。iPhone：通知 ＞ haisailocal ＞ 通知を許可 ＞ オン。</li>
          <li>この画面を開き直してください。</li>
        </ol>
      )}
      {state === 'ios-home' && (
        <ol className="small">
          <li>iPhone では、ホーム画面に追加しないとプッシュ通知が届きません。</li>
          <li>Safari の共有ボタン（□に↑）から「ホーム画面に追加」を選びます。</li>
          <li>ホーム画面にできたアイコンから開き直し、「通知をオンにする」を押してください。</li>
        </ol>
      )}
      {err && <p className="small warn">通知をオンにできませんでした。もう一度お試しください。</p>}
    </div>
  );
}
