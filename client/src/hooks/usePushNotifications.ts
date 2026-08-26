import { firebaseApp, firebaseMessagingConfigured, firestoreDb } from "@/lib/firebase";
import { getForegroundIntakeMessage, type ForegroundIntakeMessage } from "@/lib/foregroundPush";
import { syncPwaBadge } from "@/lib/pwaBadge";
import { getWorkspaceIntakeUrl } from "@/lib/pushNotifications";
import { User } from "firebase/auth";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { useCallback, useEffect, useState } from "react";

export type PushState = "checking" | "ready" | "enabled" | "unsupported" | "needs-vapid" | "denied" | "error";
export type PushNotificationsController = {
  state: PushState;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  intakeUrl: string;
};
const deviceStorageKey = (uid: string) => `hui-yue-push-device:${uid}`;

async function createDeviceId(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).slice(0, 16).map((item) => item.toString(16).padStart(2, "0")).join("");
}

function showForegroundNotification(message: ForegroundIntakeMessage, intakeUrl: string) {
  if (message.type !== "new-intake" || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(message.title, {
      body: message.body,
      icon: `${import.meta.env.BASE_URL}hui-yue-title.svg`,
      tag: "hui-yue-new-intake",
    });
    notification.onclick = () => {
      window.focus();
      window.location.assign(intakeUrl);
      notification.close();
    };
  } catch {
    // 部分行動瀏覽器不允許頁面直接顯示 Notification，仍以工作台 toast 告知。
  }
}

export function usePushNotifications(user: User | null, options?: { onForegroundIntake?: (message: ForegroundIntakeMessage) => void }): PushNotificationsController {
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
    if (!firebaseApp || state !== "enabled") return;
    const intakeUrl = getWorkspaceIntakeUrl(window.location.origin, import.meta.env.BASE_URL);
    return onMessage(getMessaging(firebaseApp), (payload) => {
      const message = getForegroundIntakeMessage(payload);
      if (!message) return;
      void syncPwaBadge(navigator, message.pendingCount);
      showForegroundNotification(message, intakeUrl);
      if (message.type === "new-intake") options?.onForegroundIntake?.(message);
      window.dispatchEvent(new CustomEvent("hui-yue-push-received", { detail: message }));
    });
  }, [options?.onForegroundIntake, state]);

  useEffect(() => {
    if (!user || !firebaseApp || !firestoreDb || state !== "enabled" || Notification.permission !== "granted") return;
    let active = true;
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const token = await getToken(getMessaging(firebaseApp), { vapidKey: import.meta.env.VITE_FIREBASE_MESSAGING_VAPID_KEY, serviceWorkerRegistration: registration });
        if (!token) throw new Error("裝置推播識別碼已失效。");
        const deviceId = await createDeviceId(token);
        if (!active) return;
        const previousDeviceId = localStorage.getItem(deviceStorageKey(user.uid));
        await setDoc(doc(firestoreDb, "artists", user.uid, "notificationDevices", deviceId), {
          token,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          platform: navigator.userAgent.slice(0, 180),
        }, { merge: true });
        if (previousDeviceId && previousDeviceId !== deviceId) await deleteDoc(doc(firestoreDb, "artists", user.uid, "notificationDevices", previousDeviceId)).catch(() => undefined);
        localStorage.setItem(deviceStorageKey(user.uid), deviceId);
      } catch {
        if (!active) return;
        localStorage.removeItem(deviceStorageKey(user.uid));
        setState("ready");
        setError("裝置推播識別碼已更新，請重新開啟這台裝置通知。");
      }
    })();
    return () => { active = false; };
  }, [state, user?.uid]);

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
