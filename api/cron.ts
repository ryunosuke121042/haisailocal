// Vercel Cron Jobs から1日1回呼ばれる：時刻が来たのに送れていないメールを送る（Hobbyプランの間は1日1回）
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sweep } from '../server/lifecycle.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.end('unauthorized');
    return;
  }
  await sweep(true);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}
