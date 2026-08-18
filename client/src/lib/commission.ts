import type { StudioSettings } from "@/lib/studioSettings";

export const commissionStatuses = [
  "inquiry",
  "confirmed",
  "awaiting_deposit",
  "queued",
  "sketching",
  "sketch_confirmed",
  "awaiting_balance",
  "finalizing",
  "completed",
] as const;

export type CommissionStatus = (typeof commissionStatuses)[number];
export type PaymentState = "paid" | "unpaid" | "unrecorded";
export type LicenseOption = "commercial" | "promotion" | "buyout";

export type StatusHistoryEntry = {
  status: CommissionStatus;
  at: number;
  note?: string;
};

export type Commission = {
  id: string;
  orderCode: string;
  clientName: string;
  contactChannel: string;
  contactHandle: string;
  queueMonth: string;
  queuePosition: number;
  characterCount: number;
  artScopes: string[];
  customArtScope: string;
  finishLevels: string[];
  hasBackground: boolean;
  backgroundNote: string;
  requirements: string;
  isRush: boolean;
  rushLevel: string;
  licenses: LicenseOption[];
  rushFee: number | null;
  rushMultiplier: number | null;
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
  depositPaidAt: number | null;
  balancePaidAt: number | null;
  paymentMethod: string;
  paymentNote: string;
  status: CommissionStatus;
  statusHistory: StatusHistoryEntry[];
  sketchSentAt: number | null;
  sketchConfirmedAt: number | null;
  revisionNote: string;
  completedAt: number | null;
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

export const contactChannels = ["Facebook", "電子郵件", "Threads", "LINE", "Discord", "其他"];
export const artScopeOptions = ["大頭", "胸像", "半身", "全身", "立繪", "服設", "小卡", "其他"];
export const finishLevelOptions = ["塗鴉", "鋪色", "重點色", "一般", "一般上色", "精緻", "寫實"];
export const rushLevelOptions = ["一般加急", "中度加急", "高度加急", "極限加急"];

export const createBlankCommission = (): Commission => {
  const now = Date.now();
  return {
    id: "",
    orderCode: "",
    clientName: "",
    contactChannel: "Facebook",
    contactHandle: "",
    queueMonth: new Date().toISOString().slice(0, 7),
    queuePosition: 0,
    characterCount: 1,
    artScopes: [],
    customArtScope: "",
    finishLevels: [],
    hasBackground: false,
    backgroundNote: "",
    requirements: "",
    isRush: false,
    rushLevel: "一般加急",
    licenses: [],
    rushFee: null,
    rushMultiplier: null,
    basePriceMin: null,
    basePriceMax: null,
    basePriceText: "",
    depositAmount: null,
    depositText: "",
    finalPrice: null,
    finalPriceText: "",
    balanceAmount: null,
    estimatedPrice: null,
    additionalAmount: null,
    additionalQuoteAmount: null,
    totalAmount: null,
    depositState: "unpaid",
    balanceState: "unpaid",
    depositPaidAt: null,
    balancePaidAt: null,
    paymentMethod: "",
    paymentNote: "",
    status: "inquiry",
    statusHistory: [{ status: "inquiry", at: now }],
    sketchSentAt: null,
    sketchConfirmedAt: null,
    revisionNote: "",
    completedAt: null,
    shareEnabled: false,
    shareTokenHash: null,
    shareExpiresAt: null,
    sourceNote: "",
    createdAt: now,
    updatedAt: now,
  };
};

function initialRecord(
  index: number,
  queueMonth: string,
  clientName: string,
  content: string,
  finish: string,
  price: string,
  sourceNote = "",
): Commission {
  const now = Date.now() - (30 - index) * 60_000;
  const [depositRaw = "", finalRaw = ""] = price.split("/");
  const parseNumeric = (value: string) => {
    const matched = value.match(/\d+(?:\.\d+)?/);
    return matched ? Number(matched[0]) : null;
  };
  const depositAmount = price.includes("/") ? parseNumeric(depositRaw) : null;
  const finalPrice = price.includes("/") && /^\d+[+↓]?$/.test(finalRaw) ? parseNumeric(finalRaw) : null;
  const baseText = price.includes("/") ? "" : price;
  const blank = createBlankCommission();
  return {
    ...blank,
    id: `seed-${queueMonth}-${index}`,
    orderCode: `${queueMonth.replace("-", "")}-${String(index + 1).padStart(2, "0")}`,
    clientName,
    contactChannel: "其他",
    queueMonth,
    queuePosition: index + 1,
    characterCount: content.includes("雙人") ? 2 : 1,
    artScopes: [content],
    finishLevels: [finish],
    basePriceText: baseText,
    depositAmount,
    depositText: depositRaw,
    finalPrice,
    finalPriceText: finalRaw,
    balanceAmount: finalPrice !== null && depositAmount !== null ? Math.max(finalPrice - depositAmount, 0) : null,
    depositState: "unrecorded",
    balanceState: "unrecorded",
    status: "queued",
    statusHistory: [{ status: "queued", at: now, note: "由既有排單紀錄匯入；付款與工作進度待補登。" }],
    sourceNote: [sourceNote, `原始紀錄：${content}（${finish}）${price}`].filter(Boolean).join(" · "),
    createdAt: now,
    updatedAt: now,
  };
}

export const initialCommissions: Commission[] = [
  initialRecord(0, "2026-08", "辣椒", "半身", "鋪色", "5200", "8/16"),
  initialRecord(1, "2026-08", "Tiffany Su", "雙人水族", "一般", "5600"),
  initialRecord(2, "2026-08", "けい", "雙人大頭", "一般", "800/1600+"),
  initialRecord(3, "2026-08", "洛初終", "雙人胸像", "重點色", "900/1800+"),
  initialRecord(4, "2026-08", "檸檬", "雙人", "塗鴉", "2000/4-5000"),
  initialRecord(5, "2026-08", "99oo", "胸像＋服設", "重點色", "400/1500↓"),
  initialRecord(6, "2026-08", "墨蝶", "雙人", "塗鴉", "2000/3500-4500"),
  initialRecord(7, "2026-08", "崔塵", "未定", "精緻", "1500/?"),
  initialRecord(8, "2026-09", "歐津恩", "全身", "寫實", "6500/?"),
  initialRecord(9, "2026-09", "cho.o_min", "小卡", "一般", "700/1400+"),
  initialRecord(10, "2026-09", "洛初終", "雙人服設", "一般上色", "6200/12400+"),
  initialRecord(11, "2026-09", "Hong Chiang", "立繪、胸像", "塗鴉、一般", "1300/2600+"),
  initialRecord(12, "2026-09", "墨弦", "胸像", "一般上色", "500/1000+"),
  initialRecord(13, "2026-09", "何霖", "雙人", "重點色", "1000/2000+"),
];

export function monthLabel(month: string) {
  const [year, rawMonth] = month.split("-");
  const monthNumber = Number(rawMonth);
  return year ? `${year} 年 ${monthNumber} 月` : "未排定月份";
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(value);
}

function roundCurrency(value: number) {
  return Math.round(value);
}

export function getDefaultMultiplier(settings: StudioSettings, commission: Pick<Commission, "isRush" | "rushLevel" | "licenses">) {
  const candidates = [1];
  if (commission.isRush) candidates.push(settings.rushMultipliers[commission.rushLevel] ?? 1);
  (commission.licenses ?? []).forEach((license) => candidates.push(settings.licenseMultipliers[license] ?? 1));
  return Math.max(...candidates);
}

export function calculateCommissionPricing(settings: StudioSettings, commission: Commission) {
  const basePrice = roundCurrency((commission.artScopes ?? []).reduce((scopeTotal, scope) => {
    return scopeTotal + (commission.finishLevels ?? []).reduce((finishTotal, finish) => finishTotal + (settings.combinationPrices[scope]?.[finish] ?? 0), 0);
  }, 0));
  const deposit = roundCurrency(basePrice / 2);
  const defaultMultiplier = getDefaultMultiplier(settings, commission);
  const multiplier = commission.rushMultiplier && commission.rushMultiplier > 0 ? commission.rushMultiplier : defaultMultiplier;
  const quote = roundCurrency((commission.estimatedPrice ?? 0) * multiplier);
  const balance = roundCurrency(Math.max(quote - deposit, 0));
  const additionalQuote = roundCurrency((commission.additionalAmount ?? 0) * multiplier);
  const total = roundCurrency(quote + additionalQuote);
  return { basePrice, deposit, defaultMultiplier, multiplier, quote, balance, additionalQuote, total };
}

export function applyAutomaticPricing(settings: StudioSettings, commission: Commission): Commission {
  const pricing = calculateCommissionPricing(settings, commission);
  return {
    ...commission,
    rushMultiplier: pricing.multiplier,
    basePriceMin: pricing.basePrice,
    basePriceMax: pricing.basePrice,
    basePriceText: String(pricing.basePrice),
    depositAmount: pricing.deposit,
    depositText: String(pricing.deposit),
    finalPrice: pricing.quote,
    finalPriceText: String(pricing.quote),
    balanceAmount: pricing.balance,
    additionalQuoteAmount: pricing.additionalQuote,
    totalAmount: pricing.total,
  };
}

export function getQueuePositionShifts(items: Commission[], month: string, position: number, excludedId?: string) {
  if (!month || position < 1) return [];
  return items
    .filter((item) => item.id !== excludedId && item.queueMonth === month && item.queuePosition >= position)
    .sort((a, b) => b.queuePosition - a.queuePosition || b.createdAt - a.createdAt)
    .map((item) => ({ id: item.id, queuePosition: item.queuePosition + 1 }));
}

export function displayPrice(commission: Commission) {
  if (commission.depositText || commission.finalPriceText) {
    return `${commission.depositText || formatCurrency(commission.depositAmount)}/${commission.finalPriceText || formatCurrency(commission.finalPrice)}`;
  }
  return commission.basePriceText || formatCurrency(commission.basePriceMin);
}

export function formatDateTime(value: number | null | undefined) {
  if (!value) return "尚未記錄";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function withStatusTransition(commission: Commission, nextStatus: CommissionStatus, note?: string, at = Date.now()) {
  return {
    ...commission,
    status: nextStatus,
    statusHistory: [
      ...(commission.statusHistory ?? []),
      { status: nextStatus, at, ...(note ? { note } : {}) },
    ],
    completedAt: nextStatus === "completed" ? at : null,
    updatedAt: at,
  };
}
