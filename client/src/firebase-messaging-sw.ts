/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
const messaging = getMessaging(app);
const intakeUrl = new URL(`${import.meta.env.BASE_URL}?view=intake`, self.location.origin).toString();

onBackgroundMessage(messaging, (payload) => {
  const pendingCount = Number(payload.data?.pendingIntakeCount ?? 0);
  const badgeNavigator = self.navigator as Navigator & { setAppBadge?: (contents?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (pendingCount > 0) void badgeNavigator.setAppBadge?.(pendingCount);
  else void badgeNavigator.clearAppBadge?.();
  if (payload.data?.type !== "new-intake") return;
  void self.registration.showNotification("繪月錄", {
    body: "有新的墨諾函箋待啟讀",
    icon: `${import.meta.env.BASE_URL}hui-yue-title.svg`,
    badge: `${import.meta.env.BASE_URL}hui-yue-title.svg`,
    tag: "hui-yue-new-intake",
    data: { url: intakeUrl },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? intakeUrl;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
