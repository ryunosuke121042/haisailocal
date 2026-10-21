// デプロイで画面のファイル名が変わると、開いたままの古い画面からは分割したファイル（地図・事業者画面など）を読めなくなる。
// そのときは1回だけ自動で読み込み直して、新しい版で開き直す（1分以内に繰り返さない）
import { lazy, type ComponentType } from 'react';

const KEY = 'hl.chunkReload';

export function reloadOnceForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* 保存できなくても読み込み直す */
  }
  location.reload();
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((e) => {
      // 読み込み直している間は何も描かない
      if (reloadOnceForNewVersion()) return new Promise<{ default: T }>(() => {});
      throw e;
    }),
  );
}
