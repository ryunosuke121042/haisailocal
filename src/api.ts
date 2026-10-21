export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: unknown,
  ) {
    super(code);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  // 読み込み（GET）は、通信が一瞬切れたときやサーバーが混み合ったとき（502〜504）に1回だけやり直す。
  // 送信（POST など）は二重に処理されないよう、やり直さない
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`/api${path}`, {
        method,
        headers: opts.body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        credentials: 'same-origin',
      });
    } catch (e) {
      if (method === 'GET' && attempt === 0) {
        await sleep(800);
        continue;
      }
      throw new ApiError(0, 'network', String(e));
    }
    if (method === 'GET' && attempt === 0 && res.status >= 502 && res.status <= 504) {
      await sleep(800);
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, json.error ?? 'error', json.detail);
    return json as T;
  }
}

export const get = <T,>(p: string) => api<T>(p);
export const post = <T,>(p: string, body: unknown = {}) => api<T>(p, { method: 'POST', body });
export const put = <T,>(p: string, body: unknown) => api<T>(p, { method: 'PUT', body });
export const del = <T,>(p: string) => api<T>(p, { method: 'DELETE' });
