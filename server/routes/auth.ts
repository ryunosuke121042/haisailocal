import { z } from 'zod';
import { CURRENCIES, LANGS, type Lang } from '../../shared/constants.js';
import { PrefsSchema, type Prefs } from '../../shared/filters.js';
import { currentUser, endSession, hashPassword, newToken, publicUser, requireUser, startSession, verifyPassword } from '../auth.js';
import { prisma } from '../db.js';
import { appUrl, emailMode, sendMail } from '../email.js';
import { HttpError, parse, type Router } from '../http.js';
import { travelerMail } from '../mailtext.js';
import { translatorName } from '../translate.js';
import { aiEnabled, aiProviders } from '../ai.js';

/** デモ用の動き（デモ用アカウントへのワンタップのログイン、デモの表示）。本番運用では DEMO_MODE=off にする */
export function demoMode() {
  return process.env.DEMO_MODE !== 'off';
}

/** 同意していない人の宗教上の制限・アレルギーは保存しない */
function safePrefs(p: Prefs | undefined, consent: boolean): Prefs | undefined {
  return p ? { ...p, ...(consent ? {} : { religious: [], allergens: [] }) } : undefined;
}

const Email = z.string().trim().toLowerCase().email().max(200);
const Password = z.string().min(8).max(200);

export function authRoutes(r: Router) {
  r.get('/me', async (ctx) => {
    const u = await currentUser(ctx);
    return {
      user: u ? publicUser(u) : null,
      config: { translator: translatorName(), ai: aiEnabled(), aiProviders: aiProviders(), email: emailMode(), pushPublicKey: process.env.VAPID_PUBLIC_KEY ?? null, demo: demoMode() },
    };
  });

  // 旅行者の登録：チャットか予約を始めるときに求める
  r.post('/auth/signup', async (ctx) => {
    const b = parse(
      z.object({
        name: z.string().trim().min(1).max(60),
        email: Email,
        password: Password,
        privacyConsent: z.literal(true),
        lang: z.enum(LANGS).default('en'),
        currency: z.enum(CURRENCIES).default('USD'),
        // 端末に残していた最初の質問の答え（アカウントを作る前に答えた分）
        prefs: PrefsSchema.optional(),
        prefsDate: z.string().max(10).optional(),
        sensitiveConsent: z.boolean().optional(),
        characterHidden: z.boolean().optional(),
      }),
      ctx.body,
    );
    if (await prisma.user.findUnique({ where: { email: b.email } })) throw new HttpError(409, 'email_taken');
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        email: b.email,
        name: b.name,
        passwordHash: await hashPassword(b.password),
        lang: b.lang,
        currency: b.currency,
        privacyConsentAt: now,
        sensitiveConsentAt: b.sensitiveConsent ? now : null,
        prefs: safePrefs(b.prefs, !!b.sensitiveConsent),
        prefsDate: b.prefsDate,
        characterHidden: b.characterHidden ?? false,
      },
    });
    await startSession(ctx, user.id);
    return { user: publicUser(user) };
  });

  // 事業者の登録：メールアドレスで登録する（誰でも登録でき、店舗は保存すると即公開）
  r.post('/auth/biz-signup', async (ctx) => {
    const b = parse(z.object({ businessName: z.string().trim().min(1).max(80), email: Email, password: Password, termsConsent: z.literal(true) }), ctx.body);
    if (await prisma.user.findUnique({ where: { email: b.email } })) throw new HttpError(409, 'email_taken');
    const user = await prisma.user.create({
      data: {
        email: b.email,
        name: b.businessName,
        passwordHash: await hashPassword(b.password),
        role: 'BUSINESS',
        // 事業者とアカウントを一度に作る（途中で失敗しても事業者だけが残らない）
        business: { create: { name: b.businessName } },
        lang: 'ja',
        currency: 'JPY',
        privacyConsentAt: new Date(),
      },
    });
    await startSession(ctx, user.id);
    return { user: publicUser(user) };
  });

  // デモ用：パスワードを入れずに、シードのデモ用アカウントでログインする
  r.post('/auth/demo-login', async (ctx) => {
    if (!demoMode()) throw new HttpError(404, 'not_found');
    // 運営の画面には、デモでもパスワードなしでは入れない
    const b = parse(z.object({ role: z.enum(['traveler', 'business']) }), ctx.body);
    const email = { traveler: 'traveler@example.com', business: 'biz@example.com' }[b.role];
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new HttpError(404, 'demo_account_missing');
    await startSession(ctx, user.id);
    return { user: publicUser(user) };
  });

  r.post('/auth/login', async (ctx) => {
    const b = parse(z.object({ email: Email, password: z.string().max(200) }), ctx.body);
    const user = await prisma.user.findUnique({ where: { email: b.email } });
    if (!user || !(await verifyPassword(b.password, user.passwordHash))) throw new HttpError(401, 'invalid_credentials');
    await startSession(ctx, user.id);
    return { user: publicUser(user) };
  });

  r.post('/auth/logout', async (ctx) => {
    await endSession(ctx);
    return { ok: true };
  });

  // 画面側で起きたエラーをログに残す（手元で再現できない不具合の原因を調べるため。個人情報は送らない）
  r.post('/client-error', async (ctx) => {
    const b = z
      .object({ message: z.string().max(500), stack: z.string().max(3000).optional(), where: z.string().max(200).optional(), ua: z.string().max(300).optional() })
      .safeParse(ctx.body);
    if (b.success) console.error('client error', JSON.stringify(b.data));
    return { ok: true };
  });

  // パスワードを忘れた場合は、登録したメールアドレスに再設定リンクを送る
  r.post('/auth/forgot', async (ctx) => {
    const b = parse(z.object({ email: Email }), ctx.body);
    const user = await prisma.user.findUnique({ where: { email: b.email } });
    if (user) {
      const token = newToken();
      await prisma.passwordReset.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } });
      const lang: Lang = user.role === 'TRAVELER' ? ((LANGS as readonly string[]).includes(user.lang) ? (user.lang as Lang) : 'en') : 'ja';
      const path = user.role === 'TRAVELER' ? `/${lang}/reset?token=${token}` : `/biz/reset?token=${token}`;
      await sendMail({ to: user.email, ...travelerMail(lang, 'passwordReset', { url: appUrl(path) }), kind: 'passwordReset' });
    }
    // 登録の有無は返さない
    return { ok: true };
  });

  r.post('/auth/reset', async (ctx) => {
    const b = parse(z.object({ token: z.string().max(200), password: Password }), ctx.body);
    const pr = await prisma.passwordReset.findUnique({ where: { token: b.token } });
    if (!pr || pr.usedAt || pr.expiresAt < new Date()) throw new HttpError(400, 'invalid_token');
    const hash = await hashPassword(b.password);
    await prisma.$transaction(async (tx) => {
      // 同じリンクを同時に2回使えないよう、未使用のときだけ使用済みにする
      const { count } = await tx.passwordReset.updateMany({ where: { token: b.token, usedAt: null }, data: { usedAt: new Date() } });
      if (!count) throw new HttpError(400, 'invalid_token');
      await tx.user.update({ where: { id: pr.userId }, data: { passwordHash: hash } });
      await tx.session.deleteMany({ where: { userId: pr.userId } });
    });
    await startSession(ctx, pr.userId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: pr.userId } });
    return { user: publicUser(user) };
  });

  r.put('/me', async (ctx) => {
    const u = await requireUser(ctx);
    const b = parse(
      z.object({
        lang: z.enum(LANGS).optional(),
        currency: z.enum(CURRENCIES).optional(),
        prefs: PrefsSchema.optional(),
        prefsDate: z.string().max(10).optional(),
        sensitiveConsent: z.boolean().optional(),
        characterHidden: z.boolean().optional(),
      }),
      ctx.body,
    );
    const consent = b.sensitiveConsent ?? !!u.sensitiveConsentAt;
    const user = await prisma.user.update({
      where: { id: u.id },
      data: {
        lang: b.lang,
        currency: b.currency,
        prefsDate: b.prefsDate,
        characterHidden: b.characterHidden,
        prefs: b.prefs
          ? safePrefs(b.prefs, consent)
          : // 同意を取り下げたら、保存済みの宗教上の制限・アレルギーを消す
            b.sensitiveConsent === false
            ? safePrefs((u.prefs as Prefs | null) ?? {}, false)
            : undefined,
        ...(b.sensitiveConsent === undefined ? {} : { sensitiveConsentAt: b.sensitiveConsent ? (u.sensitiveConsentAt ?? new Date()) : null }),
      },
    });
    return { user: publicUser(user) };
  });

  // カード登録（請求はしない。無断キャンセルの抑止）。決済代行は要確認のため、MVPはカード情報を受け取らず登録済みの記録だけを残す
  r.post('/me/card', async (ctx) => {
    const u = await requireUser(ctx, 'TRAVELER');
    const user = await prisma.user.update({ where: { id: u.id }, data: { cardRegisteredAt: new Date() } });
    return { user: publicUser(user) };
  });
}
