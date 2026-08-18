import { describe, expect, it } from "vitest";
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
      rushMultipliers: { "一般加急": 1.25 },
    });

    expect(settings.studioName).toBe("月下畫案");
    expect(settings.rushMultipliers["一般加急"]).toBe(1.25);
    expect(settings.licenseMultipliers.buyout).toBe(1);
  });
});
