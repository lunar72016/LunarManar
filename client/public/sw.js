// 一次性舊版 PWA 遷移器：舊 generateSW 註冊會更新到這個檔案，
// 隨即解除自身註冊並重新載入用戶端，讓新版 firebase-messaging-sw.js 接管。
self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    })(),
  );
});
