import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, post } from '../api';
import { useApp } from '../store';
import { aiServiceName } from '../components/ui';
import type { Me } from '../types';
import { useCharacter } from '../components/Character';

function useNext() {
  const [p] = useSearchParams();
  const { lang } = useApp();
  const next = p.get('next');
  // 自サイト内のパスだけを許す
  return next && next.startsWith('/') && !next.startsWith('//') ? next : `/${lang}`;
}

/** 旅行者の登録：チャットか予約を始めるときに求める */
export function Signup() {
  const { t, lang, currency, setMe, me, profile, config } = useApp();
  const nav = useNavigate();
  const next = useNext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useCharacter({ line: t('say_account') });

  if (me?.role === 'TRAVELER') return <Navigate to={next} replace />;

  return (
    <form
      className="auth stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          // アカウントを作る前に答えた最初の質問（端末に残している分）も引き継ぐ
          const r = await post<{ user: Me }>('/auth/signup', {
            name,
            email,
            password: pw,
            privacyConsent: true,
            lang,
            currency,
            prefs: profile.prefs,
            prefsDate: profile.prefsDate,
            sensitiveConsent: profile.sensitiveConsent,
            characterHidden: profile.characterHidden,
          });
          setMe(r.user);
          nav(next, { replace: true });
        } catch (e) {
          setErr(e instanceof ApiError && e.code === 'email_taken' ? t('emailTaken') : t('error'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1>{t('signup')}</h1>
      <p className="notice notice-info small">{t('signupWhy')}</p>
      <label>
        {t('yourName')}
        <input required maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <span className="small muted">{t('yourNameHint')}</span>
      </label>
      <label>
        {t('email')}
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        {t('password')}
        <input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <span className="small muted">{t('passwordHint')}</span>
      </label>
      <div className="consent-box small">
        <p>{t('privacySummary', { ai: aiServiceName(config) })}</p>
        <p>
          <Link to={`/${lang}/privacy`} target="_blank">
            {t('readPrivacy')}
          </Link>{' '}
          ·{' '}
          <Link to={`/${lang}/terms`} target="_blank">
            {t('readTerms')}
          </Link>
        </p>
        {config?.translator === 'none' && <p className="muted">{t('translatorOff')}</p>}
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
          {t('privacyAgree')}
        </label>
      </div>
      {err && <p className="notice notice-error">{err}</p>}
      <button className="btn btn-primary" disabled={busy || !agree}>
        {t('signup')}
      </button>
      <p className="small">
        {t('haveAccount')} <Link to={`/${lang}/login?next=${encodeURIComponent(next)}`}>{t('login')}</Link>
      </p>
    </form>
  );
}

export function Login() {
  const { t, lang, setMe, me } = useApp();
  const nav = useNavigate();
  const next = useNext();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (me?.role === 'TRAVELER') return <Navigate to={next} replace />;
  return (
    <form
      className="auth stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          const r = await post<{ user: Me }>('/auth/login', { email, password: pw });
          setMe(r.user);
          if (r.user.role === 'BUSINESS') location.href = '/biz';
          else nav(next, { replace: true });
        } catch (e) {
          setErr(e instanceof ApiError && e.status === 401 ? t('invalidCredentials') : t('error'));
        }
      }}
    >
      <h1>{t('login')}</h1>
      <label>
        {t('email')}
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        {t('password')}
        <input type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      {err && <p className="notice notice-error">{err}</p>}
      <button className="btn btn-primary">{t('login')}</button>
      <p className="small">
        <Link to={`/${lang}/forgot`}>{t('forgotPassword')}</Link>
      </p>
      <p className="small">
        {t('noAccount')} <Link to={`/${lang}/signup?next=${encodeURIComponent(next)}`}>{t('signup')}</Link>
      </p>
    </form>
  );
}

export function Forgot() {
  const { t } = useApp();
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
      <h1>{t('forgotTitle')}</h1>
      {sent ? (
        <p className="notice">{t('forgotSent')}</p>
      ) : (
        <>
          <label>
            {t('email')}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn btn-primary">{t('send')}</button>
        </>
      )}
    </form>
  );
}

export function Reset() {
  const { t, lang, setMe } = useApp();
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
          setMe(r.user);
          nav(`/${lang}`);
        } catch {
          setErr(t('invalidToken'));
        }
      }}
    >
      <h1>{t('resetTitle')}</h1>
      <label>
        {t('password')}
        <input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <span className="small muted">{t('passwordHint')}</span>
      </label>
      {err && <p className="notice notice-error">{err}</p>}
      <button className="btn btn-primary">{t('save')}</button>
    </form>
  );
}

/**
 * カード登録（請求はしない。無断キャンセルの抑止）。
 * 決済代行サービスは要確認事項のため、MVPの画面はダミー：入力値は送信も保存もせず、登録済みの記録だけを残す。
 * 途中で閉じた場合、予約は未確定のままで枠も押さえない。
 */
export function CardForm({ onDone }: { onDone: () => Promise<void> }) {
  const { t } = useApp();
  const [num, setNum] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const digits = num.replace(/\D/g, '');
  const valid = digits.length >= 13 && digits.length <= 19 && /^(0[1-9]|1[0-2])\/\d{2}$/.test(exp) && /^\d{3,4}$/.test(cvc);
  return (
    <div className="card-dummy stack-s">
      <p className="small muted">{t('cardWhy')}</p>
      <label>
        {t('cardNumber')}
        <input inputMode="numeric" autoComplete="off" value={num} onChange={(e) => setNum(e.target.value)} placeholder="4242 4242 4242 4242" />
      </label>
      <div className="row gap-s">
        <label className="grow">
          {t('cardExpiry')}
          <input autoComplete="off" value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM/YY" />
        </label>
        <label className="grow">
          CVC
          <input inputMode="numeric" autoComplete="off" value={cvc} onChange={(e) => setCvc(e.target.value)} placeholder="123" />
        </label>
      </div>
      <p className="small muted">{t('cardDemo')}</p>
      {err && <p className="notice notice-error small">{t('error')}</p>}
      <button
        type="button"
        className="btn"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          setErr(false);
          try {
            await onDone();
          } catch {
            setErr(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('registerCard')}
      </button>
    </div>
  );
}
