// 画面のエラー対策：ブラウザの自動翻訳で落ちないようにし、起きたエラーはサーバーのログに送る

let sent = 0;

/** 画面で起きたエラーをサーバーのログへ送る（1回の表示につき5件まで。入力内容などは送らない） */
export function reportClientError(error: unknown, where?: string) {
  if (sent >= 5) return;
  sent++;
  const e = error instanceof Error ? error : new Error(String(error));
  const body = JSON.stringify({
    message: `${e.name}: ${e.message}`.slice(0, 500),
    stack: (e.stack ?? '').slice(0, 3000),
    where: `${location.pathname}${where ? ` | ${where}` : ''}`.slice(0, 200),
    ua: navigator.userAgent.slice(0, 300),
  });
  try {
    void fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    /* 送れなくても画面には影響させない */
  }
}

/**
 * Chrome などの自動翻訳は、画面の文字を別の要素に置き換える。
 * そのあと React が元の文字を消したり前に差し込んだりすると「removeChild / insertBefore」のエラーで画面全体が落ちる。
 * 置き換えられた文字の操作は、エラーにせず無視する（よく知られた回避策）
 */
function guardAgainstPageTranslation() {
  if (typeof Node !== 'function' || !Node.prototype) return;
  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };
  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null) as T;
    return insertBefore.call(this, node, ref) as T;
  };
}

export function installClientErrorHandling() {
  guardAgainstPageTranslation();
  window.addEventListener('error', (ev) => {
    // 拡張機能などの、このサイト以外のスクリプトのエラーは送らない
    if (!ev.error && /^Script error\.?$/.test(ev.message)) return;
    reportClientError(ev.error ?? ev.message, 'window.error');
  });
  window.addEventListener('unhandledrejection', (ev) => reportClientError(ev.reason, 'unhandledrejection'));
}
