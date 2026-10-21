import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { reloadOnceForNewVersion } from './lib/lazyReload';
import { installClientErrorHandling } from './lib/clientErrors';

installClientErrorHandling();

// 分割したファイルの先読みに失敗したとき（デプロイ後の古い画面）も、1回だけ読み込み直す
window.addEventListener('vite:preloadError', (e) => {
  if (reloadOnceForNewVersion()) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
