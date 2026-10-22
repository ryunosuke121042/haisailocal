import { Component, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CURRENCIES, LANG_LABELS, LANGS, type Lang } from '../shared/constants';
import { Character, CharacterProvider } from './components/Character';
import { Spinner } from './components/ui';
import { LogoMark, Wordmark } from './components/Logo';
import { AppProvider, guessLang, useApp } from './store';
import Top from './pages/Top';
import List from './pages/List';
import Start from './pages/Start';
import Shop from './pages/Shop';
import Book from './pages/Book';
import { Chat, Messages } from './pages/Chat';
import { BookingDetail, Bookings } from './pages/Bookings';
import { Forgot, Login, Reset, Signup } from './pages/Account';
import Saved from './pages/Saved';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import { Privacy, Terms } from './pages/Legal';
import { lazyWithReload, reloadOnceForNewVersion } from './lib/lazyReload';
import { reportClientError } from './lib/clientErrors';

const BizApp = lazyWithReload(() => import('./biz/BizApp'));
const AdminApp = lazyWithReload(() => import('./admin/AdminApp'));

function LangRoot() {
  const { lang } = useParams();
  const loc = useLocation();
  if (!lang || !(LANGS as readonly string[]).includes(lang)) {
    // 言語がないURL → 推定した言語を付ける
    return <Navigate to={`/${guessLang()}${loc.pathname === '/' ? '' : loc.pathname}${loc.search}`} replace />;
  }
  return (
    <AppProvider lang={lang as Lang}>
      <CharacterProvider>
        <Layout />
      </CharacterProvider>
    </AppProvider>
  );
}

function Layout() {
  const { t, lang, ready, me, currency, setPrefs, unreadMessages, unreadNotifications, config } = useApp();
  const nav = useNavigate();
  const loc = useLocation();

  function switchLang(l: string) {
    nav(loc.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, `/${l}`) + loc.search, { replace: true });
  }

  if (!ready) return <Spinner />;
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to={`/${lang}`} className="brand" end aria-label={t('appName')}>
          {/* オープニングと同じロゴ（地球のマーク＋文字） */}
          <LogoMark size={30} className="brand-mark" />
          <Wordmark className="brand-word" />
        </NavLink>
        <span className="spacer" />
        {!loc.pathname.endsWith('/start') && (
          // まるは言語の横にアイコンだけ置く。キャラクターで何か起きても、画面全体は止めない
          <ErrorBoundary resetKey={loc.pathname} fallback={() => null}>
            <Character />
          </ErrorBoundary>
        )}
        <select className="lang-select" value={lang} onChange={(e) => switchLang(e.target.value)} aria-label={t('language')}>
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_LABELS[l]}
            </option>
          ))}
        </select>
        <select className="lang-select" value={currency} onChange={(e) => void setPrefs({ currency: e.target.value })} aria-label={t('currency')}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {me?.role === 'TRAVELER' ? (
          <NavLink to={`/${lang}/notifications`} className="icon-btn bell" aria-label={t('navNotifications')}>
            🔔{unreadNotifications > 0 && <span className="dot">{unreadNotifications}</span>}
          </NavLink>
        ) : (
          <NavLink to={/\/(login|signup|forgot|reset)$/.test(loc.pathname) ? `/${lang}/login${loc.search}` : `/${lang}/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} className="link small">
            {t('login')}
          </NavLink>
        )}
      </header>
      {config?.demo && <div className="demo-banner small">{t('demoNotice')}</div>}
      {config?.translator === 'none' && lang !== 'ja' && <div className="notice notice-info small">{t('translatorOff')}</div>}
      <main className="main">
        <ErrorBoundary resetKey={loc.pathname} fallback={(reset) => <PageError reset={reset} />}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <nav className="bottomnav">
        <NavLink to={`/${lang}`} end>
          <span aria-hidden>🔍</span>
          {t('navExplore')}
        </NavLink>
        <NavLink to={`/${lang}/saved`}>
          <span aria-hidden>♡</span>
          {t('navSaved')}
        </NavLink>
        <NavLink to={`/${lang}/bookings`}>
          <span aria-hidden>📅</span>
          {t('navBookings')}
        </NavLink>
        <NavLink to={`/${lang}/messages`}>
          <span aria-hidden>💬</span>
          {t('navMessages')}
          {unreadMessages > 0 && <span className="dot">{unreadMessages}</span>}
        </NavLink>
        <NavLink to={`/${lang}/settings`}>
          <span aria-hidden>⚙︎</span>
          {t('navSettings')}
        </NavLink>
      </nav>
    </div>
  );
}

// 画面の描画で落ちても真っ白にせず、原因と再読み込みボタンを出す。
// resetKey が変わったら（別の画面へ移ったら）エラー表示を解除する。fallback を渡すと、その部分だけを差し替える
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string; fallback?: (reset: () => void) => ReactNode }, { error: Error | null; key?: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(props: { resetKey?: string }, state: { error: Error | null; key?: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('render error', error, info.componentStack);
    if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(error.message) && reloadOnceForNewVersion()) return;
    reportClientError(error, (info.componentStack ?? '').trim().split('\n').slice(0, 6).join(' < '));
  }
  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(() => this.setState({ error: null }));
    return (
      <div className="app">
        <main className="main">
          <div className="notice notice-error">
            <p>Something went wrong. / 出错了 / エラーが発生しました。</p>
            <button className="btn btn-primary" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </main>
      </div>
    );
  }
}

/** 画面の中身だけが落ちたときの表示（上のメニューと下のナビは残す） */
function PageError({ reset }: { reset: () => void }) {
  const { t } = useApp();
  return (
    <div className="notice notice-error stack-s">
      <p>{t('error')}</p>
      <p className="row gap-s">
        <button className="btn btn-primary" onClick={reset}>
          {t('retry')}
        </button>
        <button className="btn" onClick={() => history.back()}>
          {t('back')}
        </button>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<div className="spinner" />}>
          <Root />
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

// 事業者画面（日本語のみ）は、旅行者の /:lang/... より先に URL の先頭で振り分ける
function Root() {
  const { pathname } = useLocation();
  if (pathname === '/biz' || pathname.startsWith('/biz/')) {
    return (
      <Routes>
        <Route path="/biz/*" element={<BizApp />} />
      </Routes>
    );
  }
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return (
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Top />} />
      <Route path="/:lang" element={<LangRoot />}>
        <Route index element={<List />} />
        <Route path="start" element={<Start />} />
        <Route path="shop/:id" element={<Shop />} />
        <Route path="shop/:id/book" element={<Book />} />
        <Route path="chat/:listingId" element={<Chat />} />
        <Route path="messages" element={<Messages />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="signup" element={<Signup />} />
        <Route path="login" element={<Login />} />
        <Route path="forgot" element={<Forgot />} />
        <Route path="reset" element={<Reset />} />
        <Route path="saved" element={<Saved />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Route>
      <Route path="*" element={<LangRoot />} />
    </Routes>
  );
}
