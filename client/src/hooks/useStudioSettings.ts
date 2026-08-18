import { StudioSettings, defaultStudioSettings, normalizeStudioSettings } from "@/lib/studioSettings";
import { firebaseStorage, firestoreDb } from "@/lib/firebase";
import { User } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useCallback, useEffect, useMemo, useState } from "react";

function readableError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("permission-denied") || raw.includes("storage/unauthorized")) return "Firebase 拒絕存取。請確認 Firestore 與 Storage 的安全規則已發布。";
  return raw;
}

export function useStudioSettings(user: User | null, isAllowed: boolean) {
  const [settings, setSettings] = useState<StudioSettings>(defaultStudioSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
        setSettings(normalizeStudioSettings(snapshot.exists() ? (snapshot.data() as Partial<StudioSettings>) : undefined));
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
      await setDoc(doc(db, "artists", user.uid, "settings", "studio"), normalized);
    } catch (saveError) {
      setError(readableError(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  }, [user?.uid]);

  const uploadAvatar = useCallback(async (file: File) => {
    if (!user || !firebaseStorage) throw new Error("目前無法連接 Firebase Storage");
    if (!file.type.startsWith("image/")) throw new Error("請選擇圖片檔案。");
    if (file.size > 5 * 1024 * 1024) throw new Error("頭像檔案不可超過 5MB。");
    setUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const avatarRef = ref(firebaseStorage, `artists/${user.uid}/profile/avatar-${Date.now()}.${extension}`);
      await uploadBytes(avatarRef, file, { contentType: file.type });
      const avatarUrl = await getDownloadURL(avatarRef);
      const next = { ...settings, avatarUrl, updatedAt: Date.now() };
      await saveSettings(next);
      return avatarUrl;
    } catch (uploadError) {
      setError(readableError(uploadError));
      throw uploadError;
    } finally {
      setUploading(false);
    }
  }, [saveSettings, settings, user?.uid]);

  return useMemo(() => ({ settings, loading, saving, uploading, error, saveSettings, uploadAvatar }), [error, loading, saveSettings, saving, settings, uploadAvatar, uploading]);
}
