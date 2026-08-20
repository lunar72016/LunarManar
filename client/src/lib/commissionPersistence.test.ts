import { describe, expect, it, vi } from "vitest";
import { persistFirestoreWrite, persistOptimisticWrite, prepareCommissionSave, stripUndefined } from "./commissionPersistence";
import { addWeeks, createBlankCommission, startOfWeek } from "./commission";

describe("commission persistence", () => {
  it("removes undefined values from nested write payloads while preserving null values", () => {
    expect(stripUndefined({ name: "畫約", optional: undefined, nested: { keep: null, skip: undefined }, list: [{ okay: 1, skip: undefined }] })).toEqual({ name: "畫約", nested: { keep: null }, list: [{ okay: 1 }] });
  });

  it("returns an acknowledged outcome for a successful write", async () => {
    await expect(persistFirestoreWrite(Promise.resolve(), vi.fn(), 50)).resolves.toBe("acknowledged");
  });

  it("returns the Firestore error immediately for a rejected write", async () => {
    await expect(persistFirestoreWrite(Promise.reject(new Error("permission-denied")), vi.fn(), 50)).rejects.toThrow("permission-denied");
  });

  it("rolls an optimistic old-commission update back and propagates a rejected write", async () => {
    const previous = { id: "old", clientName: "原姓名" };
    const rollback = vi.fn();
    const failure = vi.fn();
    await expect(persistOptimisticWrite(Promise.reject(new Error("permission-denied")), previous, rollback, failure, 50)).rejects.toThrow("permission-denied");
    expect(rollback).toHaveBeenCalledWith(previous);
    expect(failure).toHaveBeenCalledTimes(1);
  });

  it("does not roll a new or old commission back when Firestore acknowledges the write", async () => {
    const rollback = vi.fn();
    const failure = vi.fn();
    await expect(persistOptimisticWrite(Promise.resolve(), [{ id: "before" }], rollback, failure, 50)).resolves.toBe("acknowledged");
    expect(rollback).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
  });

  it("prepares a new commission with a default week, clean payload, and automatic monthly position", () => {
    const existing = { ...createBlankCommission(), id: "existing", scheduleWeekStart: startOfWeek(Date.UTC(2026, 8, 7)), queueMonth: "2026-09", queuePosition: 1 };
    const draft = { ...createBlankCommission(), id: "", scheduleWeekStart: null, queueMonth: "", queuePosition: 0, rawBasePrice: null };
    const saved = prepareCommissionSave(draft, [existing], "new", 123);

    expect(saved).toMatchObject({ id: "new", scheduleWeekStart: addWeeks(existing.scheduleWeekStart!, 2), queueMonth: "2026-09", queuePosition: 2, updatedAt: 123 });
    expect(stripUndefined({ ...saved, temporary: undefined })).toMatchObject({ rawBasePrice: null, queuePosition: 2 });
    expect(stripUndefined({ ...saved, temporary: undefined })).not.toHaveProperty("temporary");
  });

  it("prepares an existing commission update without replacing its chosen week or position", () => {
    const commission = { ...createBlankCommission(), id: "old", scheduleWeekStart: startOfWeek(Date.UTC(2026, 9, 5)), queueMonth: "2026-10", queuePosition: 3 };
    const saved = prepareCommissionSave({ ...commission, clientName: "更新後" }, [commission], "old", 456);

    expect(saved).toMatchObject({ id: "old", clientName: "更新後", scheduleWeekStart: commission.scheduleWeekStart, queueMonth: "2026-10", queuePosition: 3, updatedAt: 456 });
  });
});
