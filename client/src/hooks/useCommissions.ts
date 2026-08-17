import { Commission, CommissionStatus, initialCommissions, withStatusTransition } from "@/lib/commission";
import { firestoreDb } from "@/lib/firebase";
import { User } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

type SyncState = "loading" | "synced" | "offline" | "pending" | "error";

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

  useEffect(() => {
    const db = firestoreDb;
    if (!db || !user || !isAllowed) {
      setCommissions([]);
      setSyncState("error");
      return;
    }
    setSyncState("loading");
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
        setError(nextError.message);
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
      await setDoc(reference, next);
      return next;
    },
    [user?.uid],
  );

  const updateCommission = useCallback(
    async (id: string, changes: Partial<Commission>) => {
      const db = firestoreDb;
      if (!db || !user) throw new Error("目前無法連接資料庫");
      await updateDoc(doc(db, "artists", user.uid, "commissions", id), {
        ...changes,
        updatedAt: Date.now(),
      });
    },
    [user?.uid],
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
    await batch.commit();
  }, [user?.uid]);

  return useMemo(
    () => ({ commissions, syncState, error, createCommission, updateCommission, changeStatus, importInitialRecords }),
    [changeStatus, commissions, createCommission, error, importInitialRecords, syncState, updateCommission],
  );
}
