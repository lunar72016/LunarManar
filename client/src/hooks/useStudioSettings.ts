import { StudioSettings, defaultStudioSettings, normalizeStudioSettings } from "@/lib/studioSettings";
import { firestoreDb } from "@/lib/firebase";
import { User } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

function readableError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("permission-denied")) return "Firestore 拒絕存取。請確認 Firestore Rules 已發布，且登入帳號 UID 與指定繪師 UID 相同。";
  return raw;
}

export function useStudioSettings(user: User | null, isAllowed: boolean) {
  const [settings, setSettings] = useState<StudioSettings>(defaultStudioSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = firestoreDb;
    if (!db || !user || !isAllowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, "artists", user.uid, "settings", "studio"),
      (snapshot) => {
        const normalized = normalizeStudioSettings(snapshot.exists() ? (snapshot.data() as Partial<StudioSettings>) : undefined);
        setSettings(normalized);
        void setDoc(doc(db, "publicStudioSettings", "studio"), { combinationPrices: normalized.combinationPrices, qVariantPrices: normalized.qVariantPrices, rushMultiplierRanges: normalized.rushMultiplierRanges, licenseMultiplierRanges: normalized.licenseMultiplierRanges, updatedAt: normalized.updatedAt }, { merge: true }).catch(() => undefined);
        setLoading(false);
        setError(null);
      },
      (nextError) => {
        setLoading(false);
        setError(readableError(nextError));
      },
    );
  }, [isAllowed, user?.uid]);

  const saveSettings = useCallback(async (next: StudioSettings) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接 Firebase 設定資料庫");
    setSaving(true);
    const normalized = normalizeStudioSettings({ ...next, updatedAt: Date.now() });
    setSettings(normalized);
    try {
      await Promise.all([
        setDoc(doc(db, "artists", user.uid, "settings", "studio"), normalized),
        setDoc(doc(db, "publicStudioSettings", "studio"), { combinationPrices: normalized.combinationPrices, qVariantPrices: normalized.qVariantPrices, rushMultiplierRanges: normalized.rushMultiplierRanges, licenseMultiplierRanges: normalized.licenseMultiplierRanges, updatedAt: normalized.updatedAt }),
      ]);
    } catch (saveError) {
      setError(readableError(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  }, [user?.uid]);

  return useMemo(() => ({ settings, loading, saving, error, saveSettings }), [error, loading, saveSettings, saving, settings]);
}
