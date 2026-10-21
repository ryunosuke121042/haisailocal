// 保存リスト：気になる店を保存し、旅程の候補として見返す
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { get } from '../api';
import { useCharacter } from '../components/Character';
import { areaName, ErrorBox, Money, Photo, Spinner, Stars } from '../components/ui';
import { useApp } from '../store';
import type { Card } from '../types';

export default function Saved() {
  const { t, lang, me } = useApp();
  const [list, setList] = useState<Card[] | null>(null);
  const [err, setErr] = useState(false);
  const [attempt, setTry] = useState(0);
  useCharacter({ line: t('say_saved') });
  useEffect(() => {
    if (me?.role !== 'TRAVELER') return;
    setErr(false);
    get<{ results: Card[] }>(`/saved?lang=${lang}`)
      .then((r) => setList(r.results))
      .catch(() => setErr(true));
  }, [lang, me, attempt]);
  if (me?.role !== 'TRAVELER') return <Navigate to={`/${lang}/login?next=${encodeURIComponent(`/${lang}/saved`)}`} replace />;
  if (err) return <ErrorBox onRetry={() => setTry((n) => n + 1)} />;
  if (!list) return <Spinner />;
  return (
    <div className="stack">
      <h1>{t('navSaved')}</h1>
      {list.length === 0 && (
        <p className="notice">
          {t('noSaved')} <Link to={`/${lang}`}>{t('backToList')}</Link>
        </p>
      )}
      <ul className="list">
        {list.map((c) => (
          <li key={c.id}>
            <Link to={`/${lang}/shop/${c.id}`} className="list-item">
              <span className="thumb">
                <Photo src={c.photo} alt="" />
              </span>
              <span className="grow stack-s">
                <strong>{c.name.text}</strong>
                <span className="small muted">{areaName(c.area, lang)}</span>
                <Stars rating={c.rating} />
                {c.priceJpy != null && <Money jpy={c.priceJpy} suffix={t('perPerson')} />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
