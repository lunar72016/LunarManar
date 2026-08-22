import { describeFirebaseAuthError, firebaseAuth, firebaseConfigured, isAllowedArtist } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  User,
  getRedirectResult,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type FirebaseAuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  isAllowed: boolean;
  googleSignInIssue: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithAnonymousAccount: () => Promise<void>;
  signOut: () => Promise<void>;
};

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleSignInIssue, setGoogleSignInIssue] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!firebaseAuth) return;
    void getRedirectResult(firebaseAuth).catch((error) => setGoogleSignInIssue(describeFirebaseAuthError(error)));
  }, []);

  const value = useMemo<FirebaseAuthContextValue>(
    () => ({
      user,
      loading,
      configured: firebaseConfigured,
      isAllowed: isAllowedArtist(user?.uid),
      googleSignInIssue,
      signIn: async (email, password) => {
        if (!firebaseAuth) throw new Error("Firebase 尚未設定完成");
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      },
      signInWithGoogle: async () => {
        if (!firebaseAuth) throw new Error("Firebase 尚未設定完成");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        setGoogleSignInIssue(null);
        try {
          await signInWithPopup(firebaseAuth, provider);
        } catch (error) {
          const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
          if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
            await signInWithRedirect(firebaseAuth, provider);
            return;
          }
          setGoogleSignInIssue(describeFirebaseAuthError(error));
          throw error;
        }
      },
      signInWithAnonymousAccount: async () => {
        if (!firebaseAuth) throw new Error("Firebase 尚未設定完成");
        if (!firebaseAuth.currentUser) await signInAnonymously(firebaseAuth);
      },
      signOut: async () => {
        if (firebaseAuth) await firebaseSignOut(firebaseAuth);
      },
    }),
    [googleSignInIssue, loading, user],
  );

  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
}

export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);
  if (!context) throw new Error("useFirebaseAuth 必須在 FirebaseAuthProvider 內使用");
  return context;
}
