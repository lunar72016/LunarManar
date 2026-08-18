import { artScopeOptions, finishLevelOptions } from "@/lib/commission";
import type { LicenseOption } from "@/lib/commission";

export type StudioSettings = {
  studioName: string;
  combinationPrices: Record<string, Record<string, number>>;
  rushMultipliers: Record<string, number>;
  licenseMultipliers: Record<LicenseOption, number>;
  updatedAt: number;
};

function createCombinationPrices() {
  return Object.fromEntries(artScopeOptions.map((scope) => [scope, Object.fromEntries(finishLevelOptions.map((finish) => [finish, 0]))]));
}

export const defaultStudioSettings = (): StudioSettings => ({
  studioName: "繪月錄",
  combinationPrices: createCombinationPrices(),
  rushMultipliers: { "一般加急": 1, "中度加急": 1, "高度加急": 1, "極限加急": 1 },
  licenseMultipliers: { commercial: 1, promotion: 1, buyout: 1 },
  updatedAt: Date.now(),
});

export function normalizeStudioSettings(value: Partial<StudioSettings> | undefined) {
  const fallback = defaultStudioSettings();
  return {
    ...fallback,
    ...value,
    combinationPrices: Object.fromEntries(artScopeOptions.map((scope) => [
      scope,
      Object.fromEntries(finishLevelOptions.map((finish) => [finish, value?.combinationPrices?.[scope]?.[finish] ?? fallback.combinationPrices[scope][finish]])),
    ])),
    rushMultipliers: { ...fallback.rushMultipliers, ...value?.rushMultipliers },
    licenseMultipliers: { ...fallback.licenseMultipliers, ...value?.licenseMultipliers },
  };
}
