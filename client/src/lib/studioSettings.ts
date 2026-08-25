import { artScopeOptions, finishLevelOptions, qSizeOptions, type LicenseOption, type QSize } from "@/lib/commission";
import type { PushNotificationScope } from "@/lib/pushNotifications";

export type MultiplierRange = { min: number; max: number };
export type StudioSettings = {
  studioName: string;
  combinationPrices: Record<string, Record<string, number | null>>;
  /** Q 版不沿用精緻度，而是以表情貼、2 頭身、2.5 頭身分別定價。 */
  qVariantPrices: Record<QSize, number | null>;
  rushMultiplierRanges: Record<string, MultiplierRange>;
  licenseMultiplierRanges: Record<LicenseOption, MultiplierRange>;
  /** 背景通知試用時，預設全部新函件；可隨時收斂為僅加急。 */
  pushNotificationScope: PushNotificationScope;
  pushTrialStartedAt: number | null;
  updatedAt: number;
};

const defaultRange = (): MultiplierRange => ({ min: 1, max: 1 });
const createCombinationPrices = () => Object.fromEntries(artScopeOptions.map((scope) => [scope, Object.fromEntries(finishLevelOptions.map((finish) => [finish, null]))]));

export const defaultStudioSettings = (): StudioSettings => ({
  studioName: "繪月錄",
  combinationPrices: createCombinationPrices(),
  qVariantPrices: Object.fromEntries(qSizeOptions.map((variant) => [variant, null])) as Record<QSize, number | null>,
  rushMultiplierRanges: { "一般加急": defaultRange(), "中度加急": defaultRange(), "高度加急": defaultRange(), "極限加急": defaultRange() },
  licenseMultiplierRanges: { commercial: defaultRange(), promotion: defaultRange(), buyout: defaultRange() },
  pushNotificationScope: "all",
  pushTrialStartedAt: null,
  updatedAt: Date.now(),
});

function normalizeRange(value: MultiplierRange | number | undefined): MultiplierRange {
  if (typeof value === "number") return { min: value, max: value };
  const min = Number(value?.min);
  const max = Number(value?.max);
  return { min: Number.isFinite(min) && min >= 1 ? min : 1, max: Number.isFinite(max) && max >= min ? max : Number.isFinite(min) && min >= 1 ? min : 1 };
}

export function normalizeStudioSettings(value: Partial<StudioSettings> & { rushMultipliers?: Record<string, number>; licenseMultipliers?: Record<LicenseOption, number> } | undefined): StudioSettings {
  const fallback = defaultStudioSettings();
  return {
    ...fallback,
    ...value,
    combinationPrices: Object.fromEntries(artScopeOptions.map((scope) => [scope, Object.fromEntries(finishLevelOptions.map((finish) => {
      const current = value?.combinationPrices?.[scope]?.[finish];
      return [finish, typeof current === "number" && current > 0 ? current : null];
    }))])),
    qVariantPrices: Object.fromEntries(qSizeOptions.map((variant) => {
      const current = value?.qVariantPrices?.[variant];
      return [variant, typeof current === "number" && current > 0 ? current : null];
    })) as Record<QSize, number | null>,
    rushMultiplierRanges: Object.fromEntries(Object.keys(fallback.rushMultiplierRanges).map((key) => [key, normalizeRange(value?.rushMultiplierRanges?.[key] ?? value?.rushMultipliers?.[key])])),
    licenseMultiplierRanges: Object.fromEntries((Object.keys(fallback.licenseMultiplierRanges) as LicenseOption[]).map((key) => [key, normalizeRange(value?.licenseMultiplierRanges?.[key] ?? value?.licenseMultipliers?.[key])])) as Record<LicenseOption, MultiplierRange>,
    pushNotificationScope: value?.pushNotificationScope === "rush" ? "rush" : "all",
    pushTrialStartedAt: typeof value?.pushTrialStartedAt === "number" && Number.isFinite(value.pushTrialStartedAt) ? value.pushTrialStartedAt : null,
  };
}
