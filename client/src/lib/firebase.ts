import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
export const allowedArtistUid = import.meta.env.VITE_FIREBASE_ALLOWED_UID ?? "";

type FirebaseWindow = Window & {
  __lunarFirebaseApp?: FirebaseApp;
  __lunarFirestore?: Firestore;
  __lunarAuth?: Auth;
  __lunarStorage?: FirebaseStorage;
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

export const firebaseStorage = (() => {
  if (!app || !clientWindow) return null;
  if (!clientWindow.__lunarStorage) clientWindow.__lunarStorage = getStorage(app);
  return clientWindow.__lunarStorage;
})();

export function isAllowedArtist(uid: string | null | undefined) {
  return Boolean(uid && allowedArtistUid && uid === allowedArtistUid);
}
