import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { prisma } from './db.js';
import { HttpError, setCookie, type Ctx } from './http.js';

const COOKIE = 'sid';
const SESSION_DAYS = 60;

export function newToken() {
  return randomBytes(32).toString('base64url');
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/** 複数端末でのログインを認める（事業者の家族など） */
export async function startSession(ctx: Ctx, userId: string) {
  const token = newToken();
  await prisma.session.create({
    data: { token, userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) },
  });
  setCookie(ctx.res, COOKIE, token, SESSION_DAYS * 86_400);
}

export async function endSession(ctx: Ctx) {
  const token = ctx.cookies[COOKIE];
  if (token) await prisma.session.deleteMany({ where: { token } });
  setCookie(ctx.res, COOKIE, '', 0);
}

const cache = new WeakMap<Ctx, User | null>();

export async function currentUser(ctx: Ctx): Promise<User | null> {
  if (cache.has(ctx)) return cache.get(ctx)!;
  const token = ctx.cookies[COOKIE];
  let user: User | null = null;
  if (token) {
    const s = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (s && s.expiresAt > new Date()) user = s.user;
  }
  cache.set(ctx, user);
  return user;
}

export async function requireUser(ctx: Ctx, role?: User['role']): Promise<User> {
  const u = await currentUser(ctx);
  if (!u) throw new HttpError(401, 'login_required');
  if (role && u.role !== role) throw new HttpError(403, 'forbidden');
  return u;
}

export async function requireBusiness(ctx: Ctx): Promise<User & { businessId: string }> {
  const u = await requireUser(ctx, 'BUSINESS');
  if (!u.businessId) throw new HttpError(403, 'forbidden');
  return u as User & { businessId: string };
}

export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    businessId: u.businessId,
    lang: u.lang,
    currency: u.currency,
    cardRegistered: !!u.cardRegisteredAt,
    sensitiveConsentAt: u.sensitiveConsentAt,
    prefs: u.prefs,
    prefsDate: u.prefsDate,
    characterHidden: u.characterHidden,
  };
}
