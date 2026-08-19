import type { MultiplierRange, StudioSettings } from "@/lib/studioSettings";

export const commissionStatuses = ["inquiry", "confirmed", "awaiting_deposit", "queued", "sketching", "sketch_confirmed", "awaiting_balance", "finalizing", "completed"] as const;
export type CommissionStatus = (typeof commissionStatuses)[number];
export type PaymentState = "paid" | "unpaid" | "unrecorded";
export type LicenseOption = "commercial" | "promotion" | "buyout";
export type DeliveryPreference = "unspecified" | "date";
export type PrivacyMode = "open" | "permanent" | "until";
export type ScheduleType = "queued" | "reservation";

export const contactChannels = ["Facebook", "電子郵件", "Threads", "LINE", "Discord", "其他"];
export const artScopeOptions = ["大頭", "胸像", "半身", "全身", "服設", "特寫-眼睛", "特寫-手", "Q版"] as const;
export const finishLevelOptions = ["塗鴉", "鋪色", "重點色", "一般", "精緻", "寫實", "線稿"] as const;
export const qSizeOptions = ["2頭身", "2.5頭身"] as const;
export const rushLevelOptions = ["一般加急", "中度加急", "高度加急", "極限加急"] as const;

export type ArtScope = (typeof artScopeOptions)[number];
export type FinishLevel = (typeof finishLevelOptions)[number];
export type QSize = (typeof qSizeOptions)[number];
export type RushLevel = (typeof rushLevelOptions)[number];

export type ArtworkItem = {
  id: string;
  characterCount: number;
  artScope: ArtScope;
  finishLevel: FinishLevel;
  qSize: QSize | null;
  note: string;
};

export type StatusHistoryEntry = { status: CommissionStatus; at: number; note?: string };

export type Commission = {
  id: string;
  orderCode: string;
  clientName: string;
  contactChannel: string;
  contactHandle: string;
  queueMonth: string;
  /** 手動調整月份後保留指定值；未覆寫時隨排單週次同步。 */
  queueMonthManual: boolean;
  queuePosition: number;
  /** 星期一 00:00 UTC；舊資料會從 queueMonth 正規化。 */
  scheduleWeekStart: number | null;
  /** 預約不列入一般排單，系統達排程門檻時自動轉換。 */
  scheduleType: ScheduleType;
  /** 以週一至週五為單位的預計工作天。 */
  estimatedWorkdays: number | null;
  /** Legacy fields retained so already-imported records still display correctly. */
  characterCount: number;
  artScopes: string[];
  customArtScope: string;
  finishLevels: string[];
  artworkItems: ArtworkItem[];
  hasBackground: boolean;
  backgroundNote: string;
  requirements: string;
  characterSettingNote: string;
  poseNote: string;
  costumeDesignNote: string;
  accessoryNote: string;
  isRush: boolean;
  rushLevel: RushLevel;
  licenses: LicenseOption[];
  rushFee: number | null;
  rushMultiplier: number | null;
  deliveryPreference: DeliveryPreference;
  dueDate: number | null;
  privacyMode: PrivacyMode;
  privacyUntil: number | null;
  basePriceMin: number | null;
  basePriceMax: number | null;
  basePriceText: string;
  depositAmount: number | null;
  depositText: string;
  finalPrice: number | null;
  finalPriceText: string;
  balanceAmount: number | null;
  estimatedPrice: number | null;
  additionalAmount: number | null;
  additionalQuoteAmount: number | null;
  totalAmount: number | null;
  depositState: PaymentState;
  balanceState: PaymentState;
  additionalState: PaymentState;
  depositPaidAt: number | null;
  balancePaidAt: number | null;
  additionalPaidAt: number | null;
  paymentMethod: string;
  paymentNote: string;
  status: CommissionStatus;
  statusHistory: StatusHistoryEntry[];
  sketchSentAt: number | null;
  sketchConfirmedAt: number | null;
  revisionNote: string;
  completedAt: number | null;
  /** Reserved for the future public client form and progress portal. */
  clientPortal: { enabled: boolean; accessTokenHash: string | null; expiresAt: number | null; referenceFiles: string[] };
  shareEnabled: boolean;
  shareTokenHash: string | null;
  shareExpiresAt: number | null;
  sourceNote: string;
  createdAt: number;
  updatedAt: number;
};

export const statusMeta: Record<CommissionStatus, { label: string; tone: string }> = {
  inquiry: { label: "詢問中", tone: "bg-stone-100 text-stone-600 border-stone-200" },
  confirmed: { label: "已確認", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  awaiting_deposit: { label: "等待訂金", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  queued: { label: "排單中", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  sketching: { label: "草稿製作", tone: "bg-violet-50 text-violet-700 border-violet-200" },
  sketch_confirmed: { label: "草稿確認", tone: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  awaiting_balance: { label: "等待尾款", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  finalizing: { label: "完稿製作", tone: "bg-teal-50 text-teal-700 border-teal-200" },
  completed: { label: "完稿", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const DAY_MS = 86_400_000;

/** 將任意日期歸到該週星期一 00:00 UTC。 */
export function startOfWeek(value = Date.now()) {
  const date = new Date(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

export function addWeeks(weekStart: number, count: number) { return startOfWeek(weekStart) + count * 7 * DAY_MS; }

/** 以該週週一歸屬月份，讓每月第一個週一顯示為該月份第一週。 */
export function weekLabel(weekStart: number | null | undefined) {
  if (!weekStart) return "尚未排定週次";
  const anchor = new Date(startOfWeek(weekStart));
  const month = anchor.getUTCMonth() + 1;
  const week = Math.floor((anchor.getUTCDate() - 1) / 7) + 1;
  return `${month}月第${["一", "二", "三", "四", "五", "六"][week - 1] ?? String(week)}週`;
}

function weekStartFromLegacyMonth(month: string | null | undefined) {
  const match = month?.match(/^(\d{4})-(\d{2})$/);
  return match ? startOfWeek(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : null;
}

export function getCommissionScheduleWeek(commission: Pick<Commission, "scheduleWeekStart" | "queueMonth">) { return commission.scheduleWeekStart ?? weekStartFromLegacyMonth(commission.queueMonth); }

/** 以週次週一歸屬排單月份，與介面上的「X月第一週」標示一致。 */
export function getCommissionScheduleMonth(commission: Pick<Commission, "scheduleWeekStart" | "queueMonth"> & Partial<Pick<Commission, "queueMonthManual">>) {
  if ((commission.queueMonthManual ?? false) && /^\d{4}-\d{2}$/.test(commission.queueMonth ?? "")) return commission.queueMonth;
  return getScheduleMonthFromWeek(commission.scheduleWeekStart, commission.queueMonth);
}

/** 依週次週一的月份取得 YYYY-MM；缺少週次時退回原本的月份值。 */
export function getScheduleMonthFromWeek(scheduleWeekStart: number | null | undefined, fallback = "") {
  if (!scheduleWeekStart) return fallback || "unplanned";
  const week = startOfWeek(scheduleWeekStart);
  const anchor = new Date(week);
  return `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 先依一般／預約、月份、手動月內順序排序，未指定順序才依週次與建立時間排列。 */
export function sortCommissionsForSchedule(items: Commission[]) {
  return [...items].sort((a, b) => {
    const reservationCompare = Number((a.scheduleType ?? "queued") === "reservation") - Number((b.scheduleType ?? "queued") === "reservation");
    if (reservationCompare !== 0) return reservationCompare;
    const monthCompare = getCommissionScheduleMonth(a).localeCompare(getCommissionScheduleMonth(b));
    if (monthCompare !== 0) return monthCompare;
    const positionCompare = (a.queuePosition || Number.MAX_SAFE_INTEGER) - (b.queuePosition || Number.MAX_SAFE_INTEGER);
    if (positionCompare !== 0) return positionCompare;
    const weekCompare = (getCommissionScheduleWeek(a) ?? Number.MAX_SAFE_INTEGER) - (getCommissionScheduleWeek(b) ?? Number.MAX_SAFE_INTEGER);
    if (weekCompare !== 0) return weekCompare;
    return a.createdAt - b.createdAt;
  });
}

/** 僅分組一般排單；預約單由呼叫端獨立處理。 */
export function groupQueuedCommissionsByMonth(items: Commission[]) {
  return items.filter((item) => item.scheduleType !== "reservation").reduce<Record<string, Commission[]>>((groups, item) => {
    const month = getCommissionScheduleMonth(item);
    groups[month] = [...(groups[month] ?? []), item];
    return groups;
  }, {});
}

export function getLastQueuedWeek(commissions: Pick<Commission, "scheduleWeekStart" | "queueMonth" | "scheduleType">[]) {
  const weeks = commissions.filter((commission) => (commission.scheduleType ?? "queued") === "queued").map(getCommissionScheduleWeek).filter((week): week is number => week !== null);
  return weeks.length ? Math.max(...weeks) : null;
}

export function getDefaultScheduleWeekStart(commissions: Pick<Commission, "scheduleWeekStart" | "queueMonth" | "scheduleType">[], now = Date.now()) {
  return addWeeks(getLastQueuedWeek(commissions) ?? startOfWeek(now), 2);
}

/** 當一般排單已抵達預約前一週，該預約即自動列入一般排單。 */
export function shouldConvertReservation(commission: Pick<Commission, "scheduleType" | "scheduleWeekStart" | "queueMonth">, lastQueuedWeek: number | null) {
  const reservationWeek = getCommissionScheduleWeek(commission);
  return commission.scheduleType === "reservation" && reservationWeek !== null && lastQueuedWeek !== null && reservationWeek <= addWeeks(lastQueuedWeek, 1);
}

/** 由指定交稿日與最後一般排單週次推導加急層級。 */
export function autoDetectRushLevel(dueDate: number | null, lastQueuedWeek: number | null, now = Date.now()): RushLevel | null {
  if (!dueDate) return null;
  const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setUTCHours(0, 0, 0, 0);
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / DAY_MS);
  if (daysUntilDue <= 0) return "極限加急";
  if (daysUntilDue <= 7) return "高度加急";
  if (daysUntilDue <= 30) return "中度加急";
  const finalQueuedDay = lastQueuedWeek === null ? null : addWeeks(lastQueuedWeek, 1) - DAY_MS;
  return finalQueuedDay !== null && due.getTime() <= finalQueuedDay ? "一般加急" : null;
}

/** 計算兩個 UTC 日期間（含首尾）的週一至週五天數。 */
export function countWorkdays(startDate: number, endDate: number) {
  const start = new Date(startDate); const end = new Date(endDate);
  start.setUTCHours(0, 0, 0, 0); end.setUTCHours(0, 0, 0, 0);
  if (end.getTime() < start.getTime()) return 0;
  let count = 0;
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += DAY_MS) {
    const weekday = new Date(cursor).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

export function createArtworkItem(overrides: Partial<ArtworkItem> = {}): ArtworkItem {
  return { id: crypto.randomUUID?.() ?? `art-${Date.now()}-${Math.random().toString(36).slice(2)}`, characterCount: 1, artScope: "大頭", finishLevel: "一般", qSize: null, note: "", ...overrides };
}

export const createBlankCommission = (): Commission => {
  const now = Date.now();
  return {
    id: "", orderCode: "", clientName: "", contactChannel: "Facebook", contactHandle: "", queueMonth: new Date().toISOString().slice(0, 7), queueMonthManual: false, queuePosition: 0, scheduleWeekStart: null, scheduleType: "queued", estimatedWorkdays: null,
    characterCount: 1, artScopes: [], customArtScope: "", finishLevels: [], artworkItems: [], hasBackground: false, backgroundNote: "", requirements: "", characterSettingNote: "", poseNote: "", costumeDesignNote: "", accessoryNote: "",
    isRush: false, rushLevel: "一般加急", licenses: [], rushFee: null, rushMultiplier: null, deliveryPreference: "unspecified", dueDate: null, privacyMode: "open", privacyUntil: null,
    basePriceMin: null, basePriceMax: null, basePriceText: "", depositAmount: null, depositText: "", finalPrice: null, finalPriceText: "", balanceAmount: null, estimatedPrice: null, additionalAmount: null, additionalQuoteAmount: null, totalAmount: null,
    depositState: "unpaid", balanceState: "unpaid", additionalState: "unrecorded", depositPaidAt: null, balancePaidAt: null, additionalPaidAt: null, paymentMethod: "", paymentNote: "", status: "inquiry", statusHistory: [{ status: "inquiry", at: now }], sketchSentAt: null, sketchConfirmedAt: null, revisionNote: "", completedAt: null,
    clientPortal: { enabled: false, accessTokenHash: null, expiresAt: null, referenceFiles: [] }, shareEnabled: false, shareTokenHash: null, shareExpiresAt: null, sourceNote: "", createdAt: now, updatedAt: now,
  };
};

function initialRecord(index: number, queueMonth: string, clientName: string, content: string, finish: string, price: string, sourceNote = ""): Commission {
  const now = Date.now() - (30 - index) * 60_000;
  const [depositRaw = "", finalRaw = ""] = price.split("/");
  const parseNumeric = (value: string) => Number(value.match(/\d+(?:\.\d+)?/)?.[0] ?? "") || null;
  const depositAmount = price.includes("/") ? parseNumeric(depositRaw) : null;
  const finalPrice = price.includes("/") && /^\d+[+↓]?$/.test(finalRaw) ? parseNumeric(finalRaw) : null;
  return { ...createBlankCommission(), id: `seed-${queueMonth}-${index}`, orderCode: `${queueMonth.replace("-", "")}-${String(index + 1).padStart(2, "0")}`, clientName, contactChannel: "其他", queueMonth, queueMonthManual: true, queuePosition: index + 1, scheduleWeekStart: weekStartFromLegacyMonth(queueMonth), scheduleType: "queued", characterCount: content.includes("雙人") ? 2 : 1, artScopes: [content], finishLevels: [finish], basePriceText: price.includes("/") ? "" : price, depositAmount, depositText: depositRaw, finalPrice, finalPriceText: finalRaw, balanceAmount: finalPrice !== null && depositAmount !== null ? Math.max(finalPrice - depositAmount, 0) : null, depositState: "unrecorded", balanceState: "unrecorded", status: "queued", statusHistory: [{ status: "queued", at: now, note: "由既有排單紀錄匯入；付款與工作進度待補登。" }], sourceNote: [sourceNote, `原始紀錄：${content}（${finish}）${price}`].filter(Boolean).join(" · "), createdAt: now, updatedAt: now };
}

export const initialCommissions: Commission[] = [
  initialRecord(0, "2026-08", "辣椒", "半身", "鋪色", "5200", "8/16"), initialRecord(1, "2026-08", "Tiffany Su", "雙人水族", "一般", "5600"), initialRecord(2, "2026-08", "けい", "雙人大頭", "一般", "800/1600+"), initialRecord(3, "2026-08", "洛初終", "雙人胸像", "重點色", "900/1800+"), initialRecord(4, "2026-08", "檸檬", "雙人", "塗鴉", "2000/4-5000"), initialRecord(5, "2026-08", "99oo", "胸像＋服設", "重點色", "400/1500↓"), initialRecord(6, "2026-08", "墨蝶", "雙人", "塗鴉", "2000/3500-4500"), initialRecord(7, "2026-08", "崔塵", "未定", "精緻", "1500/?"), initialRecord(8, "2026-09", "歐津恩", "全身", "寫實", "6500/?"), initialRecord(9, "2026-09", "cho.o_min", "小卡", "一般", "700/1400+"), initialRecord(10, "2026-09", "洛初終", "雙人服設", "一般上色", "6200/12400+"), initialRecord(11, "2026-09", "Hong Chiang", "立繪、胸像", "塗鴉、一般", "1300/2600+"), initialRecord(12, "2026-09", "墨弦", "胸像", "一般上色", "500/1000+"), initialRecord(13, "2026-09", "何霖", "雙人", "重點色", "1000/2000+"),
];

export function monthLabel(month: string) { const [year, rawMonth] = month.split("-"); return year ? `${year} 年 ${Number(rawMonth)} 月` : "未排定月份"; }
export function formatCurrency(value: number | null | undefined) { return value === null || value === undefined || Number.isNaN(value) ? "—" : new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(value); }
const roundCurrency = (value: number) => Math.round(value);

export function getArtworkItems(commission: Commission): ArtworkItem[] {
  if (commission.artworkItems?.length) return commission.artworkItems;
  return [];
}

export function describeArtworkItems(commission: Commission) {
  const items = getArtworkItems(commission);
  if (!items.length) return `${commission.characterCount} 人 · ${commission.artScopes?.join("、") || "未填寫範圍"}${commission.finishLevels?.length ? ` · ${commission.finishLevels.join("、")}` : ""}`;
  return items.map((item) => `${item.characterCount} 人 ${item.artScope}${item.artScope === "Q版" && item.qSize ? `（${item.qSize}）` : ""} · ${item.finishLevel}`).join(" ／ ");
}

export function isPricedCombination(settings: StudioSettings, scope: ArtScope, finish: FinishLevel) { return (settings.combinationPrices[scope]?.[finish] ?? null) !== null; }
export function getAvailableScopes(settings: StudioSettings) { return artScopeOptions.filter((scope) => finishLevelOptions.some((finish) => isPricedCombination(settings, scope, finish))); }
export function getAvailableFinishes(settings: StudioSettings, scope: ArtScope) { return finishLevelOptions.filter((finish) => isPricedCombination(settings, scope, finish)); }

export function getSelectedMultiplierRange(settings: StudioSettings, commission: Pick<Commission, "isRush" | "rushLevel" | "licenses">): MultiplierRange {
  const candidates: MultiplierRange[] = [{ min: 1, max: 1 }];
  if (commission.isRush) candidates.push(settings.rushMultiplierRanges[commission.rushLevel] ?? { min: 1, max: 1 });
  (commission.licenses ?? []).forEach((license) => candidates.push(settings.licenseMultiplierRanges[license] ?? { min: 1, max: 1 }));
  return [...candidates].sort((a, b) => b.max - a.max || b.min - a.min)[0];
}

export function getDefaultMultiplier(settings: StudioSettings, commission: Pick<Commission, "isRush" | "rushLevel" | "licenses">) { return getSelectedMultiplierRange(settings, commission).min; }
export function getMaximumMultiplier(settings: StudioSettings, commission: Pick<Commission, "isRush" | "rushLevel" | "licenses">) { return getSelectedMultiplierRange(settings, commission).max; }

export function calculateCommissionPricing(settings: StudioSettings, commission: Commission) {
  const items = getArtworkItems(commission);
  const calculatedBase = items.reduce((total, item) => total + (settings.combinationPrices[item.artScope]?.[item.finishLevel] ?? 0) * Math.max(1, item.characterCount || 1), 0);
  const range = getSelectedMultiplierRange(settings, commission);
  const multiplier = Math.min(range.max, Math.max(range.min, commission.rushMultiplier ?? range.min));
  const basePrice = roundCurrency((calculatedBase || (!items.length ? commission.basePriceMin ?? 0 : 0)) * multiplier);
  const deposit = roundCurrency(basePrice / 2);
  const quote = roundCurrency((commission.estimatedPrice ?? 0) * multiplier);
  const balance = roundCurrency(Math.max(quote - deposit, 0));
  const additionalQuote = roundCurrency((commission.additionalAmount ?? 0) * multiplier);
  return { basePrice, deposit, defaultMultiplier: range.min, maxMultiplier: range.max, multiplier, quote, balance, additionalQuote, total: roundCurrency(quote + additionalQuote) };
}

export function applyAutomaticPricing(settings: StudioSettings, commission: Commission): Commission {
  const pricing = calculateCommissionPricing(settings, commission);
  return { ...commission, rushMultiplier: pricing.multiplier, basePriceMin: pricing.basePrice, basePriceMax: pricing.basePrice, basePriceText: String(pricing.basePrice), depositAmount: pricing.deposit, depositText: String(pricing.deposit), finalPrice: pricing.quote, finalPriceText: String(pricing.quote), balanceAmount: pricing.balance, additionalQuoteAmount: pricing.additionalQuote, totalAmount: pricing.total };
}

export function getDeliveryTier(dueDate: number | null, now = Date.now()) {
  if (!dueDate) return "不指定";
  const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setUTCHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / DAY_MS);
  if (days <= 0) return "當天";
  if (days <= 7) return "一週內";
  if (days <= 30) return "一個月內";
  return "排單最後日期內";
}

export function isPrivacyReminderDue(commission: Pick<Commission, "privacyMode" | "privacyUntil">, now = Date.now()) {
  return commission.privacyMode === "until" && Boolean(commission.privacyUntil && commission.privacyUntil <= now);
}

export function prioritizeRecentCommissions(items: Commission[], now = Date.now()) {
  const lastQueuedWeek = getLastQueuedWeek(items);
  const urgent = (commission: Commission) => commission.scheduleType !== "reservation" && (commission.isRush || Boolean(autoDetectRushLevel(commission.dueDate, lastQueuedWeek, now)));
  return [...items].sort((a, b) => Number(urgent(b)) - Number(urgent(a)) || (a.dueDate ?? Number.MAX_SAFE_INTEGER) - (b.dueDate ?? Number.MAX_SAFE_INTEGER) || (getCommissionScheduleWeek(a) ?? Number.MAX_SAFE_INTEGER) - (getCommissionScheduleWeek(b) ?? Number.MAX_SAFE_INTEGER) || a.createdAt - b.createdAt);
}

export function enableRushWithDefault(commission: Commission) {
  return { ...commission, isRush: true, rushLevel: rushLevelOptions[0] };
}

export function getQueuePositionShifts(items: Commission[], month: string, position: number, excludedId?: string) { if (!month || position < 1) return []; return items.filter((item) => item.id !== excludedId && item.queueMonth === month && item.queuePosition >= position).sort((a, b) => b.queuePosition - a.queuePosition || b.createdAt - a.createdAt).map((item) => ({ id: item.id, queuePosition: item.queuePosition + 1 })); }
export function displayPrice(commission: Commission) { return commission.depositText || commission.finalPriceText ? `${commission.depositText || formatCurrency(commission.depositAmount)}/${commission.finalPriceText || formatCurrency(commission.finalPrice)}` : commission.basePriceText || formatCurrency(commission.basePriceMin); }
export function formatDateTime(value: number | null | undefined) { return !value ? "尚未記錄" : new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(value); }
export function withStatusTransition(commission: Commission, nextStatus: CommissionStatus, note?: string, at = Date.now()) { return { ...commission, status: nextStatus, statusHistory: [...(commission.statusHistory ?? []), { status: nextStatus, at, ...(note ? { note } : {}) }], completedAt: nextStatus === "completed" ? at : null, updatedAt: at }; }
