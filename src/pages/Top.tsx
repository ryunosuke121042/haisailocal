// トップページ：旅行者向けか事業者向けかを選び、そのままログイン・登録へ進める。
// 旅行者は日本語が読めないので推定した表示言語で、事業者（日本語のみ）は日本語で示す。
// 検索・地図・QRコードからは /{言語} に直接入るので、ここは通らなくてもよい
import { Suspense, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LANG_LABELS, LANGS } from '../../shared/constants';
import { get, post } from '../api';
import { translate } from '../i18n';
import { guessLang } from '../store';
import type { Config, Me } from '../types';
import { Logo } from '../components/Logo';
import { lazyWithReload } from '../lib/lazyReload';

// オープニングの地球（three.js と画像）は、ここを開いたときだけ読み込む
const EarthIntro = lazyWithReload(() => import('../intro/EarthIntro'));
const INTRO_KEY = 'hl.introSeen';

/** オープニングを流すか：この閲覧中にまだ見ていない（?intro で毎回）。動きを減らす設定の人には流さない */
function shouldPlayIntro() {
  if (new URLSearchParams(location.search).has('intro')) return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return !sessionStorage.getItem(INTRO_KEY);
  } catch {
    return true;
  }
}

/** オープニングを見終えた印（この閲覧中はもう流さない） */
function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* 保存できなくても画面は続ける */
  }
}

export default function Top() {
  const lang = guessLang();
  const navigate = useNavigate();
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const [me, setMe] = useState<Me | null>(null);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [intro, setIntro] = useState(shouldPlayIntro);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
    document.title = 'haisailocal';
    get<{ user: Me | null; config: Config }>('/me')
      .then((r) => {
        setMe(r.user);
        setDemo(r.config.demo);
      })
      .catch(() => {});
  }, [lang]);

  const traveler = me?.role === 'TRAVELER';
  const business = me?.role === 'BUSINESS';
  const next = encodeURIComponent(`/${lang}`);

  /** デモ用：パスワードなしでデモ用アカウントに入り、その画面を開く */
  async function demoLogin(role: 'traveler' | 'business' | 'admin') {
    setBusy(role);
    try {
      await post('/auth/demo-login', { role });
      location.href = role === 'traveler' ? `/${lang}` : role === 'business' ? '/biz' : '/admin';
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="top-page">
      {intro && (
        <Suspense fallback={<div className="intro" />}>
          <EarthIntro
            tagline="Local places in Kansai · 关西的当地小店 · 地元のお店と体験"
            skipLabel={t('introSkip')}
            onDone={() => {
              markIntroSeen();
              setIntro(false);
            }}
            onPickLang={(l) => {
              // 選んだ言語で旅行者向けのサイトに入る
              markIntroSeen();
              navigate(`/${l}`);
            }}
          />
        </Suspense>
      )}
      <div className="top-inner">
        <h1 className="top-logo">
          <Logo size={52} />
        </h1>
        <p className="top-tagline">Local places in Kansai · 关西的当地小店 · 地元のお店と体験</p>
        {demo && (
          <section className="top-demo stack-s">
            <h2>{t('demoTitle')}</h2>
            <p className="small">{t('demoNotice')}</p>
            <div className="top-actions">
              <button className="btn btn-primary" disabled={!!busy} onClick={() => void demoLogin('traveler')}>
                🧳 {t('demoTraveler')}
              </button>
              <button className="btn" disabled={!!busy} onClick={() => void demoLogin('business')}>
                🏪 {t('demoBusiness')}
              </button>
              <button className="btn btn-ghost" disabled={!!busy} onClick={() => void demoLogin('admin')}>
                🛠 {t('demoAdmin')}
              </button>
            </div>
            <ol className="small top-demo-steps">
              {t('demoSteps')
                .split('|')
                .map((x) => (
                  <li key={x}>{x}</li>
                ))}
            </ol>
          </section>
        )}

        <div className="top-choices">
          <section className="top-choice">
            <span className="top-icon" aria-hidden>
              🧳
            </span>
            <h2 className="top-title">{t('topTraveler')}</h2>
            <p className="top-desc">{t('topTravelerDesc')}</p>
            {traveler ? (
              <Link to={`/${lang}`} className="btn btn-primary">
                {t('topContinue')}
              </Link>
            ) : (
              <>
                <Link to={`/${lang}`} className="btn btn-primary">
                  {t('topExplore')}
                </Link>
                <div className="top-actions">
                  <Link to={`/${lang}/login?next=${next}`} className="btn">
                    {t('login')}
                  </Link>
                  <Link to={`/${lang}/signup?next=${next}`} className="btn btn-ghost">
                    {t('signup')}
                  </Link>
                </div>
              </>
            )}
            <p className="top-langs small">
              {LANGS.map((l, i) => (
                <span key={l}>
                  {i > 0 && ' · '}
                  <Link to={`/${l}`} lang={l}>
                    {LANG_LABELS[l]}
                  </Link>
                </span>
              ))}
            </p>
          </section>

          <section className="top-choice" lang="ja">
            <span className="top-icon" aria-hidden>
              🏪
            </span>
            <h2 className="top-title">事業者の方</h2>
            <p className="top-desc">お店・体験・ツアーの掲載と、予約・チャットの管理（日本語）</p>
            {business ? (
              <Link to="/biz" className="btn btn-primary">
                事業者画面へ
              </Link>
            ) : (
              <>
                <Link to="/biz/login" className="btn btn-primary">
                  ログイン
                </Link>
                <div className="top-actions">
                  <Link to="/biz/signup" className="btn">
                    新規登録（無料）
                  </Link>
                </div>
              </>
            )}
            <p className="top-langs small" lang="en">
              For businesses (Japanese only)
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
