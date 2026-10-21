import type { IncomingMessage, ServerResponse } from 'node:http';
import { Prisma } from '@prisma/client';
import { ZodError, type ZodTypeAny, type output } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: unknown,
  ) {
    super(code);
  }
}

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  cookies: Record<string, string>;
}

type Handler = (ctx: Ctx) => Promise<unknown>;
interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler) {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' +
        path.replace(/:([a-zA-Z]+)/g, (_, k) => {
          keys.push(k);
          return '([^/]+)';
        }) +
        '$',
    );
    this.routes.push({ method, pattern, keys, handler });
  }
  get(p: string, h: Handler) {
    this.add('GET', p, h);
  }
  post(p: string, h: Handler) {
    this.add('POST', p, h);
  }
  put(p: string, h: Handler) {
    this.add('PUT', p, h);
  }
  delete(p: string, h: Handler) {
    this.add('DELETE', p, h);
  }

  match(method: string, path: string) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.pattern.exec(path);
      if (m) {
        const params: Record<string, string> = {};
        r.keys.forEach((k, i) => (params[k] = safeDecode(m[i + 1])));
        return { handler: r.handler, params };
      }
    }
    return null;
  }
}

/** 壊れた %エンコードがあっても落ちないようにする（元の文字列のまま使う） */
function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

/** ハンドラーが自分で応答を書いたとき（画像など）に返す */
export const RAW = Symbol('raw');

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = safeDecode(part.slice(i + 1).trim());
  }
  return out;
}

const MAX_BODY = 4_000_000; // 写真5枚（data URL）を含むため。Vercel Functions の上限 4.5MB 未満

async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  // Vercel Functions は body を先に読んでいることがある
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body ? parseJson(req.body) : undefined;
    if (Buffer.isBuffer(req.body)) return req.body.length ? parseJson(req.body.toString('utf8')) : undefined;
    return req.body;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'payload_too_large');
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return undefined;
  return parseJson(Buffer.concat(chunks).toString('utf8'));
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): output<S> {
  return schema.parse(data);
}

export function setCookie(res: ServerResponse, name: string, value: string, maxAgeSec: number) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  const prev = res.getHeader('Set-Cookie');
  const list = Array.isArray(prev) ? prev : prev ? [String(prev)] : [];
  list.push(`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`);
  res.setHeader('Set-Cookie', list);
}

export async function handle(router: Router, req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = (req.method ?? 'GET').toUpperCase();
  // Vercel の書き換え（vercel.json）では元のパスが __path で渡る
  const rawPath = url.searchParams.get('__path') ?? url.pathname.replace(/^\/api/, '');
  url.searchParams.delete('__path');
  const path = rawPath.replace(/\/$/, '') || '/';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const m = router.match(method, path);
    if (!m) throw new HttpError(404, 'not_found');
    const body = method === 'GET' ? undefined : await readBody(req);
    const ctx: Ctx = {
      req,
      res,
      method,
      path,
      params: m.params,
      query: url.searchParams,
      body,
      cookies: parseCookies(req.headers.cookie),
    };
    const result = await m.handler(ctx);
    if (result === RAW) return;
    res.statusCode = 200;
    res.end(JSON.stringify(result ?? { ok: true }));
  } catch (e) {
    if (e instanceof HttpError) {
      res.statusCode = e.status;
      res.end(JSON.stringify({ error: e.code, detail: e.detail }));
    } else if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2025')) {
      // 二重送信（一意の制約）や、消えたデータの更新は、500 ではなく 409 / 404 で返す
      res.statusCode = e.code === 'P2002' ? 409 : 404;
      res.end(JSON.stringify({ error: e.code === 'P2002' ? 'conflict' : 'not_found' }));
    } else if (e instanceof ZodError) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'validation', detail: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }));
    } else {
      console.error(e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'server_error' }));
    }
  }
}
