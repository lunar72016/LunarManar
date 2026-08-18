import { StudioSettings, defaultStudioSettings, normalizeStudioSettings } from "@/lib/studioSettings";
import { awaitRequiredPersistence } from "@/lib/avatarPersistence";
import { firebaseStorage, firestoreDb } from "@/lib/firebase";
import { User } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { type UploadTaskSnapshot, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useCallback, useEffect, useMemo, useState } from "react";

function readableError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("permission-denied")) return "Firestore 拒絕存取。請確認 Firestore Rules 已發布，且登入帳號 UID 與指定繪師 UID 相同。";
  if (raw.includes("storage/unauthorized")) return "Firebase Storage 拒絕存取。請先在 Firebase Console 建立 Storage bucket，並發布 storage.rules。";
  if (raw.includes("storage/canceled")) return "頭像上傳已逾時取消。請確認網路與 Firebase Storage bucket 後重試。";
  if (raw.includes("storage/unknown")) return "Firebase Storage 暫時沒有回應。請確認 Storage bucket 已建立，然後再試一次。";
  if (raw.includes("settings-write-timeout")) return "頭像已傳至 Storage，但 20 秒內未能寫入工作室設定。請檢查 Firestore Rules 與網路後重試。";
  return raw;
}

function uploadWithProgress(
  snapshotRef: ReturnType<typeof ref>,
  file: File,
  onProgress: (progress: number) => void,
) {
  const task = uploadBytesResumable(snapshotRef, file, { contentType: file.type });
  return new Promise<UploadTaskSnapshot>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => task.cancel(), 45_000);
    task.on(
      "state_changed",
      (snapshot) => onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      (error) => { window.clearTimeout(timeoutId); reject(error); },
      () => { window.clearTimeout(timeoutId); resolve(task.snapshot); },
    );
  });
}

export function useStudioSettings(user: User | null, isAllowed: boolean) {
  const [settings, setSettings] = useState<StudioSettings>(defaultStudioSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStage, setUploadStage] = useState<"uploading" | "saving" | null>(null);
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
      await awaitRequiredPersistence(setDoc(doc(db, "artists", user.uid, "settings", "studio"), normalized), 20_000, "settings-write-timeout");
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
    setUploadProgress(0);
    setUploadStage("uploading");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const avatarRef = ref(firebaseStorage, `artists/${user.uid}/profile/avatar-${Date.now()}.${extension}`);
      await uploadWithProgress(avatarRef, file, setUploadProgress);
      const avatarUrl = await getDownloadURL(avatarRef);
      const next = { ...settings, avatarUrl, updatedAt: Date.now() };
      setUploadStage("saving");
      await saveSettings(next);
      return avatarUrl;
    } catch (uploadError) {
      setError(readableError(uploadError));
      throw uploadError;
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setUploadStage(null);
    }
  }, [saveSettings, settings, user?.uid]);

  return useMemo(() => ({ settings, loading, saving, uploading, uploadProgress, uploadStage, error, saveSettings, uploadAvatar }), [error, loading, saveSettings, saving, settings, uploadAvatar, uploadProgress, uploadStage, uploading]);
}
