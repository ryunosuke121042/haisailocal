// アプリ内の通知：予約の確定・お店のキャンセル・メッセージ・前日リマインド・評価のお願い
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { get, post } from '../api';
import { useCharacter } from '../components/Character';
import { ErrorBox, Spinner } from '../components/ui';
import { useApp } from '../store';

interface Item {
  id: string;
  type: 'bookingConfirmed' | 'travelerCanceled' | 'shopCanceled' | 'newMessage' | 'reminderDayBefore' | 'reminderSameDay' | 'reviewRequest';
  payload: { shop?: string; when?: string; reason?: string; path?: string };
  at: string;
  read: boolean;
}

export default function Notifications() {
  const { t, lang, me, refreshUnread } = useApp();
  const [list, setList] = useState<Item[] | null>(null);
  const [err, setErr] = useState(false);
  const [attempt, setTry] = useState(0);
  useCharacter({ line: t('say_notifications') });
  useEffect(() => {
    if (me?.role !== 'TRAVELER') return;
    setErr(false);
    get<{ results: Item[] }>('/notifications')
      .then((r) => {
        setList(r.results);
        return post('/notifications/read').then(refreshUnread);
      })
      .catch(() => setErr(true));
  }, [me, refreshUnread, attempt]);
  if (me?.role !== 'TRAVELER') return <Navigate to={`/${lang}/login?next=${encodeURIComponent(`/${lang}/notifications`)}`} replace />;
  if (err) return <ErrorBox onRetry={() => setTry((n) => n + 1)} />;
  if (!list) return <Spinner />;
  return (
    <div className="stack">
      <h1>{t('navNotifications')}</h1>
      {list.length === 0 && <p className="notice">{t('noNotifications')}</p>}
      <ul className="list">
        {list.map((n) => (
          <li key={n.id} className={n.read ? '' : 'unread'}>
            <Link to={(n.payload.path ?? `/${lang}`).replace(/^\/[a-z]{2}(?=\/)/, `/${lang}`)} className="list-item">
              <span className="grow">
                <strong>{t(`n_${n.type}`, { shop: n.payload.shop ?? '', when: n.payload.when ?? '' })}</strong>
                {n.payload.reason && <span className="small muted"> · {n.payload.reason}</span>}
                <br />
                <span className="small muted">{new Date(n.at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
