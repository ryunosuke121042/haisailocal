import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 開発中は /api/* を Vercel Functions と同じサーバーコードで処理する（vercel dev なしで動かすため）
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          if (req.url.startsWith('/api/cron')) {
            const mod = await server.ssrLoadModule('/api/cron.ts');
            return mod.default(req, res);
          }
          const mod = await server.ssrLoadModule('/server/app.ts');
          await mod.default(req, res);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // .env.local（Vercel Dashboard から取得）をサーバー側の process.env に読み込む
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), devApi()],
    // WSL・OneDrive 上のフォルダでは変更通知が届かないことがあるため、ポーリングで監視する
    server: { host: true, port: 5173, watch: { usePolling: true, interval: 300 } },
    // 本番ビルドの確認用。/api は別に起動した開発サーバー（npm run dev）に転送する
    preview: { host: true, port: 4173, proxy: { '/api': 'http://localhost:5173' } },
    test: { include: ['tests/**/*.test.ts'] },
  };
});
