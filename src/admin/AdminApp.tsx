// 運営の最小限の管理画面：掲載の確認と非公開化、報告、予約とトラブル（期限後キャンセル・来店なし）、翻訳エラー報告、評価と削除申出、送信メール
import { useCallback, useEffect, useState } from 'react';
import { REVIEW_TAG_JA, type ReviewTag } from '../../shared/constants';
import { get, post } from '../api';
import type { Me } from '../types';

interface Overview {
  emailMode: 'resend' | 'outbox';
  listings: { id: string; nameJa: string; status: string; category: string | null; area: string; business: { id: string; name: string }; reports: number; halalCertified: boolean; updatedAt: string }[];
  reports: { id: string; reason: string; status: string; createdAt: string; listing: { id: string; nameJa: string; status: string } }[];
  reservations: { id: string; status: string; listing: string; traveler: string; date: string; time: string; partySize: number; lateCancel: boolean; cancelFeeJpy: number | null; lateFeeJpy: number | null; createdAt: string }[];
  translationReports: { id: string; source: string; shown: string; targetLang: string; context: string; status: string; createdAt: string }[];
  reviews: { id: string; listing: string; stars: number; tags: ReviewTag[]; photos: string[]; hidden: boolean; takedownReason: string; takedownAt: string | null; createdAt: string }[];
  emails: { id: string; to: string; subject: string; body: string; kind: string; status: string; scheduledAt: string; createdAt: string; error: string | null }[];
}

const TABS = [
  ['listings', '掲載'],
  ['reports', '店舗の報告'],
  ['trouble', '予約のトラブル'],
  ['reservations', '予約'],
  ['translationReports', '翻訳エラー報告'],
  ['reviews', '評価・削除申出'],
  ['emails', '送信メール'],
] as const;

const d = (s: string) => new Date(s).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const STATUS_JA: Record<string, string> = {
  DRAFT: '下書き',
  PUBLISHED: '公開中',
  HIDDEN: '事業者が非公開',
  SUSPENDED: '運営が非公開',
  CONFIRMED: '確定',
  NO_SHOW: '来店なし',
  CANCELED_BY_TRAVELER: '旅行者キャンセル',
  CANCELED_BY_BUSINESS: '事業者キャンセル',
};

export default function AdminApp() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [o, setO] = useState<Overview | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('listings');
  const load = useCallback(() => get<Overview>('/admin/overview').then(setO), []);
  useEffect(() => {
    document.documentElement.lang = 'ja';
    document.title = 'haisailocal 運営';
    get<{ user: Me | null }>('/me')
      .then((r) => setMe(r.user))
      .catch(() => setMe(null));
  }, []);
  useEffect(() => {
    if (me?.role === 'ADMIN') void load();
  }, [me, load]);

  if (me === undefined) return <div className="spinner" />;
  if (!me || me.role !== 'ADMIN') return <AdminLogin onLogin={setMe} />;
  if (!o) return <div className="spinner" />;
  const act = async (path: string, body: unknown = {}) => {
    await post(path, body).catch(() => alert('操作できませんでした。'));
    // ログインが切れていたら、ログイン画面に戻す
    await load().catch(() => setMe(null));
  };
  const trouble = o.reservations.filter((x) => x.status === 'NO_SHOW' || x.lateCancel);
  const count: Record<string, number> = {
    reports: o.reports.filter((x) => x.status === 'OPEN').length,
    trouble: trouble.length,
    translationReports: o.translationReports.filter((x) => x.status === 'OPEN').length,
    reviews: o.reviews.filter((x) => x.takedownAt && !x.hidden).length,
  };

  return (
    <div className="admin">
      <header className="topbar">
        <strong>運営管理</strong>
        <span className="spacer" />
        <span className="small">メール送信：{o.emailMode === 'resend' ? 'Resend' : '送信箱のみ（開発）'}</span>
        <button
          className="link small"
          onClick={async () => {
            await post('/auth/logout');
            setMe(null);
          }}
        >
          ログアウト
        </button>
      </header>
      <nav className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
            {count[k] ? ` (${count[k]})` : ''}
          </button>
        ))}
      </nav>
      <div className="table-wrap">
        {tab === 'listings' && (
          <table>
            <thead>
              <tr>
                <th>状態</th>
                <th>店名</th>
                <th>事業者</th>
                <th>報告</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {o.listings.map((l) => (
                <tr key={l.id}>
                  <td>{STATUS_JA[l.status] ?? l.status}</td>
                  <td>
                    {l.status === 'PUBLISHED' ? (
                      <a href={`/ja/shop/${l.id}`} target="_blank" rel="noopener">
                        {l.nameJa || '（未入力）'}
                      </a>
                    ) : (
                      l.nameJa || '（未入力）'
                    )}
                    {l.halalCertified && <span className="badge badge-halal">ハラル認証（要確認）</span>}
                  </td>
                  <td>{l.business.name}</td>
                  <td>{l.reports || ''}</td>
                  <td>
                    {l.status === 'SUSPENDED' ? (
                      <button className="btn btn-small" onClick={() => void act(`/admin/listings/${l.id}/restore`)}>
                        再公開
                      </button>
                    ) : (
                      // 事業者が自分で非公開・下書きにしていても、運営が止めておけば事業者からは公開に戻せない
                      <button className="btn btn-small btn-danger" onClick={() => confirm(`「${l.nameJa}」を運営として非公開にしますか？`) && void act(`/admin/listings/${l.id}/suspend`)}>
                        非公開にする
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'reports' && (
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>店舗</th>
                <th>理由</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {o.reports.map((x) => (
                <tr key={x.id}>
                  <td>{d(x.createdAt)}</td>
                  <td>
                    {x.listing.nameJa}（{STATUS_JA[x.listing.status] ?? x.listing.status}）
                  </td>
                  <td className="pre">{x.reason}</td>
                  <td>
                    {x.status === 'OPEN' ? (
                      <>
                        {x.listing.status !== 'SUSPENDED' && (
                          <button className="btn btn-small btn-danger" onClick={() => void act(`/admin/listings/${x.listing.id}/suspend`)}>
                            店舗を非公開
                          </button>
                        )}{' '}
                        <button className="btn btn-small" onClick={() => void act(`/admin/reports/${x.id}/close`)}>
                          対応済み
                        </button>
                      </>
                    ) : (
                      '対応済み'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(tab === 'reservations' || tab === 'trouble') && (
          <>
            {tab === 'trouble' && <p className="small muted">来店なし・無料キャンセルの期限後のキャンセル。キャンセル料を登録カードに請求するかは運営が判断する（MVPでは決済しない）。</p>}
            <table>
              <thead>
                <tr>
                  <th>状態</th>
                  <th>日時</th>
                  <th>店舗</th>
                  <th>旅行者</th>
                  <th>人数</th>
                  <th>キャンセル料の目安</th>
                </tr>
              </thead>
              <tbody>
                {(tab === 'trouble' ? trouble : o.reservations).map((x) => (
                  <tr key={x.id}>
                    <td>
                      {STATUS_JA[x.status] ?? x.status}
                      {x.lateCancel && '（期限後）'}
                    </td>
                    <td>
                      {x.date} {x.time}
                    </td>
                    <td>{x.listing}</td>
                    <td>{x.traveler}</td>
                    <td>{x.partySize}</td>
                    <td>{x.cancelFeeJpy ? yen(x.cancelFeeJpy) : x.status === 'NO_SHOW' && x.lateFeeJpy ? yen(x.lateFeeJpy * x.partySize) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {tab === 'translationReports' && (
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>原文</th>
                <th>表示された訳</th>
                <th>言語</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {o.translationReports.map((x) => (
                <tr key={x.id}>
                  <td>{d(x.createdAt)}</td>
                  <td className="pre">{x.source}</td>
                  <td className="pre">{x.shown}</td>
                  <td>
                    {x.targetLang}
                    <br />
                    <span className="small muted">{x.context}</span>
                  </td>
                  <td>
                    {x.status === 'OPEN' ? (
                      <>
                        <button className="btn btn-small" onClick={() => void act(`/admin/translation-reports/${x.id}/close`, { retranslate: true })}>
                          翻訳し直す
                        </button>{' '}
                        <button className="btn btn-small btn-ghost" onClick={() => void act(`/admin/translation-reports/${x.id}/close`)}>
                          対応済み
                        </button>
                      </>
                    ) : (
                      '対応済み'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'reviews' && (
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>店舗</th>
                <th>評価</th>
                <th>削除申出</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {o.reviews.map((x) => (
                <tr key={x.id}>
                  <td>{d(x.createdAt)}</td>
                  <td>{x.listing}</td>
                  <td>
                    {'★'.repeat(x.stars)}
                    <br />
                    <span className="small">{x.tags.map((t) => REVIEW_TAG_JA[t] ?? t).join('、')}</span>
                    {x.photos.length > 0 && (
                      <span className="review-photos">
                        {x.photos.map((p) => (
                          <a key={p} href={p} target="_blank" rel="noreferrer">
                            <img src={p} alt="レビューの写真" loading="lazy" />
                          </a>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="pre small">{x.takedownAt ? `${d(x.takedownAt)}\n${x.takedownReason}` : ''}</td>
                  <td>
                    <button className="btn btn-small" onClick={() => void act(`/admin/reviews/${x.id}/visibility`, { hidden: !x.hidden })}>
                      {x.hidden ? '表示に戻す' : '非表示にする'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'emails' && (
          <table>
            <thead>
              <tr>
                <th>作成</th>
                <th>送信予定</th>
                <th>状態</th>
                <th>宛先・件名</th>
                <th>本文</th>
              </tr>
            </thead>
            <tbody>
              {o.emails.map((x) => (
                <tr key={x.id}>
                  <td>{d(x.createdAt)}</td>
                  <td>{d(x.scheduledAt)}</td>
                  <td>
                    {x.status}
                    {x.error && <span className="small warn"> {x.error}</span>}
                  </td>
                  <td>
                    {x.to}
                    <br />
                    <strong>{x.subject}</strong>
                  </td>
                  <td className="pre small">{x.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }: { onLogin: (m: Me) => void }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  return (
    <form
      className="auth stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(false);
        try {
          const r = await post<{ user: Me }>('/auth/login', { email, password: pw });
          if (r.user.role !== 'ADMIN') {
            await post('/auth/logout');
            return setErr(true);
          }
          onLogin(r.user);
        } catch {
          setErr(true);
        }
      }}
    >
      <h1>運営ログイン</h1>
      <input type="email" required placeholder="メールアドレス" aria-label="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" required placeholder="パスワード" aria-label="パスワード" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p className="notice notice-error">ログインできませんでした。</p>}
      <button className="btn btn-primary">ログイン</button>
    </form>
  );
}
