// チャットの写真：受け取る形式の確認と、会話の当事者だけに見せる配信
import { z } from 'zod';
import { LIMITS } from '../shared/constants.js';
import { currentUser } from './auth.js';
import { prisma } from './db.js';
import { HttpError, RAW, type Ctx } from './http.js';

/** 端末で縮小した JPEG / PNG / WebP（SVG は受け付けない） */
export const ChatPhoto = z
  .string()
  .max(Math.ceil(LIMITS.photoMaxBytes * 1.4))
  .refine((s) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s), 'invalid_photo');

/** 文章か写真のどちらかがあればよい */
export const ChatInput = z
  .object({ text: z.string().trim().max(LIMITS.messageMaxChars).default(''), photo: ChatPhoto.optional() })
  .refine((b) => b.text.length > 0 || !!b.photo, { message: 'empty', path: ['text'] });

export const chatPhotoUrl = (m: { id: string; hasPhoto: boolean }) => (m.hasPhoto ? `/api/chat-photos/${m.id}` : null);

/** 会話の旅行者本人か、その店の事業者だけが見られる */
export async function serveChatPhoto(ctx: Ctx, messageId: string) {
  const u = await currentUser(ctx);
  if (!u) throw new HttpError(401, 'unauthorized');
  const m = await prisma.message.findUnique({
    where: { id: messageId },
    select: { photo: true, conversation: { select: { travelerId: true, listing: { select: { businessId: true } } } } },
  });
  const allowed = m && (m.conversation.travelerId === u.id || (u.businessId && m.conversation.listing.businessId === u.businessId) || u.role === 'ADMIN');
  const match = allowed && m.photo ? /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(m.photo.data) : null;
  if (!match) throw new HttpError(404, 'not_found');
  const buf = Buffer.from(match[2], 'base64');
  ctx.res.statusCode = 200;
  ctx.res.setHeader('Content-Type', match[1]);
  ctx.res.setHeader('Content-Length', buf.length);
  // 本人だけが見る写真なので、共有のキャッシュには置かせない
  ctx.res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  ctx.res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  ctx.res.setHeader('X-Content-Type-Options', 'nosniff');
  ctx.res.end(buf);
  return RAW;
}
