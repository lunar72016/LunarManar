export type ForegroundPushPayload = { data?: Record<string, string | undefined> };

export type ForegroundIntakeMessage = {
  type: "new-intake" | "badge-update";
  pendingCount: number;
  title: string;
  body: string;
};

export function getForegroundIntakeMessage(payload: ForegroundPushPayload): ForegroundIntakeMessage | null {
  const type = payload.data?.type;
  if (type !== "new-intake" && type !== "badge-update") return null;
  const count = Number(payload.data?.pendingIntakeCount);
  const pendingCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return {
    type,
    pendingCount,
    title: "繪月錄",
    body: type === "new-intake" ? "有新的待啟墨函。" : "待啟墨函數量已更新。",
  };
}
