import { ClientAccessMode, ClientProgress, ClientSubmission, buildClientProgress, createPortalAccessCode, hydrateClientSubmission } from "@/lib/clientPortal";
import { Commission, createBlankCommission } from "@/lib/commission";
import { firestoreDb } from "@/lib/firebase";
import { User } from "firebase/auth";
import { collection, doc, getDocs, limit, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
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

  const revokeProgress = useCallback(async (progress: ClientProgress) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    await updateDoc(doc(db, "clientProgress", progress.id), { revokedAt: Date.now(), updatedAt: Date.now() });
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
      const accessCode = input.accessCode ?? createPortalAccessCode();
      access = { id: accessCode, accessMode: "code", clientUid: null, accessCode, ownerUid: user.uid };
    }
    const progress = buildClientProgress(commission, access);
    await setDoc(doc(db, "clientProgress", progress.id), progress);
    return progress;
  }, [user?.uid]);

  const revokeCommissionProgress = useCallback(async (commissionId: string) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    const matches = await getDocs(query(collection(db, "clientProgress"), where("commissionId", "==", commissionId)));
    await Promise.all(matches.docs.map((item) => updateDoc(item.ref, { revokedAt: Date.now(), updatedAt: Date.now() })));
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

  return useMemo(() => ({ submissions, loading, error, publishProgress, revokeProgress, publishExistingProgress, revokeCommissionProgress, syncProgress }), [error, loading, publishExistingProgress, publishProgress, revokeCommissionProgress, revokeProgress, submissions, syncProgress]);
}
