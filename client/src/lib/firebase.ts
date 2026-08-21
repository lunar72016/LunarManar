import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
export const allowedArtistUid = import.meta.env.VITE_FIREBASE_ALLOWED_UID ?? "";

type FirebaseWindow = Window & {
  __lunarFirebaseApp?: FirebaseApp;
  __lunarFirestore?: Firestore;
  __lunarAuth?: Auth;
};

const clientWindow = typeof window === "undefined" ? undefined : (window as FirebaseWindow);

function createFirebaseApp() {
  if (!firebaseConfigured || !clientWindow) return null;
  if (clientWindow.__lunarFirebaseApp) return clientWindow.__lunarFirebaseApp;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  clientWindow.__lunarFirebaseApp = app;
  return app;
}

const app = createFirebaseApp();

export const firebaseAuth = (() => {
  if (!app || !clientWindow) return null;
  if (!clientWindow.__lunarAuth) clientWindow.__lunarAuth = getAuth(app);
  return clientWindow.__lunarAuth;
})();

export const firestoreDb = (() => {
  if (!app || !clientWindow) return null;
  if (!clientWindow.__lunarFirestore) {
    clientWindow.__lunarFirestore = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return clientWindow.__lunarFirestore;
})();

export function isAllowedArtist(uid: string | null | undefined) {
  return Boolean(uid && allowedArtistUid && uid === allowedArtistUid);
}

/** 將 Firebase Authentication 常見錯誤轉為可直接處理的繁中提示。 */
export function describeFirebaseAuthError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "auth/operation-not-allowed") return "Google 登入尚未啟用。請在 Firebase Authentication 的 Sign-in method 啟用 Google Provider。";
  if (code === "auth/unauthorized-domain") return "此網站網域尚未授權 Google 登入。請在 Firebase Authentication 的 Authorized domains 加入 lunar72016.github.io。";
  if (code === "auth/popup-blocked") return "瀏覽器封鎖了 Google 登入視窗。請允許此網站開啟彈出式視窗後再試。";
  if (code === "auth/popup-closed-by-user") return "Google 登入視窗已關閉，尚未完成登入。";
  if (code === "auth/network-request-failed") return "Google 登入需要網路連線，請確認網路後再試。";
  return "Google 登入目前無法使用，請確認 Firebase Authentication 的 Google Provider 與授權網域設定。";
}
