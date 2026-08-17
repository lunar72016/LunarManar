import { firebaseAuth, firebaseConfigured, isAllowedArtist } from "@/lib/firebase";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type FirebaseAuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  isAllowed: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  const value = useMemo<FirebaseAuthContextValue>(
    () => ({
      user,
      loading,
      configured: firebaseConfigured,
      isAllowed: isAllowedArtist(user?.uid),
      signIn: async (email, password) => {
        if (!firebaseAuth) throw new Error("Firebase 尚未設定完成");
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      },
      signOut: async () => {
        if (firebaseAuth) await firebaseSignOut(firebaseAuth);
      },
    }),
    [loading, user],
  );

  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
}

export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);
  if (!context) throw new Error("useFirebaseAuth 必須在 FirebaseAuthProvider 內使用");
  return context;
}
