// 受付停止日：カレンダーで日をタップして受付を止める。期間を選んでまとめて止めることもできる
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addDays, daysBetween } from '../../shared/time';
import { get, put } from '../api';

interface Data {
  today: string;
  nameJa: string;
  closedWeekdays: number[];
  closedDates: string[];
  reservations: Record<string, number>;
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const MONTHS = 4;

function monthStart(date: string, plus: number) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + plus);
  return d.toISOString().slice(0, 10);
}

export function BizClosed() {
  const { id } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [rangeMode, setRangeMode] = useState(false);
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(() => {
    get<Data>(`/biz/listings/${id}/closed`)
      .then((r) => {
        setData(r);
        setErr(false);
      })
      .catch(() => setErr(true));
  }, [id]);
  useEffect(load, [load]);

  if (!data) return err ? <p className="notice notice-error">読み込めませんでした。</p> : <div className="spinner" />;
  const closed = new Set(data.closedDates);

  async function change(add: string[], remove: string[]) {
    setMsg(null);
    // 先に画面を変え、失敗したら読み込み直す
    setData((d) => (d ? { ...d, closedDates: [...new Set([...d.closedDates.filter((x) => !remove.includes(x)), ...add])].sort() } : d));
    try {
      await put(`/biz/listings/${id}/closed`, { add, remove });
      const withRes = add.filter((x) => data!.reservations[x]);
      if (withRes.length) {
        setMsg(`予約が入っている日があります（${withRes.join('、')}）。受付を止めても、確定済みの予約は自動ではキャンセルされません。お休みにする場合は、予約一覧から理由を選んでキャンセルしてください。`);
      }
    } catch {
      // 保存に失敗したら、画面を保存済みの状態に戻して知らせる
      setMsg('保存できませんでした。通信状態を確認して、もう一度お試しください。');
      load();
    }
  }

  function tap(date: string) {
    if (!rangeMode) return void change(closed.has(date) ? [] : [date], closed.has(date) ? [date] : []);
    if (!range.from || range.to) setRange({ from: date });
    else setRange(date < range.from ? { from: date, to: range.from } : { from: range.from, to: date });
  }

  const rangeDates = range.from && range.to ? Array.from({ length: daysBetween(range.from, range.to) + 1 }, (_, i) => addDays(range.from!, i)) : [];

  return (
    <div className="stack">
      <p className="small">
        <Link to="/biz">← ホーム</Link>
      </p>
      <h1>受付停止日</h1>
      <p className="small muted">{data.nameJa}：タップした日は予約を受け付けません（定休日の曜日は店舗の編集画面で設定します）。</p>
      <div className="seg" role="group">
        <button className={!rangeMode ? 'on' : ''} onClick={() => (setRangeMode(false), setRange({}))}>
          1日ずつ
        </button>
        <button className={rangeMode ? 'on' : ''} onClick={() => setRangeMode(true)}>
          期間でまとめて
        </button>
      </div>
      {rangeMode && (
        <div className="notice notice-info small stack-s">
          {!range.from ? '最初の日をタップしてください。' : !range.to ? '最後の日をタップしてください。' : `${range.from} 〜 ${range.to}（${rangeDates.length}日間）`}
          {rangeDates.length > 0 && (
            <div className="actions">
              <button className="btn btn-primary btn-small" onClick={() => void change(rangeDates, []).then(() => setRange({}))}>
                この期間の受付を止める
              </button>
              <button className="btn btn-small" onClick={() => void change([], rangeDates).then(() => setRange({}))}>
                この期間の停止を解除
              </button>
            </div>
          )}
        </div>
      )}
      {msg && <p className="notice notice-warn small">{msg}</p>}
      {Array.from({ length: MONTHS }, (_, m) => {
        const start = monthStart(data.today, m);
        const end = addDays(monthStart(data.today, m + 1), -1);
        const lead = new Date(`${start}T00:00:00Z`).getUTCDay();
        const days = Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => addDays(start, i));
        return (
          <section key={start}>
            <h2>
              {Number(start.slice(0, 4))}年{Number(start.slice(5, 7))}月
            </h2>
            <div className="calendar biz-cal">
              {WEEK.map((w) => (
                <div key={w} className="cal-head">
                  {w}
                </div>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <div key={`x${i}`} />
              ))}
              {days.map((date) => {
                const past = date < data.today;
                const weekly = data.closedWeekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
                const isClosed = closed.has(date);
                const inRange = rangeDates.includes(date) || range.from === date;
                const res = data.reservations[date];
                return (
                  <button
                    key={date}
                    type="button"
                    className={`cal-cell ${isClosed ? 'st-FULL' : weekly ? 'cal-weekly' : 'st-OK'} ${inRange ? 'on' : ''}`}
                    disabled={past}
                    onClick={() => tap(date)}
                    aria-pressed={isClosed}
                    aria-label={`${date}${isClosed ? ' 受付停止' : weekly ? ' 定休日' : ''}${res ? ` 予約${res}件` : ''}`}
                  >
                    <span className="cal-day">{Number(date.slice(8))}</span>
                    <span className="cal-sym small">{isClosed ? '停止' : weekly ? '定休' : res ? `予${res}` : ''}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
