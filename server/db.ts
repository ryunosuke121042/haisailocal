import { Prisma, PrismaClient } from '@prisma/client';

// Neon の無料プランは、しばらく使わないと DB が休止する。起こすのに数秒かかるため、接続の待ち時間を長めにする
function databaseUrl() {
  const raw = process.env.haisailocal_DATABASE_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '20');
  if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
  return url.toString();
}

/** DB に届かなかった・接続が切れた（＝処理はされていない）エラーだけを、やり直しの対象にする */
function isConnectionError(e: unknown) {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  if (e instanceof Prisma.PrismaClientKnownRequestError) return ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(e.code);
  if (e instanceof Prisma.PrismaClientUnknownRequestError || e instanceof Prisma.PrismaClientRustPanicError) {
    return /closed the connection|connection (terminated|reset|refused)|ECONNRESET|timed out/i.test(e.message);
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createClient() {
  return new PrismaClient({ datasourceUrl: databaseUrl() }).$extends({
    query: {
      // 休止中の DB を起こす間などに一時的につながらなかったときは、少し待って2回までやり直す
      async $allOperations({ args, query }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (e) {
            if (attempt >= 2 || !isConnectionError(e)) throw e;
            console.warn('db connection retry', attempt + 1, String(e).slice(0, 120));
            await sleep(500 * (attempt + 1));
          }
        }
      },
    },
  });
}

// サーバーレス環境で接続を使い回す
const g = globalThis as unknown as { __prisma?: ReturnType<typeof createClient> };
export const prisma = g.__prisma ?? createClient();
g.__prisma = prisma;
