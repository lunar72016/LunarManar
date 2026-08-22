import { ClientAccessMode, ClientProgress, ClientSubmission, buildClientProgress, createPortalAccessCode, getActiveCodeProgress, hydrateClientSubmission, isVerifiedCodeProgress } from "@/lib/clientPortal";
import { Commission, createBlankCommission } from "@/lib/commission";
import { firestoreDb } from "@/lib/firebase";
import { User } from "firebase/auth";
import { collection, deleteDoc, doc, getDocFromServer, getDocs, limit, onSnapshot, query, setDoc, updateDoc, waitForPendingWrites, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

export function commissionFromClientSubmission(submission: ClientSubmission): Commission {
  const draft = createBlankCommission();
  return {
    ...draft,
    clientName: submission.clientName,
    contactChannel: submission.contactChannel || "其他",
    contactHandle: submission.contactHandle || submission.contactEmail,
    characterSettingNote: submission.characterSettingNote,
    poseNote: submission.poseNote,
    costumeDesignNote: submission.costumeDesignNote,
    accessoryNote: submission.accessoryNote,
    requirements: [submission.requirements, submission.deliveryNote && `期限／補充：${submission.deliveryNote}`, submission.referenceUrls.length ? `設定稿／參考網址：\n${submission.referenceUrls.join("\n")}` : ""].filter(Boolean).join("\n\n"),
    sourceNote: `委託人公開填單 · ${submission.id}`,
  };
}

export function useClientIntake(user: User | null, isAllowed: boolean) {
  const [submissions, setSubmissions] = useState<ClientSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = firestoreDb;
    if (!db || !user || !isAllowed) { setSubmissions([]); setLoading(false); return; }
    setLoading(true);
    const source = query(collection(db, "clientSubmissions"), where("ownerUid", "==", user.uid));
    return onSnapshot(source, (snapshot) => {
      setSubmissions(snapshot.docs.map((item) => hydrateClientSubmission(item.id, item.data() as ClientSubmission)).sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (nextError) => {
      setError(nextError.message.includes("permission-denied") ? "尚未發布委託人入口的 Firestore 規則。" : nextError.message);
      setLoading(false);
    });
  }, [isAllowed, user?.uid]);

  const publishProgress = useCallback(async (commission: Commission, submission: ClientSubmission) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    const access = submission.accessMode === "code"
      ? { id: submission.accessCode!, accessMode: "code" as const, clientUid: null, accessCode: submission.accessCode, ownerUid: user.uid }
      : { id: commission.id, accessMode: "google" as const, clientUid: submission.clientUid, accessCode: null, ownerUid: user.uid };
    const progress = buildClientProgress(commission, access);
    await setDoc(doc(db, "clientProgress", progress.id), progress);
    if (!submission.id) throw new Error("委託函缺少文件識別碼，請重新整理後再受理。");
    await updateDoc(doc(db, "clientSubmissions", submission.id), { state: "accepted", updatedAt: Date.now(), commissionId: commission.id });
    return progress;
  }, [user?.uid]);

  const discardSubmission = useCallback(async (submissionId: string) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    if (!submissionId) throw new Error("委託函缺少文件識別碼，請重新整理後再刪除。");
    const removed = submissions.find((item) => item.id === submissionId);
    setSubmissions((current) => current.filter((item) => item.id !== submissionId));
    try {
      await deleteDoc(doc(db, "clientSubmissions", submissionId));
      return await Promise.race([
        waitForPendingWrites(db).then(() => "confirmed" as const),
        new Promise<"offline">((resolve) => window.setTimeout(() => resolve("offline"), 3500)),
      ]);
    } catch (error) {
      if (removed) setSubmissions((current) => current.some((item) => item.id === removed.id) ? current : [...current, removed].sort((a, b) => b.createdAt - a.createdAt));
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("permission-denied") || message.includes("insufficient permissions")) throw new Error("Firebase 未允許繪師刪除委託函。請在 Firebase Console 發布最新版 firestore.rules 後再試。");
      throw error;
    }
  }, [submissions, user?.uid]);

  const revokeProgress = useCallback(async (progress: ClientProgress) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    await updateDoc(doc(db, "clientProgress", progress.id), { revokedAt: Date.now(), updatedAt: Date.now() });
  }, [user?.uid]);

  const getOrCreateCodeProgress = useCallback(async (commission: Commission) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    const existingSnapshot = await getDocs(query(collection(db, "clientProgress"), where("commissionId", "==", commission.id)));
    const existing = getActiveCodeProgress(existingSnapshot.docs.map((item) => ({ ...item.data(), id: item.id } as ClientProgress)), commission.id);
    if (existing) return existing;
    const accessCode = createPortalAccessCode();
    const progress = buildClientProgress(commission, { id: accessCode, accessMode: "code", clientUid: null, accessCode, ownerUid: user.uid });
    await setDoc(doc(db, "clientProgress", progress.id), progress);
    const confirmed = await getDocFromServer(doc(db, "clientProgress", progress.id));
    const confirmedProgress = confirmed.exists() ? { ...confirmed.data(), id: confirmed.id } as ClientProgress : null;
    if (!confirmedProgress || !isVerifiedCodeProgress(confirmedProgress, accessCode)) throw new Error("驗證碼進度文件未能完成伺服器同步。請確認 Firestore 規則已發布並重新建立入口。");
    return confirmedProgress;
  }, [user?.uid]);

  const publishExistingProgress = useCallback(async (commission: Commission, input: { accessMode: ClientAccessMode; clientEmail?: string; accessCode?: string }) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    let access: Pick<ClientProgress, "id" | "accessMode" | "clientUid" | "accessCode" | "ownerUid">;
    if (input.accessMode === "google") {
      const email = input.clientEmail?.trim().toLowerCase();
      if (!email) throw new Error("請輸入委託人已使用 Google 登入的電子郵件。");
      const profiles = await getDocs(query(collection(db, "clientProfiles"), where("email", "==", email), limit(1)));
      const profile = profiles.docs[0]?.data() as { uid?: string } | undefined;
      if (!profile?.uid) throw new Error("尚未找到此 Google 帳號。請委託人先在公開入口使用 Google 帳號登入一次。");
      access = { id: commission.id, accessMode: "google", clientUid: profile.uid, accessCode: null, ownerUid: user.uid };
    } else {
      return getOrCreateCodeProgress(commission);
    }
    const progress = buildClientProgress(commission, access);
    await setDoc(doc(db, "clientProgress", progress.id), progress);
    return progress;
  }, [getOrCreateCodeProgress, user?.uid]);

  const revokeCommissionProgress = useCallback(async (commissionId: string) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    const matches = await getDocs(query(collection(db, "clientProgress"), where("commissionId", "==", commissionId)));
    await Promise.all(matches.docs.map((item) => updateDoc(item.ref, { revokedAt: Date.now(), updatedAt: Date.now() })));
  }, [user?.uid]);

  const removeCommissionPortalRecords = useCallback(async (commissionId: string) => {
    const db = firestoreDb;
    if (!db || !user || !commissionId) return;
    const [submissionMatches, progressMatches] = await Promise.all([
      getDocs(query(collection(db, "clientSubmissions"), where("commissionId", "==", commissionId))),
      getDocs(query(collection(db, "clientProgress"), where("commissionId", "==", commissionId))),
    ]);
    await Promise.all([...submissionMatches.docs, ...progressMatches.docs].map((item) => deleteDoc(item.ref)));
  }, [user?.uid]);

  const syncProgress = useCallback(async (commission: Commission) => {
    const db = firestoreDb;
    if (!db || !user) return;
    const snapshot = await getDocs(query(collection(db, "clientProgress"), where("commissionId", "==", commission.id)));
    await Promise.all(snapshot.docs.map((item) => {
      const current = item.data() as ClientProgress;
      return setDoc(item.ref, buildClientProgress(commission, current), { merge: true });
    }));
  }, [user?.uid]);

  return useMemo(() => ({ submissions, loading, error, publishProgress, discardSubmission, revokeProgress, publishExistingProgress, getOrCreateCodeProgress, revokeCommissionProgress, removeCommissionPortalRecords, syncProgress }), [discardSubmission, error, getOrCreateCodeProgress, loading, publishExistingProgress, publishProgress, removeCommissionPortalRecords, revokeCommissionProgress, revokeProgress, submissions, syncProgress]);
}
