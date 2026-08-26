import { firestoreDb } from "@/lib/firebase";
import { User } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

export type TrashKind = "commission" | "submission";
export type TrashDocumentRecord = { path: string; data: Record<string, unknown> };
export type TrashItem = {
  id: string;
  ownerUid: string;
  kind: TrashKind;
  label: string;
  deletedAt: number;
  expiresAt: number;
  records: TrashDocumentRecord[];
};

const retentionMs = 7 * 24 * 60 * 60 * 1000;

function normalizeTrashItem(id: string, value: Partial<TrashItem>): TrashItem | null {
  if (!value.ownerUid || (value.kind !== "commission" && value.kind !== "submission") || !Array.isArray(value.records)) return null;
  return {
    id,
    ownerUid: value.ownerUid,
    kind: value.kind,
    label: value.label || (value.kind === "commission" ? "未命名畫約" : "未命名墨諾函箋"),
    deletedAt: Number(value.deletedAt) || Date.now(),
    expiresAt: Number(value.expiresAt) || Date.now(),
    records: value.records.filter((record): record is TrashDocumentRecord => Boolean(record?.path && record?.data)),
  };
}

export function getTrashDaysRemaining(item: TrashItem, now = Date.now()) {
  return Math.max(0, Math.ceil((item.expiresAt - now) / (24 * 60 * 60 * 1000)));
}

export function useTrash(user: User | null, isAllowed: boolean) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = firestoreDb;
    if (!db || !user || !isAllowed) { setItems([]); return; }
    return onSnapshot(collection(db, "artists", user.uid, "trash"), (snapshot) => {
      setItems(snapshot.docs.map((item) => normalizeTrashItem(item.id, item.data() as Partial<TrashItem>)).filter((item): item is TrashItem => Boolean(item)).sort((a, b) => b.deletedAt - a.deletedAt));
      setError(null);
    }, (nextError) => setError(nextError.message));
  }, [isAllowed, user?.uid]);

  const moveToTrash = useCallback(async ({ kind, label, records }: { kind: TrashKind; label: string; records: TrashDocumentRecord[] }) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫。");
    if (!records.length) throw new Error("找不到可移入垃圾桶的資料。");
    if (records.length > 450) throw new Error("此刪除作業包含過多關聯資料，請分批處理。");
    const now = Date.now();
    const trashRef = doc(collection(db, "artists", user.uid, "trash"));
    const batch = writeBatch(db);
    batch.set(trashRef, { id: trashRef.id, ownerUid: user.uid, kind, label, deletedAt: now, expiresAt: now + retentionMs, records });
    records.forEach((record) => batch.delete(doc(db, record.path)));
    await batch.commit();
  }, [user?.uid]);

  const restore = useCallback(async (item: TrashItem) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫。");
    if (item.ownerUid !== user.uid) throw new Error("無法復原非本人垃圾桶中的資料。");
    const batch = writeBatch(db);
    item.records.forEach((record) => batch.set(doc(db, record.path), record.data));
    batch.delete(doc(db, "artists", user.uid, "trash", item.id));
    await batch.commit();
  }, [user?.uid]);

  const permanentlyDelete = useCallback(async (item: TrashItem) => {
    const db = firestoreDb;
    if (!db || !user) throw new Error("目前無法連接資料庫。");
    await deleteDoc(doc(db, "artists", user.uid, "trash", item.id));
  }, [user?.uid]);

  return useMemo(() => ({ items, error, moveToTrash, restore, permanentlyDelete }), [error, items, moveToTrash, permanentlyDelete, restore]);
}
