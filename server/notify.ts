// 通知：旅行者にはアプリ内の通知＋メール、事業者にはアプリ内の通知＋プッシュ通知＋メール。
// 前日リマインド・当日の来店前メール・来店後の評価のお願いは、予約確定時に送信予約し、キャンセルされたら取り消す
import type { Business, Listing, Reservation, User } from '@prisma/client';
import { LANGS, type Lang } from '../shared/constants.js';
import { addDays, jstDateString, jstToDate } from '../shared/time.js';
import { prisma } from './db.js';
import { appUrl, businessEmails, cancelScheduled, sendMail } from './email.js';
import { travelerMail, type MailVars, type TravelerMail } from './mailtext.js';
import { pushToBusiness } from './push.js';
import { translateOne } from './translate.js';

export const userLang = (l: string): Lang => ((LANGS as readonly string[]).includes(l) ? (l as Lang) : 'en');

export function whenText(r: Pick<Reservation, 'date' | 'time'>) {
  return `${r.date} ${r.time} (JST)`;
}

export function yen(n: number) {
  return `¥${n.toLocaleString('ja-JP')}`;
}

function jstText(d: Date) {
  return `${d.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 16)} (JST)`;
}

/** 期限は「その時刻より前」なので、表示は1分前（「前日まで」なら前日の23:59）にする */
export function deadlineText(d: Date) {
  return jstText(new Date(d.getTime() - 60_000));
}

/** 旅行者へ：アプリ内の通知とメールの両方（visibleAt があれば、その時刻に見せる・送る） */
export async function notifyTraveler(
  traveler: Pick<User, 'id' | 'email' | 'lang'>,
  type: TravelerMail,
  vars: Omit<MailVars, 'url'> & { path: string },
  opts: { reservationId?: string; visibleAt?: Date; refKey?: string; inApp?: boolean } = {},
) {
  const lang = userLang(traveler.lang);
  try {
    if (opts.inApp !== false) {
      await prisma.notification.create({
        data: {
          userId: traveler.id,
          type,
          payload: { shop: vars.shop ?? '', when: vars.when ?? '', reason: vars.reason ?? '', path: vars.path, reservationId: opts.reservationId ?? null },
          visibleAt: opts.visibleAt ?? new Date(),
          refKey: opts.refKey,
        },
      });
    }
    const mail = travelerMail(lang, type, { ...vars, url: appUrl(vars.path) });
    await sendMail({ to: traveler.email, ...mail, kind: type, refKey: opts.refKey, scheduledAt: opts.visibleAt });
  } catch (e) {
    console.error('notify traveler failed', e);
  }
}

/** 事業者へ：アプリ内の通知、プッシュ通知（家族の全端末）、メール */
export async function notifyBusiness(businessId: string, n: { type: string; title: string; body: string; path: string; urgent?: boolean }) {
  try {
    await prisma.notification.create({ data: { businessId, type: n.type, payload: { title: n.title, body: n.body, path: n.path } } });
    await pushToBusiness(businessId, { title: n.title, body: n.body, url: n.path, urgent: n.urgent, tag: n.path });
    for (const to of await businessEmails(businessId)) await sendMail({ to, subject: n.title, body: `${n.body}\n\n${appUrl(n.path)}`, kind: n.type });
  } catch (e) {
    console.error('notify business failed', e);
  }
}

const refOf = (reservationId: string) => `res:${reservationId}`;

/**
 * 予約確定時に、時間で動く通知を用意する。
 * 事前の予約：前日18時（日本時間）にリマインド。当日の予約：来店前メール（店ごと、既定15分前）。
 * 来店時刻＋所要時間のあとに、評価のお願い。
 */
export async function scheduleReservationNotices(
  r: Reservation,
  l: Listing & { business: Pick<Business, 'reminderMinutes'> },
  traveler: Pick<User, 'id' | 'email' | 'lang'>,
) {
  const lang = userLang(traveler.lang);
  const shop = (await translateOne(l.nameJa, 'ja', lang)).text;
  const path = `/${lang}/bookings/${r.id}`;
  const refKey = refOf(r.id);
  const now = Date.now();
  const today = jstDateString();
  const dayBefore = jstToDate(addDays(r.date, -1), '18:00');
  if (r.date > today && dayBefore.getTime() > now) {
    await notifyTraveler(traveler, 'reminderDayBefore', { shop, when: whenText(r), path }, { reservationId: r.id, visibleAt: dayBefore, refKey });
  } else {
    // 当日の予約と、前日18時を過ぎてから入った翌日の予約は、来店前メールで知らせる
    const minutes = l.business.reminderMinutes;
    const at = new Date(Math.max(now, r.visitAt.getTime() - minutes * 60_000));
    await notifyTraveler(traveler, 'reminderSameDay', { shop, when: whenText(r), minutes, path }, { reservationId: r.id, visibleAt: at, refKey });
  }
  const after = new Date(r.visitAt.getTime() + (l.durationMin ?? 120) * 60_000);
  await notifyTraveler(traveler, 'reviewRequest', { shop, path: `${path}#review` }, { reservationId: r.id, visibleAt: after, refKey });
}

/** キャンセル・来店なしになった予約の、まだ見せていない通知と未送信のメールを止める */
export async function cancelReservationNotices(reservationId: string) {
  const refKey = refOf(reservationId);
  await cancelScheduled(refKey).catch((e) => console.error('cancel scheduled failed', e));
  await prisma.notification.deleteMany({ where: { refKey, visibleAt: { gt: new Date() } } }).catch(() => {});
}
