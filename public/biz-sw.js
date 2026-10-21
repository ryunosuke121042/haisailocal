// 事業者アプリのサービスワーカー：プッシュ通知を受けて表示する
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'お知らせ', body: '', url: '/biz' };
  try {
    data = { ...data, ...event.data.json() };
  } catch (_) {
    /* 文字だけの通知 */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url },
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // 当日予約・空き状況の確認依頼は、確認されるまで消さない（通知音は端末の設定に従う）
      requireInteraction: !!data.urgent,
      // renotify は tag がないと表示に失敗するため、tag があるときだけ
      renotify: !!data.urgent && !!data.tag,
      silent: false,
      vibrate: data.urgent ? [300, 100, 300, 100, 300] : [200],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/biz';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('/biz') && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
