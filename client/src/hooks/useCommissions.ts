import { Commission, CommissionStatus, getQueuePositionShifts, initialCommissions, withStatusTransition } from "@/lib/commission";
import { firestoreDb } from "@/lib/firebase";
import { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

type SyncState = "loading" | "connecting" | "synced" | "offline" | "pending" | "error";

function getFirestoreErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  if (rawMessage.includes("permission-denied")) {
    return "Firestore 拒絕存取。請在 Firebase Console 建立資料庫，並將專案內的 firestore.rules 發布到 Rules 分頁。";
  }
  if (rawMessage.includes("unavailable") || rawMessage.includes("network")) {
    return "目前無法連線至 Firestore；變更會先留在本機快取，恢復連線後會自動同步。";
  }
  return rawMessage;
}

function orderCommissions(items: Commission[]) {
  return [...items].sort((a, b) => {
    const monthCompare = (a.queueMonth || "9999-99").localeCompare(b.queueMonth || "9999-99");
    if (monthCompare !== 0) return monthCompare;
    return a.queuePosition - b.queuePosition || a.createdAt - b.createdAt;
  });
}

export function useCommissions(user: User | null, isAllowed: boolean) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [error, setError] = useState<string | null>(null);

  const reportWriteFailure = useCallback((writeError: unknown) => {
    setError(getFirestoreErrorMessage(writeError));
    setSyncState("error");
  }, []);

  useEffect(() => {
    const db = firestoreDb;
    if (!db || !user || !isAllowed) {
      setCommissions([]);
      setSyncState("error");
      return;
    }
    setError(null);
    setSyncState("connecting");
    const commissionCollection = collection(db, "artists", user.uid, "commissions");
    return onSnapshot(
      commissionCollection,
      { includeMetadataChanges: true },
      (snapshot) => {
        const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Commission);
        setCommissions(orderCommissions(items));
        setError(null);
        setSyncState(snapshot.metadata.hasPendingWrites ? "pending" : snapshot.metadata.fromCache ? "offline" : "synced");
      },
      (nextError) => {
        setError(getFirestoreErrorMessage(nextError));
        setSyncState("error");
      },
    );
  }, [isAllowed, user?.uid]);

  const createCommission = useCallback(
    async (commission: Commission) => {
      const db = firestoreDb;
      if (!db || !user) throw new Error("目前無法連接資料庫");
      const reference = doc(collection(db, "artists", user.uid, "commissions"));
      const next = { ...commission, id: reference.id, updatedAt: Date.now() };
      setSyncState("pending");
      void setDoc(reference, next).catch(reportWriteFailure);
      return next;
    },
    [reportWriteFailure, user?.uid],
  );

  const saveQueuedCommission = useCallback(
    async (commission: Commission, isNew: boolean) => {
      const db = firestoreDb;
      if (!db || !user) throw new Error("目前無法連接資料庫");
      const commissionCollection = collection(db, "artists", user.uid, "commissions");
      const reference = isNew ? doc(commissionCollection) : doc(db, "artists", user.uid, "commissions", commission.id);
      const occupied = commissions.filter((item) => item.id !== commission.id && item.queueMonth === commission.queueMonth);
      const nextPosition = commission.queuePosition > 0 ? commission.queuePosition : Math.max(0, ...occupied.map((item) => item.queuePosition)) + 1;
      const next = { ...commission, id: reference.id, queuePosition: nextPosition, updatedAt: Date.now() };
      const previous = commissions.find((item) => item.id === commission.id);
      const placementChanged = isNew || previous?.queueMonth !== next.queueMonth || previous?.queuePosition !== nextPosition;
      const shifts = placementChanged ? getQueuePositionShifts(commissions, next.queueMonth, nextPosition, isNew ? undefined : commission.id) : [];
      const batch = writeBatch(db);
      shifts.forEach((shift) => batch.update(doc(db, "artists", user.uid, "commissions", shift.id), { queuePosition: shift.queuePosition, updatedAt: Date.now() }));
      batch.set(reference, next);
      setSyncState("pending");
      void batch.commit().catch(reportWriteFailure);
      return next;
    },
    [commissions, reportWriteFailure, user?.uid],
  );

  const updateCommission = useCallback(
    async (id: string, changes: Partial<Commission>) => {
      const db = firestoreDb;
      if (!db || !user) throw new Error("目前無法連接資料庫");
      setSyncState("pending");
      void updateDoc(doc(db, "artists", user.uid, "commissions", id), {
        ...changes,
        updatedAt: Date.now(),
      }).catch(reportWriteFailure);
    },
    [reportWriteFailure, user?.uid],
  );

  const deleteCommission = useCallback(
    async (id: string) => {
      const db = firestoreDb;
      if (!db || !user) throw new Error("目前無法連接資料庫");
      setSyncState("pending");
      void deleteDoc(doc(db, "artists", user.uid, "commissions", id)).catch(reportWriteFailure);
    },
    [reportWriteFailure, user?.uid],
  );

  const changeStatus = useCallback(
    async (commission: Commission, nextStatus: CommissionStatus, note?: string) => {
      const transitioned = withStatusTransition(commission, nextStatus, note);
      await updateCommission(commission.id, transitioned);
    },
    [updateCommission],
  );

  const importInitialRecords = useCallback(async () => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    const batch = writeBatch(db);
    initialCommissions.forEach((item) => {
      const reference = doc(collection(db, "artists", user.uid, "commissions"));
      batch.set(reference, { ...item, id: reference.id, updatedAt: Date.now() });
    });
    setSyncState("pending");
    void batch.commit().catch(reportWriteFailure);
  }, [reportWriteFailure, user?.uid]);

  return useMemo(
    () => ({ commissions, syncState, error, createCommission, saveQueuedCommission, updateCommission, deleteCommission, changeStatus, importInitialRecords }),
    [changeStatus, commissions, createCommission, deleteCommission, error, importInitialRecords, saveQueuedCommission, syncState, updateCommission],
  );
}
