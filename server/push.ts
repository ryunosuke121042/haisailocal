import webpush from 'web-push';
import { prisma } from './db.js';

let configured = false;
export function pushEnabled() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  /** 通知音＋確認ボタンが必要な通知 */
  urgent?: boolean;
  tag?: string;
}

/** 事業者アカウントのすべての端末へ送る（家族で同じアカウントを使う場合も全員に届く） */
export async function pushToBusiness(businessId: string, payload: PushPayload) {
  if (!pushEnabled()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { user: { businessId } } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          urgency: payload.urgent ? 'high' : 'normal',
          TTL: 60 * 60 * 24,
        });
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.error('push failed', e);
      }
    }),
  );
}
