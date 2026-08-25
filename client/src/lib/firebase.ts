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

export const firebaseApp = createFirebaseApp();
export const firebaseMessagingConfigured = Boolean(firebaseApp && import.meta.env.VITE_FIREBASE_MESSAGING_VAPID_KEY);

export const firebaseAuth = (() => {
  if (!firebaseApp || !clientWindow) return null;
  if (!clientWindow.__lunarAuth) clientWindow.__lunarAuth = getAuth(firebaseApp);
  return clientWindow.__lunarAuth;
})();

export const firestoreDb = (() => {
  if (!firebaseApp || !clientWindow) return null;
  if (!clientWindow.__lunarFirestore) {
    clientWindow.__lunarFirestore = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return clientWindow.__lunarFirestore;
})();

export function isAllowedArtist(uid: string | null | undefined) {
  return Boolean(uid && allowedArtistUid && uid === allowedArtistUid);
}

export function isSafariBrowser(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  return /safari/i.test(userAgent) && !/chrome|chromium|crios|android/i.test(userAgent);
}

/** 將 Firebase Authentication 常見錯誤轉為可直接處理的繁中提示。 */
export function describeFirebaseAuthError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const codeFromObject = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const code = codeFromObject || rawMessage.match(/auth\/[a-z0-9-]+/i)?.[0]?.toLowerCase() || "";
  if (code === "auth/operation-not-allowed") return "Google 登入尚未啟用。請在 Firebase Authentication 的 Sign-in method 啟用 Google Provider。";
  if (code === "auth/unauthorized-domain") return "此網站網域尚未授權 Google 登入。請在 Firebase Authentication 的 Authorized domains 加入 lunar72016.github.io。";
  if (code === "auth/popup-blocked") return "瀏覽器封鎖了 Google 登入視窗。請允許此網站開啟彈出式視窗後再試。";
  if (code === "auth/popup-closed-by-user") return "Google 登入視窗已關閉，尚未完成登入。";
  if (code === "auth/network-request-failed") return "Google 登入需要網路連線，請確認網路後再試。";
  if (code === "auth/web-storage-unsupported") return "此瀏覽器封鎖了登入所需的網站資料。請允許本站 Cookie／網站資料後重試，或改用一般 Chrome、Safari、Firefox 視窗。";
  if (code === "auth/operation-not-supported-in-this-environment") return "此瀏覽器不支援彈出式 Google 登入，系統將改以完整頁面登入方式開啟。";
  if (code === "auth/redirect-cancelled-by-user") return "Google 登入導向已取消，請重新選擇帳號後再試。";
  if (/cookie|storage|third.?party|tracking|privacy/i.test(rawMessage)) return "此瀏覽器的隱私或追蹤防護封鎖了 Google 登入所需的跨網站資料。請暫時允許此網站的 Cookie／跨網站追蹤後再試。";
  if (/failed to fetch|network|fetch/i.test(rawMessage)) return "瀏覽器或網路擴充功能阻擋了 Google 登入連線。請關閉廣告／隱私封鎖功能後重試，或改用一般瀏覽器視窗。";
  return "此瀏覽器拒絕了 Google 的跨網站登入環境。請關閉此網站的嚴格追蹤防護、允許第三方 Cookie 後重試；若仍失敗，請改用一般 Chrome、Safari 或 Firefox 視窗。";
}

/** 繪師帳密登入的錯誤不可套用 Google／瀏覽器登入提示。 */
export function describeEmailPasswordAuthError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const codeFromObject = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const code = codeFromObject || rawMessage.match(/auth\/[a-z0-9-]+/i)?.[0]?.toLowerCase() || "";
  if (code === "auth/operation-not-allowed") return "Email／Password 尚未啟用。請在 Firebase Authentication → Sign-in method 啟用「Email/Password」。";
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") return "電子郵件或密碼不正確。以 Google 建立的帳號不會自動擁有帳密，請使用 Google 登入，或在 Firebase 建立 Email／Password 帳號。";
  if (code === "auth/invalid-email") return "電子郵件格式不正確。";
  if (code === "auth/too-many-requests") return "嘗試登入次數過多，請稍後再試，或改用 Google 登入。";
  if (code === "auth/network-request-failed") return "帳密登入需要網路連線，請確認網路後再試。";
  return `帳密登入目前無法完成${code ? `（錯誤代碼：${code}）` : ""}。請確認 Firebase Authentication 的 Email/Password 設定。`;
}


/** 公開填單使用匿名帳號建立受限工作階段，錯誤提示不可誤導成 Google 登入問題。 */
export function describeAnonymousAuthError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "auth/operation-not-allowed") return "公開填單需要匿名登入。請通知繪師在 Firebase Authentication 的 Sign-in method 啟用 Anonymous Provider。";
  if (code === "auth/network-request-failed") return "建立公開填單工作階段需要網路連線，請確認網路後再試。";
  return "目前無法建立公開填單工作階段，請稍後再試或通知繪師檢查 Firebase Authentication 設定。";
}
