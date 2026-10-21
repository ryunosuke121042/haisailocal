// メール。リマインドなどはあらかじめ送信予約し、予約がキャンセルされたら取り消す。
// RESEND_API_KEY があれば Resend で送り（送信予約も使う）、なければ送信箱（EmailOutbox）とサーバーログに残すだけの開発モード。
import { prisma } from './db.js';

const FROM = process.env.EMAIL_FROM || 'haisailocal <noreply@example.com>';

export function emailMode(): 'resend' | 'outbox' {
  return process.env.RESEND_API_KEY ? 'resend' : 'outbox';
}

export function appUrl(path = '') {
  const base = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:5173');
  return base.replace(/\/$/, '') + path;
}

export interface MailInput {
  to: string;
  subject: string;
  body: string;
  kind: string;
  /** 取り消し用のキー（例 remind:<予約ID>） */
  refKey?: string;
  /** 送信予約の日時（未指定なら今すぐ） */
  scheduledAt?: Date;
}

async function resendSend(m: { to: string; subject: string; body: string; scheduledAt: Date }) {
  const future = m.scheduledAt.getTime() > Date.now() + 60_000;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [m.to], subject: m.subject, text: m.body, ...(future ? { scheduled_at: m.scheduledAt.toISOString() } : {}) }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return { id: ((await res.json()) as { id: string }).id, scheduled: future };
}

/** 送信に失敗しても、予約などの本処理は止めない */
export async function sendMail(m: MailInput) {
  const scheduledAt = m.scheduledAt ?? new Date();
  const now = scheduledAt.getTime() <= Date.now() + 60_000;
  // パスワード再設定のリンクは、実際に送るときは運営画面から読めないように本文を残さない
  const stored = m.kind === 'passwordReset' && emailMode() === 'resend' ? '（パスワード再設定のリンクのため、本文は保存していません）' : m.body;
  const row = await prisma.emailOutbox
    .create({
      data: {
        to: m.to,
        subject: m.subject,
        body: stored,
        kind: m.kind,
        refKey: m.refKey,
        scheduledAt,
        // 今すぐ送るものは、送り終わるまで定期処理に拾われないよう SENDING で作る
        status: now && emailMode() === 'resend' ? 'SENDING' : 'PENDING',
      },
    })
    .catch((e) => {
      console.error('mail outbox failed', e);
      return null;
    });
  if (!row) return;
  if (emailMode() === 'outbox') {
    // 開発モード：時刻が来たら flushDueMail が「記録済み」にする
    if (now) {
      console.info(`[mail:${m.kind}] to=${m.to} subject=${m.subject}`);
      await prisma.emailOutbox.update({ where: { id: row.id }, data: { status: 'LOGGED' } }).catch(() => {});
    }
    return;
  }
  try {
    const r = await resendSend({ ...m, scheduledAt });
    await prisma.emailOutbox.update({ where: { id: row.id }, data: { providerId: r.id, status: r.scheduled ? 'SCHEDULED' : 'SENT' } }).catch(() => {});
  } catch (e) {
    // 送信予約の期間外などで失敗したら PENDING に戻し、定期処理（flushDueMail）で送り直す
    console.error('mail failed', e);
    await prisma.emailOutbox.update({ where: { id: row.id }, data: { status: 'PENDING', error: String(e).slice(0, 500) } }).catch(() => {});
  }
}

/** 送信予約を取り消す（予約がキャンセルされた等） */
export async function cancelScheduled(refKey: string) {
  const rows = await prisma.emailOutbox.findMany({ where: { refKey, status: { in: ['PENDING', 'SCHEDULED'] } } });
  for (const r of rows) {
    let ok = true;
    if (r.providerId && emailMode() === 'resend') {
      const res = await fetch(`https://api.resend.com/emails/${r.providerId}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } }).catch((e) => {
        console.error('resend cancel failed', e);
        return null;
      });
      ok = !!res?.ok;
    }
    // 取り消しに失敗したら、運営画面で分かるように残す
    await prisma.emailOutbox.updateMany({ where: { id: r.id, status: r.status }, data: ok ? { status: 'CANCELED' } : { status: 'CANCEL_FAILED', error: 'cancel failed' } });
  }
}

/** 時刻が来た未送信メールを送る（開発モードでは記録だけ） */
export async function flushDueMail() {
  const due = await prisma.emailOutbox.findMany({ where: { status: 'PENDING', scheduledAt: { lte: new Date() } }, take: 50 });
  for (const r of due) {
    // 同時に動いている別のインスタンスと二重に送らないよう、先に確保できた行だけ送る
    const { count } = await prisma.emailOutbox.updateMany({ where: { id: r.id, status: 'PENDING' }, data: { status: 'SENDING' } });
    if (!count) continue;
    if (emailMode() === 'outbox') {
      console.info(`[mail:${r.kind}] to=${r.to} subject=${r.subject}`);
      await prisma.emailOutbox.update({ where: { id: r.id }, data: { status: 'LOGGED' } });
      continue;
    }
    try {
      const s = await resendSend({ ...r, scheduledAt: new Date() });
      await prisma.emailOutbox.update({ where: { id: r.id }, data: { providerId: s.id, status: 'SENT', error: null } });
    } catch (e) {
      await prisma.emailOutbox.update({ where: { id: r.id }, data: { status: 'FAILED', error: String(e).slice(0, 500) } });
    }
  }
}

/** 事業者アカウントのメールアドレス（家族の複数ログインはすべて同じアカウントなので1件のことが多い） */
export async function businessEmails(businessId: string) {
  const users = await prisma.user.findMany({ where: { businessId }, select: { email: true } });
  return users.map((u) => u.email);
}
