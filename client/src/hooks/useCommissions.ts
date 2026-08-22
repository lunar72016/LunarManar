import { Commission, CommissionStatus, archiveCommission as archiveCommissionRecord, getCommissionScheduleWeek, getLastQueuedWeek, getScheduleMonthFromWeek, initialCommissions, restoreArchivedCommission, shouldConvertReservation, sortCommissionsForSchedule, withStatusTransition } from "@/lib/commission";
import { persistFirestoreWrite, persistOptimisticWrite, prepareCommissionSave, stripUndefined } from "@/lib/commissionPersistence";
import { firestoreDb } from "@/lib/firebase";
import { User } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SyncState = "loading" | "connecting" | "synced" | "offline" | "pending" | "error";

function getFirestoreErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  if (rawMessage.includes("permission-denied")) return "Firestore 拒絕存取。請在 Firebase Console 建立資料庫，並將專案內的 firestore.rules 發布到 Rules 分頁。";
  if (rawMessage.includes("unavailable") || rawMessage.includes("network")) return "目前無法連線至 Firestore；變更會先留在本機快取，恢復連線後會自動同步。";
  return rawMessage;
}

function normalizeCommission(item: Commission): Commission {
  const scheduleWeekStart = getCommissionScheduleWeek(item);
  return {
    ...item,
    scheduleWeekStart,
    scheduleType: item.scheduleType ?? "queued",
    queueMonth: getScheduleMonthFromWeek(scheduleWeekStart, item.queueMonth),
    queueMonthManual: false,
    estimatedWorkdays: item.estimatedWorkdays ?? null,
    rushRequestedAt: item.rushRequestedAt ?? null,
    additionalState: item.additionalState ?? (item.additionalAmount && item.additionalAmount !== 0 ? "unpaid" : "unrecorded"),
    additionalPaidAt: item.additionalPaidAt ?? null,
    rawBasePrice: item.rawBasePrice ?? null,
    archivedAt: item.archivedAt ?? null,
    archivedFromStatus: item.archivedFromStatus ?? null,
  };
}

function orderCommissions(items: Commission[]) {
  return sortCommissionsForSchedule(items);
}

export function useCommissions(user: User | null, isAllowed: boolean) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [error, setError] = useState<string | null>(null);
  const latestConversionSignature = useRef("");

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
    return onSnapshot(commissionCollection, { includeMetadataChanges: true }, (snapshot) => {
      const items = snapshot.docs.map((item) => normalizeCommission({ id: item.id, ...item.data() } as Commission));
      const lastQueuedWeek = getLastQueuedWeek(items);
      const promotions = items.filter((item) => shouldConvertReservation(item, lastQueuedWeek));
      const signature = promotions.map((item) => item.id).sort().join(",");
      if (promotions.length && signature !== latestConversionSignature.current) {
        latestConversionSignature.current = signature;
        const batch = writeBatch(db);
        promotions.forEach((item) => batch.update(doc(db, "artists", user.uid, "commissions", item.id), { scheduleType: "queued", updatedAt: Date.now() }));
        void batch.commit().catch(reportWriteFailure);
      }
      if (!promotions.length) latestConversionSignature.current = "";
      setCommissions(orderCommissions(items.map((item) => promotions.some((promotion) => promotion.id === item.id) ? { ...item, scheduleType: "queued" } : item)));
      setError(null);
      setSyncState(snapshot.metadata.hasPendingWrites ? "pending" : snapshot.metadata.fromCache ? "offline" : "synced");
    }, (nextError) => {
      setError(getFirestoreErrorMessage(nextError));
      setSyncState("error");
    });
  }, [isAllowed, reportWriteFailure, user?.uid]);

  const createCommission = useCallback(async (commission: Commission) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    const reference = doc(collection(db, "artists", user.uid, "commissions"));
    const next = { ...normalizeCommission(commission), id: reference.id, updatedAt: Date.now() };
    setCommissions((current) => orderCommissions([...current, next]));
    setSyncState("pending");
    await persistFirestoreWrite(setDoc(reference, stripUndefined(next)), reportWriteFailure);
    return next;
  }, [reportWriteFailure, user?.uid]);

  const saveQueuedCommission = useCallback(async (commission: Commission, isNew: boolean) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    const commissionCollection = collection(db, "artists", user.uid, "commissions");
    const reference = isNew ? doc(commissionCollection) : doc(db, "artists", user.uid, "commissions", commission.id);
    const next = prepareCommissionSave(normalizeCommission(commission), commissions, reference.id);
    const previous = commissions;
    setCommissions((current) => orderCommissions([...current.filter((item) => item.id !== next.id), next]));
    setSyncState("pending");
    await persistOptimisticWrite(setDoc(reference, stripUndefined(next)), previous, setCommissions, reportWriteFailure);
    return next;
  }, [commissions, reportWriteFailure, user?.uid]);

  const updateCommission = useCallback(async (id: string, changes: Partial<Commission>) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    const previous = commissions;
    setCommissions((current) => orderCommissions(current.map((item) => item.id === id ? normalizeCommission({ ...item, ...changes, updatedAt: Date.now() }) : item)));
    setSyncState("pending");
    await persistOptimisticWrite(updateDoc(doc(db, "artists", user.uid, "commissions", id), stripUndefined({ ...changes, updatedAt: Date.now() })), previous, setCommissions, reportWriteFailure);
  }, [reportWriteFailure, user?.uid]);

  const deleteCommission = useCallback(async (id: string) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    if (!id) return;
    setCommissions((current) => current.filter((item) => item.id !== id));
    setSyncState("pending");
    void deleteDoc(doc(db, "artists", user.uid, "commissions", id)).catch(reportWriteFailure);
  }, [reportWriteFailure, user?.uid]);

  const changeStatus = useCallback(async (commission: Commission, nextStatus: CommissionStatus, note?: string) => {
    await updateCommission(commission.id, withStatusTransition(commission, nextStatus, note));
  }, [updateCommission]);

  const archiveCommission = useCallback(async (commission: Commission) => {
    await updateCommission(commission.id, archiveCommissionRecord(commission));
  }, [updateCommission]);

  const restoreCommission = useCallback(async (commission: Commission) => {
    await updateCommission(commission.id, restoreArchivedCommission(commission));
  }, [updateCommission]);

  const importInitialRecords = useCallback(async () => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫");
    const batch = writeBatch(db);
    const nextItems = initialCommissions.map((item) => {
      const reference = doc(collection(db, "artists", user.uid, "commissions"));
      const next = { ...item, id: reference.id, updatedAt: Date.now() };
      batch.set(reference, next);
      return next;
    });
    setCommissions((current) => orderCommissions([...current, ...nextItems]));
    setSyncState("pending");
    void batch.commit().catch(reportWriteFailure);
  }, [reportWriteFailure, user?.uid]);

  return useMemo(() => ({ commissions, syncState, error, createCommission, saveQueuedCommission, updateCommission, deleteCommission, changeStatus, archiveCommission, restoreCommission, importInitialRecords }), [archiveCommission, changeStatus, commissions, createCommission, deleteCommission, error, importInitialRecords, restoreCommission, saveQueuedCommission, syncState, updateCommission]);
}
