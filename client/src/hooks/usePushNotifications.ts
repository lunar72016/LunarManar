import { firebaseApp, firebaseMessagingConfigured, firestoreDb } from "@/lib/firebase";
import { getWorkspaceIntakeUrl } from "@/lib/pushNotifications";
import { User } from "firebase/auth";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { useCallback, useEffect, useState } from "react";

type PushState = "checking" | "ready" | "enabled" | "unsupported" | "needs-vapid" | "denied" | "error";
const deviceStorageKey = (uid: string) => `hui-yue-push-device:${uid}`;

async function createDeviceId(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).slice(0, 16).map((item) => item.toString(16).padStart(2, "0")).join("");
}

export function usePushNotifications(user: User | null) {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user || !firebaseApp || !firestoreDb || !firebaseMessagingConfigured) {
      setState(firebaseMessagingConfigured ? "unsupported" : "needs-vapid");
      return;
    }
    void isSupported().then((supported) => {
      if (!active) return;
      if (!supported || !("Notification" in window) || !("serviceWorker" in navigator)) setState("unsupported");
      else if (Notification.permission === "denied") setState("denied");
      else setState(localStorage.getItem(deviceStorageKey(user.uid)) ? "enabled" : "ready");
    }).catch(() => active && setState("unsupported"));
    return () => { active = false; };
  }, [user?.uid]);

  useEffect(() => {
    if (!firebaseApp || (state !== "ready" && state !== "enabled")) return;
    return onMessage(getMessaging(firebaseApp), () => {
      // 前景中的工作台由 Firestore 即時更新待啟數量；背景訊息則由 service worker 顯示。
      window.dispatchEvent(new CustomEvent("hui-yue-push-received"));
    });
  }, [state]);

  const enable = useCallback(async () => {
    if (!user || !firebaseApp || !firestoreDb) throw new Error("目前無法連接 Firebase 推播服務。");
    if (!firebaseMessagingConfigured) throw new Error("尚未設定 Firebase Messaging 的網頁憑證。");
    setBusy(true); setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState("denied"); throw new Error("尚未允許瀏覽器通知。可在瀏覽器或手機設定中重新開啟。"); }
      const registration = await navigator.serviceWorker.ready;
      const token = await getToken(getMessaging(firebaseApp), { vapidKey: import.meta.env.VITE_FIREBASE_MESSAGING_VAPID_KEY, serviceWorkerRegistration: registration });
      if (!token) throw new Error("裝置尚未取得推播識別碼，請重新嘗試或確認已使用 HTTPS 開啟繪月錄。");
      const deviceId = await createDeviceId(token);
      await setDoc(doc(firestoreDb, "artists", user.uid, "notificationDevices", deviceId), {
        token,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        platform: navigator.userAgent.slice(0, 180),
      }, { merge: true });
      localStorage.setItem(deviceStorageKey(user.uid), deviceId);
      setState("enabled");
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "開啟裝置通知失敗。";
      setError(message);
      if (state !== "denied") setState("error");
      throw nextError;
    } finally { setBusy(false); }
  }, [state, user?.uid]);

  const disable = useCallback(async () => {
    if (!user || !firebaseApp || !firestoreDb) return;
    setBusy(true); setError(null);
    try {
      const deviceId = localStorage.getItem(deviceStorageKey(user.uid));
      await deleteToken(getMessaging(firebaseApp)).catch(() => false);
      if (deviceId) await deleteDoc(doc(firestoreDb, "artists", user.uid, "notificationDevices", deviceId));
      localStorage.removeItem(deviceStorageKey(user.uid));
      setState("ready");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "關閉裝置通知失敗。");
      throw nextError;
    } finally { setBusy(false); }
  }, [user?.uid]);

  return { state, busy, error, enable, disable, intakeUrl: getWorkspaceIntakeUrl(window.location.origin, import.meta.env.BASE_URL) };
}
