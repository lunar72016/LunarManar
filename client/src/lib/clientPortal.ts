import { ArtworkItem, Commission, CommissionStatus, LicenseOption, PaymentState, ScheduleType, formatDisplayDate, getCommissionScheduleWeek, statusMeta, weekLabel } from "@/lib/commission";

export type ClientAccessMode = "google" | "code";
export type ClientSubmissionState = "submitted" | "accepted" | "declined";

export type ClientProfile = {
  uid: string;
  email: string;
  displayName: string;
  updatedAt: number;
};

export type ClientSubmission = {
  id: string;
  commissionId?: string;
  accessMode: ClientAccessMode;
  clientUid: string | null;
  accessCode: string | null;
  ownerUid: string;
  clientName: string;
  contactEmail: string;
  contactChannel: string;
  contactHandle: string;
  characterSettingNote: string;
  poseNote: string;
  costumeDesignNote: string;
  accessoryNote: string;
  requirements: string;
  referenceUrls: string[];
  deliveryNote: string;
  scheduleType?: ScheduleType;
  reservationDate?: number | null;
  artworkItems?: ArtworkItem[];
  isRush?: boolean;
  rushLevel?: import("@/lib/commission").RushLevel | null;
  licenses?: LicenseOption[];
  privacyMode?: import("@/lib/commission").PrivacyMode;
  privacyUntil?: number | null;
  deliveryPreference?: "unspecified" | "date";
  dueDate?: number | null;
  estimatedPrice?: number | null;
  state: ClientSubmissionState;
  createdAt: number;
  updatedAt: number;
};

export type ClientProgress = {
  id: string;
  accessMode: ClientAccessMode;
  clientUid: string | null;
  accessCode: string | null;
  ownerUid: string;
  commissionId: string;
  clientName: string;
  orderCode: string;
  status: CommissionStatus;
  statusLabel: string;
  scheduleWeekLabel: string;
  dueDateLabel: string | null;
  nextStep: string;
  createdAt: number;
  scheduleType: ScheduleType;
  isRush: boolean;
  artworkItems: Array<{ id: string; summary: string }>;
  /** 依畫約階段限制寫入公開快照的款項內容，避免未定案價格外洩。 */
  paymentDisclosure: "estimate" | "deposit" | "total" | "hidden";
  estimatedBaseAmount: number | null;
  totalAmount: number | null;
  depositAmount: number | null;
  depositState: PaymentState;
  depositPaidAt: number | null;
  balanceAmount: number | null;
  balanceState: PaymentState;
  balancePaidAt: number | null;
  statusHistory: Array<{ status: CommissionStatus; at: number }>;
  updatedAt: number;
  revokedAt: number | null;
};

export function getPublicPaymentDisclosure(status: CommissionStatus): ClientProgress["paymentDisclosure"] {
  if (status === "inquiry") return "estimate";
  if (["confirmed", "awaiting_deposit", "queued", "sketching", "sketch_confirmed"].includes(status)) return "deposit";
  if (["awaiting_balance", "finalizing", "completed"].includes(status)) return "total";
  return "hidden";
}

const statusNextStep: Record<CommissionStatus, string> = {
  inquiry: "繪師正在閱讀委託內容，稍後會與您確認細節。",
  confirmed: "案件內容已確認，請依繪師指示完成下一步。",
  awaiting_deposit: "請依繪師提供的資訊完成訂金；確認收款後會排入作畫流程。",
  queued: "案件已列入排程，繪師會依序開始作畫。",
  sketching: "繪師正在製作草稿，完成後會與您聯絡確認。",
  sketch_confirmed: "草稿確認中，繪師會依確認內容安排後續作業。",
  awaiting_balance: "草稿內容已確認，請依繪師提供的資訊完成尾款。",
  finalizing: "繪師正在完成作品，請耐心等候交稿通知。",
  completed: "作品已完成，請依繪師說明確認交稿安排。",
  archived: "此案件目前已封存；如有需要請直接聯繫繪師。",
};

export type PublicScheduleDetail = { label: "排程週次" | "交稿期限"; value: string };

/** 急案不參與一般排程，寄墨主端只顯示其承諾的交稿期限。 */
export function getPublicScheduleDetails(progress: Pick<ClientProgress, "isRush" | "scheduleWeekLabel" | "dueDateLabel">): PublicScheduleDetail[] {
  if (progress.isRush) return progress.dueDateLabel ? [{ label: "交稿期限", value: progress.dueDateLabel }] : [];
  return [
    { label: "排程週次", value: progress.scheduleWeekLabel },
    ...(progress.dueDateLabel ? [{ label: "交稿期限" as const, value: progress.dueDateLabel }] : []),
  ];
}

/** 產生不可猜測的 256-bit 專屬驗證碼；此碼同時作為一次性進度連結的路徑識別。 */
export function createPortalAccessCode() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (value) => value.toString(36).padStart(2, "0")).join("");
  return `HY-${code.slice(0, 16)}-${code.slice(16, 32)}-${code.slice(32, 48)}`.toUpperCase();
}

export function isPortalAccessCode(value: string) {
  return /^HY-[0-9A-Z]{16}-[0-9A-Z]{16}-[0-9A-Z]{16}$/.test(value.trim().toUpperCase());
}

/** 僅保留寄墨主端可顯示的畫約、款項與進度欄位，避免設定稿、內部備註與需求原文外洩。 */
export function buildClientProgress(commission: Commission, access: Pick<ClientProgress, "id" | "accessMode" | "clientUid" | "accessCode" | "ownerUid">): ClientProgress {
  const dueDateLabel = commission.dueDate ? formatDisplayDate(commission.dueDate) : null;
  const paymentDisclosure = getPublicPaymentDisclosure(commission.status);
  const revealDeposit = paymentDisclosure === "deposit" || paymentDisclosure === "total";
  const revealTotal = paymentDisclosure === "total";
  return {
    ...access,
    commissionId: commission.id,
    clientName: commission.clientName,
    orderCode: commission.orderCode,
    status: commission.status,
    statusLabel: statusMeta[commission.status].label,
    scheduleWeekLabel: weekLabel(getCommissionScheduleWeek(commission)),
    dueDateLabel,
    nextStep: statusNextStep[commission.status],
    createdAt: commission.createdAt,
    scheduleType: commission.scheduleType,
    isRush: commission.isRush,
    artworkItems: commission.artworkItems.map((item) => ({ id: item.id, summary: item.artScope === "Q版" ? `${item.characterCount} 人 · Q版 ${item.qSize ?? "未選規格"}` : `${item.characterCount} 人 · ${item.artScope} · ${item.finishLevel}` })),
    paymentDisclosure,
    estimatedBaseAmount: paymentDisclosure === "estimate" ? (commission.estimatedPrice ?? commission.basePriceMin) : null,
    totalAmount: revealTotal ? commission.totalAmount : null,
    depositAmount: revealDeposit ? commission.depositAmount : null,
    depositState: revealDeposit ? commission.depositState : "unrecorded",
    depositPaidAt: revealDeposit ? commission.depositPaidAt : null,
    balanceAmount: revealTotal ? commission.balanceAmount : null,
    balanceState: revealTotal ? commission.balanceState : "unrecorded",
    balancePaidAt: revealTotal ? commission.balancePaidAt : null,
    statusHistory: commission.statusHistory.map((item) => ({ status: item.status, at: item.at })),
    updatedAt: Date.now(),
    revokedAt: null,
  };
}

/** 公開送件完成後即建立僅含送達狀態的快照；繪師受理畫約後會以正式案件快照覆寫。 */
export function buildPendingClientProgress(access: Pick<ClientProgress, "id" | "accessMode" | "clientUid" | "accessCode" | "ownerUid">, clientName: string): ClientProgress {
  return {
    ...access,
    commissionId: "",
    clientName,
    orderCode: "委託函已送達",
    status: "inquiry",
    statusLabel: "等待繪師確認",
    scheduleWeekLabel: "繪師確認後提供",
    dueDateLabel: null,
    nextStep: statusNextStep.inquiry,
    createdAt: Date.now(),
    scheduleType: "queued",
    isRush: false,
    artworkItems: [],
    paymentDisclosure: "estimate",
    estimatedBaseAmount: null,
    totalAmount: null,
    depositAmount: null,
    depositState: "unrecorded",
    depositPaidAt: null,
    balanceAmount: null,
    balanceState: "unrecorded",
    balancePaidAt: null,
    statusHistory: [{ status: "inquiry", at: Date.now() }],
    updatedAt: Date.now(),
    revokedAt: null,
  };
}

/** 將寄墨主提供的雲端連結正規化；只接受 http／https，且去除重複與空白。 */
export function normalizeReferenceUrls(value: string) {
  return Array.from(new Set(value.split(/[\n,\s]+/).map((item) => item.trim()).filter((item) => /^https?:\/\//i.test(item))));
}

/** Firestore 的文件 ID 為唯一可信識別，避免舊資料中的空白 id 導致文件路徑缺少最後一段。 */
export function hydrateClientSubmission(documentId: string, data: ClientSubmission): ClientSubmission {
  return { ...data, id: documentId };
}

/** 僅顯示仍待繪師決定的公開送件；已取消或已受理的函件不應留在待閱清單。 */
export function getPendingClientSubmissions(items: ClientSubmission[]) {
  return items.filter((item) => item.state === "submitted");
}

export function getClientProgressPath(code: string) {
  return `/#/client/progress/${encodeURIComponent(code.trim().toUpperCase())}`;
}

/** 公開表單的日期欄位統一使用易讀的年月日斜線提示，避免瀏覽器原生提示混雜語系。 */
export function formatPortalDateInput(value: string) {
  return value ? value.replaceAll("-", "/") : "yyyy/mm/dd";
}

/** 驗證已從伺服器讀回的公開進度是否可由該專屬驗證碼安全存取。 */
export function isVerifiedCodeProgress(progress: ClientProgress | null | undefined, code: string) {
  const normalized = code.trim().toUpperCase();
  return Boolean(progress && progress.id === normalized && progress.accessMode === "code" && progress.accessCode === normalized && progress.revokedAt === null);
}

/** 取回同一畫約目前仍可分享的驗證碼進度；無效或已撤銷紀錄不會被沿用。 */
export function getActiveCodeProgress(items: ClientProgress[], commissionId: string) {
  return items.find((item) => item.commissionId === commissionId && isVerifiedCodeProgress(item, item.accessCode ?? "")) ?? null;
}
