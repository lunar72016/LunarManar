export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .map(([key, nested]) => [key, stripUndefined(nested)]),
    ) as T;
  }
  return value;
}

export type WriteOutcome = "acknowledged" | "queued";

export function prepareCommissionSave(commission: Commission, existing: Commission[], id: string, now = Date.now()): Commission {
  const scheduleWeekStart = getCommissionScheduleWeek(commission) ?? getDefaultScheduleWeekStart(existing);
  const lastQueuedWeek = getLastQueuedWeek(existing.filter((item) => item.id !== commission.id));
  const requestedType = commission.scheduleType ?? "queued";
  const scheduleType = requestedType === "reservation" && shouldConvertReservation({ ...commission, scheduleType: requestedType, scheduleWeekStart }, lastQueuedWeek) ? "queued" : requestedType;
  const queueMonth = getScheduleMonthFromWeek(scheduleWeekStart, commission.queueMonth);
  const queuePosition = scheduleType === "queued"
    ? commission.queuePosition > 0
      ? commission.queuePosition
      : existing.filter((item) => item.id !== commission.id && item.scheduleType === "queued" && getCommissionScheduleMonth(item) === queueMonth).length + 1
    : 0;
  return {
    ...commission,
    id,
    scheduleWeekStart,
    scheduleType,
    queueMonth,
    queueMonthManual: false,
    queuePosition,
    updatedAt: now,
  };
}

/**
 * 在線時將 Firestore 寫入結果及早回傳給表單；離線時保留 SDK 本機佇列，避免中斷離線優先作業。
 */
export async function persistFirestoreWrite(write: Promise<void>, onDeferredFailure: (error: unknown) => void, timeoutMs = 1_500): Promise<WriteOutcome> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race([
    write.then(() => "acknowledged" as const),
    new Promise<"queued">((resolve) => { timeoutId = setTimeout(() => resolve("queued"), timeoutMs); }),
  ]);
  if (timeoutId) clearTimeout(timeoutId);
  if (outcome === "queued") void write.catch(onDeferredFailure);
  return outcome;
}

export async function persistOptimisticWrite<T>(write: Promise<void>, previous: T, onRollback: (previous: T) => void, onFailure: (error: unknown) => void, timeoutMs = 1_500): Promise<WriteOutcome> {
  try {
    return await persistFirestoreWrite(write, onFailure, timeoutMs);
  } catch (error) {
    onRollback(previous);
    onFailure(error);
    throw error;
  }
}
import { Commission, getCommissionScheduleMonth, getCommissionScheduleWeek, getDefaultScheduleWeekStart, getLastQueuedWeek, getScheduleMonthFromWeek, shouldConvertReservation } from "./commission";
