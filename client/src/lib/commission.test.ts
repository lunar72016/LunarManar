import { describe, expect, it } from "vitest";
import { applyAutomaticPricing, createBlankCommission, displayPrice, getQueuePositionShifts, initialCommissions, statusMeta, withStatusTransition } from "./commission";
import { defaultStudioSettings } from "./studioSettings";

describe("commission domain model", () => {
  it("prepares all fourteen existing commission records for initial import", () => {
    expect(initialCommissions).toHaveLength(14);
    expect(initialCommissions.filter((item) => item.queueMonth === "2026-08")).toHaveLength(8);
    expect(initialCommissions.filter((item) => item.queueMonth === "2026-09")).toHaveLength(6);
  });

  it("preserves special price notation while retaining calculable payment values", () => {
    const item = initialCommissions.find((commission) => commission.clientName === "99oo");
    expect(item?.depositAmount).toBe(400);
    expect(item?.finalPrice).toBe(1500);
    expect(item?.balanceAmount).toBe(1100);
    expect(item && displayPrice(item)).toBe("400/1500↓");
  });

  it("starts a new commission at the inquiry stage with a timestamped history entry", () => {
    const commission = createBlankCommission();
    expect(commission.status).toBe("inquiry");
    expect(commission.statusHistory).toHaveLength(1);
    expect(commission.statusHistory[0]?.status).toBe("inquiry");
    expect(commission.depositState).toBe("unpaid");
  });

  it("defines the final delivery status for work completion", () => {
    expect(statusMeta.completed.label).toBe("完稿");
  });

  it("records a timestamped transition when a commission is advanced or manually returned", () => {
    const initial = createBlankCommission();
    const advanced = withStatusTransition(initial, "queued", "訂金確認", 1_700_000_000_000);
    const returned = withStatusTransition(advanced, "awaiting_deposit", "委託人需補登訂金", 1_700_000_001_000);

    expect(advanced.status).toBe("queued");
    expect(advanced.statusHistory).toHaveLength(2);
    expect(returned.status).toBe("awaiting_deposit");
    expect(returned.statusHistory.at(-1)).toMatchObject({ status: "awaiting_deposit", at: 1_700_000_001_000 });

    const completed = withStatusTransition(returned, "completed", "已返圖", 1_700_000_002_000);
    const reopened = withStatusTransition(completed, "finalizing", "發現設定需校正", 1_700_000_003_000);
    expect(completed.completedAt).toBe(1_700_000_002_000);
    expect(reopened.completedAt).toBeNull();
  });

  it("adds every selected range and finish combination, then applies only the highest selected multiplier", () => {
    const settings = defaultStudioSettings();
    settings.combinationPrices["胸像"]["一般"] = 1000;
    settings.combinationPrices["胸像"]["精緻"] = 1400;
    settings.combinationPrices["半身"]["一般"] = 1600;
    settings.combinationPrices["半身"]["精緻"] = 2100;
    settings.rushMultipliers["高度加急"] = 1.5;
    settings.licenseMultipliers.commercial = 1.25;
    settings.licenseMultipliers.buyout = 2;

    const commission = createBlankCommission();
    commission.artScopes = ["胸像", "半身"];
    commission.finishLevels = ["一般", "精緻"];
    commission.isRush = true;
    commission.rushLevel = "高度加急";
    commission.licenses = ["commercial", "buyout"];
    commission.estimatedPrice = 3000;
    commission.additionalAmount = 500;
    const priced = applyAutomaticPricing(settings, commission);

    expect(priced.basePriceMin).toBe(6100);
    expect(priced.depositAmount).toBe(3050);
    expect(priced.rushMultiplier).toBe(2);
    expect(priced.finalPrice).toBe(6000);
    expect(priced.balanceAmount).toBe(2950);
    expect(priced.additionalQuoteAmount).toBe(1000);
    expect(priced.totalAmount).toBe(7000);

    const licenseOnly = createBlankCommission();
    licenseOnly.licenses = ["buyout"];
    licenseOnly.estimatedPrice = 1000;
    const licensePriced = applyAutomaticPricing(settings, licenseOnly);
    expect(licensePriced.rushMultiplier).toBe(2);
    expect(applyAutomaticPricing(settings, { ...licensePriced, rushMultiplier: 1.75 }).finalPrice).toBe(1750);
  });

  it("shifts existing commissions back when a duplicate monthly position is saved", () => {
    const first = { ...createBlankCommission(), id: "first", queueMonth: "2026-08", queuePosition: 1, createdAt: 1 };
    const second = { ...createBlankCommission(), id: "second", queueMonth: "2026-08", queuePosition: 2, createdAt: 2 };
    const otherMonth = { ...createBlankCommission(), id: "other", queueMonth: "2026-09", queuePosition: 1, createdAt: 3 };

    expect(getQueuePositionShifts([first, second, otherMonth], "2026-08", 1)).toEqual([
      { id: "second", queuePosition: 3 },
      { id: "first", queuePosition: 2 },
    ]);
  });
});
