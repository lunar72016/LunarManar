import { describe, expect, it } from "vitest";
import { artScopeOptions, finishLevelOptions } from "./commission";
import { defaultStudioSettings, normalizeStudioSettings } from "./studioSettings";

describe("studio settings without avatar storage", () => {
  it("defaults to the 繪月錄 studio name without storing a remote avatar URL", () => {
    const settings = defaultStudioSettings();

    expect(settings.studioName).toBe("繪月錄");
    expect("avatarUrl" in settings).toBe(false);
  });

  it("keeps price and multiplier settings when normalizing existing Firestore data", () => {
    const settings = normalizeStudioSettings({
      studioName: "月下畫案",
      rushMultiplierRanges: { "一般加急": { min: 1.25, max: 1.5 } },
    });

    expect(settings.studioName).toBe("月下畫案");
    expect(settings.rushMultiplierRanges["一般加急"]).toEqual({ min: 1.25, max: 1.5 });
    expect(settings.licenseMultiplierRanges.buyout).toEqual({ min: 1, max: 1 });
  });

  it("uses the revised art options and starts standard combinations and Q 版規格 as unavailable", () => {
    const settings = defaultStudioSettings();

    expect(finishLevelOptions).toContain("線稿");
    expect(finishLevelOptions).not.toContain("一般上色");
    expect(artScopeOptions).toEqual(["大頭", "胸像", "半身", "全身", "服設", "特寫-眼睛", "特寫-手", "Q版"]);
    expect(settings.combinationPrices["大頭"]["一般"]).toBeNull();
    expect(settings.qVariantPrices).toEqual({ "表情貼": null, "2頭身": null, "2.5頭身": null });
  });

  it("defaults notification scope to all new intakes and retains a later rush-only choice", () => {
    expect(defaultStudioSettings().pushNotificationScope).toBe("all");
    expect(normalizeStudioSettings({ pushNotificationScope: "rush", pushTrialStartedAt: 123 }).pushNotificationScope).toBe("rush");
    expect(normalizeStudioSettings({ pushNotificationScope: "rush", pushTrialStartedAt: 123 }).pushTrialStartedAt).toBe(123);
  });
});
