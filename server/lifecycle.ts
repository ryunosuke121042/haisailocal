// 時間で動く処理：API を呼ぶたびに（同じインスタンスでは30秒に1回まで）時刻が来たメールを送る。
// あわせて Vercel Cron Jobs から1日1回呼び、送信予約できなかったメールの取りこぼしを防ぐ
import { flushDueMail } from './email.js';

let lastSweep = 0;

export async function sweep(force = false) {
  if (!force && Date.now() - lastSweep < 30_000) return;
  lastSweep = Date.now();
  await flushDueMail().catch((e) => console.error('flush mail failed', e));
}
