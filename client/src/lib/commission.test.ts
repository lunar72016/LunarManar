import { describe, expect, it } from "vitest";
import { addWeeks, applyAutomaticPricing, autoDetectRushLevel, countWorkdays, createArtworkItem, createBlankCommission, displayPrice, enableRushWithDefault, getAvailableFinishes, getAvailableScopes, getCommissionScheduleMonth, getDefaultScheduleWeekStart, getDeliveryTier, getLastQueuedWeek, getQueuePositionShifts, groupQueuedCommissionsByMonth, initialCommissions, isPrivacyReminderDue, prioritizeRecentCommissions, rushLevelOptions, shouldConvertReservation, sortCommissionsForSchedule, startOfWeek, statusMeta, weekLabel, withStatusTransition } from "./commission";
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
    expect(commission.additionalState).toBe("unrecorded");
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

  it("adds each artwork item independently and applies the minimum of the highest selected multiplier range", () => {
    const settings = defaultStudioSettings();
    settings.combinationPrices["胸像"]["一般"] = 1000;
    settings.combinationPrices["半身"]["精緻"] = 2100;
    settings.rushMultiplierRanges["高度加急"] = { min: 1.3, max: 1.7 };
    settings.licenseMultiplierRanges.commercial = { min: 1.25, max: 1.5 };
    settings.licenseMultiplierRanges.buyout = { min: 1.8, max: 2.2 };

    const commission = createBlankCommission();
    commission.artworkItems = [
      createArtworkItem({ artScope: "胸像", finishLevel: "一般" }),
      createArtworkItem({ artScope: "半身", finishLevel: "精緻" }),
    ];
    commission.isRush = true;
    commission.rushLevel = "高度加急";
    commission.licenses = ["commercial", "buyout"];
    commission.estimatedPrice = 3000;
    commission.additionalAmount = 500;
    const priced = applyAutomaticPricing(settings, commission);

    expect(priced.basePriceMin).toBe(5580);
    expect(priced.depositAmount).toBe(2790);
    expect(priced.rushMultiplier).toBe(1.8);
    expect(priced.finalPrice).toBe(5400);
    expect(priced.balanceAmount).toBe(2610);
    expect(priced.additionalQuoteAmount).toBe(900);
    expect(priced.totalAmount).toBe(6300);

    const licenseOnly = createBlankCommission();
    licenseOnly.licenses = ["buyout"];
    licenseOnly.estimatedPrice = 1000;
    const licensePriced = applyAutomaticPricing(settings, licenseOnly);
    expect(licensePriced.rushMultiplier).toBe(1.8);
    expect(applyAutomaticPricing(settings, { ...licensePriced, rushMultiplier: 2.1 }).finalPrice).toBe(2100);
    expect(applyAutomaticPricing(settings, { ...licensePriced, rushMultiplier: 3 }).rushMultiplier).toBe(2.2);
  });

  it("multiplies each configured base price by the artwork item character count", () => {
    const settings = defaultStudioSettings();
    settings.combinationPrices["胸像"]["一般"] = 1000;
    const commission = createBlankCommission();
    commission.artworkItems = [createArtworkItem({ artScope: "胸像", finishLevel: "一般", characterCount: 3 })];

    const priced = applyAutomaticPricing(settings, commission);
    expect(priced.basePriceMin).toBe(3000);
    expect(priced.depositAmount).toBe(1500);
  });

  it("only exposes scopes and finishes with an explicit configured price", () => {
    const settings = defaultStudioSettings();
    settings.combinationPrices["大頭"]["一般"] = 800;
    settings.combinationPrices["Q版"]["線稿"] = 600;

    expect(getAvailableScopes(settings)).toEqual(["大頭", "Q版"]);
    expect(getAvailableFinishes(settings, "大頭")).toEqual(["一般"]);
    expect(getAvailableFinishes(settings, "Q版")).toEqual(["線稿"]);
  });

  it("classifies a requested delivery date into the four rush guidance tiers", () => {
    const now = new Date("2026-08-01T08:00:00Z").getTime();
    expect(getDeliveryTier(now, now)).toBe("當天");
    expect(getDeliveryTier(now + 86_400_000, now)).toBe("一週內");
    expect(getDeliveryTier(now + 7 * 86_400_000, now)).toBe("一週內");
    expect(getDeliveryTier(now + 30 * 86_400_000, now)).toBe("一個月內");
    expect(getDeliveryTier(now + 31 * 86_400_000, now)).toBe("排單最後日期內");
  });

  it("shows a reminder once a selected privacy deadline arrives", () => {
    const commission = createBlankCommission();
    commission.privacyMode = "until";
    commission.privacyUntil = 1_700_000_000_000;

    expect(isPrivacyReminderDue(commission, 1_699_999_999_999)).toBe(false);
    expect(isPrivacyReminderDue(commission, 1_700_000_000_000)).toBe(true);
  });

  it("places rush or close-due commissions ahead of ordinary queued work", () => {
    const ordinary = { ...createBlankCommission(), id: "ordinary", status: "queued" as const, queuePosition: 1, dueDate: null, createdAt: 1 };
    const closeDue = { ...createBlankCommission(), id: "close", status: "queued" as const, queuePosition: 3, dueDate: 1_700_086_400_000, createdAt: 3 };
    const markedRush = { ...createBlankCommission(), id: "rush", status: "queued" as const, queuePosition: 2, isRush: true, createdAt: 2 };

    expect(prioritizeRecentCommissions([ordinary, closeDue, markedRush], 1_700_000_000_000).map((item) => item.id)).toEqual(["close", "rush", "ordinary"]);
  });

  it("automatically selects the default rush tier when rush is enabled", () => {
    const rushed = enableRushWithDefault({ ...createBlankCommission(), rushLevel: "極限加急" });
    expect(rushed).toMatchObject({ isRush: true, rushLevel: rushLevelOptions[0] });
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

  it("calculates stable weekly labels and defaults new work to two weeks after the last ordinary queue", () => {
    const augustFirstWeek = startOfWeek(Date.UTC(2026, 7, 4));
    const septemberSecondWeek = startOfWeek(Date.UTC(2026, 8, 8));
    const queued = { ...createBlankCommission(), scheduleWeekStart: septemberSecondWeek, scheduleType: "queued" as const };
    const reservation = { ...createBlankCommission(), scheduleWeekStart: addWeeks(septemberSecondWeek, 4), scheduleType: "reservation" as const };

    expect(weekLabel(augustFirstWeek)).toBe("8月第一週");
    expect(getLastQueuedWeek([queued, reservation])).toBe(septemberSecondWeek);
    expect(getDefaultScheduleWeekStart([queued, reservation])).toBe(addWeeks(septemberSecondWeek, 2));
  });

  it("preserves a manually selected queue month and otherwise derives it from the scheduled week", () => {
    const octoberWeek = startOfWeek(Date.UTC(2026, 9, 12));
    expect(getCommissionScheduleMonth({ ...createBlankCommission(), queueMonth: "2026-09", queueMonthManual: true, scheduleWeekStart: octoberWeek })).toBe("2026-09");
    expect(getCommissionScheduleMonth({ ...createBlankCommission(), queueMonth: "2026-08", queueMonthManual: false, scheduleWeekStart: octoberWeek })).toBe("2026-10");
  });

  it("groups August, September, and October work in their selected schedule months", () => {
    const august = { ...createBlankCommission(), id: "august", queueMonth: "2026-08", queueMonthManual: true };
    const september = { ...createBlankCommission(), id: "september", queueMonth: "2026-09", queueMonthManual: true };
    const october = { ...createBlankCommission(), id: "october", queueMonth: "2026-10", queueMonthManual: true };

    expect(Object.keys(groupQueuedCommissionsByMonth([august, september, october])).sort()).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("honors manually entered monthly queue positions before creation time", () => {
    const laterCreatedFirst = { ...createBlankCommission(), id: "first", queueMonth: "2026-10", queueMonthManual: true, queuePosition: 1, createdAt: 30 };
    const earlierCreatedSecond = { ...createBlankCommission(), id: "second", queueMonth: "2026-10", queueMonthManual: true, queuePosition: 2, createdAt: 10 };

    expect(sortCommissionsForSchedule([earlierCreatedSecond, laterCreatedFirst]).map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("only converts a reservation once ordinary queue has reached the prior week", () => {
    const queuedWeek = startOfWeek(Date.UTC(2026, 8, 7));
    const reservation = { ...createBlankCommission(), scheduleType: "reservation" as const, scheduleWeekStart: addWeeks(queuedWeek, 2) };

    expect(shouldConvertReservation(reservation, queuedWeek)).toBe(false);
    expect(shouldConvertReservation(reservation, addWeeks(queuedWeek, 1))).toBe(true);
  });

  it("counts Monday to Friday workdays inclusively without weekends", () => {
    expect(countWorkdays(Date.UTC(2026, 7, 3), Date.UTC(2026, 7, 9))).toBe(5);
    expect(countWorkdays(Date.UTC(2026, 7, 8), Date.UTC(2026, 7, 9))).toBe(0);
  });

  it("derives rush levels from a due date and the final ordinary queue week", () => {
    const now = Date.UTC(2026, 7, 1);
    const lastQueuedWeek = startOfWeek(Date.UTC(2026, 8, 14));

    expect(autoDetectRushLevel(now, lastQueuedWeek, now)).toBe("極限加急");
    expect(autoDetectRushLevel(now + 7 * 86_400_000, lastQueuedWeek, now)).toBe("高度加急");
    expect(autoDetectRushLevel(now + 8 * 86_400_000, lastQueuedWeek, now)).toBe("中度加急");
    expect(autoDetectRushLevel(now + 40 * 86_400_000, lastQueuedWeek, now)).toBe("一般加急");
    expect(autoDetectRushLevel(now + 70 * 86_400_000, lastQueuedWeek, now)).toBeNull();
  });
});
