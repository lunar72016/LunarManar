import { describe, expect, it } from "vitest";
import { addWeeks, applyAutomaticPricing, applyRushDecision, archiveCommission, autoDetectRushLevel, countWorkdays, createArtworkItem, createBlankCommission, displayPrice, enableRushWithDefault, filterArchivedCommissions, formatDateInput, formatDisplayDate, getAvailableFinishes, getAvailableQSizes, getAvailableScopes, getCommissionScheduleMonth, getDefaultScheduleWeekStart, getDeliveryTier, getLastQueuedWeek, getQueuePositionShifts, groupCommissionCollections, groupQueuedCommissionsByMonth, initialCommissions, isDateAfter, isPrivacyReminderDue, parseGregorianDate, prioritizeRecentCommissions, restoreArchivedCommission, rushLevelOptions, shouldConvertReservation, sortCommissionsForSchedule, startOfWeek, statusMeta, weekLabel, withStatusTransition } from "./commission";
import { defaultStudioSettings } from "./studioSettings";

describe("commission domain model", () => {
	  it("prepares all fourteen existing commission records for initial import", () => {
	    expect(initialCommissions).toHaveLength(14);
	    expect(initialCommissions.filter((item) => item.queueMonth === "2026-08")).toHaveLength(8);
	    expect(initialCommissions.filter((item) => item.queueMonth === "2026-09")).toHaveLength(6);
	  });

	  it("formats stored dates as explicit Gregorian year, month, and day", () => {
	    const augustFifth = new Date(2026, 7, 5, 12).getTime();
	    expect(formatDisplayDate(augustFifth)).toBe("2026年08月05日");
	    expect(formatDateInput(augustFifth)).toBe("2026/08/05");
	    expect(formatDateInput(null)).toBe("yyyy/mm/dd");
	    expect(formatDisplayDate(null)).toBe("未設定");
	    expect(parseGregorianDate("2026年08月05日")).toBe(augustFifth);
	    expect(parseGregorianDate("2026/08/05")).toBe(augustFifth);
	    expect(parseGregorianDate("2026年02月30日")).toBeNull();
	    expect(isDateAfter(new Date(2026, 7, 6).getTime(), augustFifth)).toBe(true);
	    expect(isDateAfter(augustFifth, new Date(2026, 7, 5, 23, 59).getTime())).toBe(false);
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

    expect(priced.basePriceMin).toBe(3100);
    expect(priced.depositAmount).toBe(2700);
    expect(priced.rushMultiplier).toBe(1.8);
    expect(priced.finalPrice).toBe(5400);
    expect(priced.balanceAmount).toBe(3600);
    expect(priced.additionalQuoteAmount).toBe(900);
    expect(priced.totalAmount).toBe(6300);

    const licenseOnly = createBlankCommission();
    licenseOnly.licenses = ["buyout"];
    licenseOnly.estimatedPrice = 1000;
    const licensePriced = applyAutomaticPricing(settings, licenseOnly);
    expect(licensePriced.rushMultiplier).toBe(1.8);
    expect(applyAutomaticPricing(settings, { ...licensePriced, rushMultiplier: 2.1 }).finalPrice).toBe(2100);
    expect(applyAutomaticPricing(settings, { ...licensePriced, rushMultiplier: 3 }).rushMultiplier).toBe(2.2);

    const changedOnce = applyAutomaticPricing(settings, { ...priced, rushMultiplier: 2 });
    const changedTwice = applyAutomaticPricing(settings, { ...changedOnce, rushMultiplier: 1.8 });
    expect(changedOnce.basePriceMin).toBe(3100);
    expect(changedOnce.depositAmount).toBe(3000);
    expect(changedTwice.basePriceMin).toBe(3100);
    expect(changedTwice.depositAmount).toBe(2700);

    const manualBase = { ...createBlankCommission(), basePriceMin: 1000, estimatedPrice: 1000, licenses: ["buyout"] as const };
    const manualFirst = applyAutomaticPricing(settings, manualBase);
    const manualRaised = applyAutomaticPricing(settings, { ...manualFirst, rushMultiplier: 2.1 });
    const manualReset = applyAutomaticPricing(settings, { ...manualRaised, rushMultiplier: 1.8 });
    expect(manualFirst.basePriceMin).toBe(1000);
    expect(manualFirst.depositAmount).toBe(900);
    expect(manualRaised.basePriceMin).toBe(1000);
    expect(manualRaised.depositAmount).toBe(1050);
    expect(manualReset.basePriceMin).toBe(1000);
    expect(manualReset.depositAmount).toBe(900);
  });

  it("multiplies each configured base price by the artwork item character count", () => {
    const settings = defaultStudioSettings();
    settings.combinationPrices["胸像"]["一般"] = 1000;
    const commission = createBlankCommission();
    commission.artworkItems = [createArtworkItem({ artScope: "胸像", finishLevel: "一般", characterCount: 3 })];
    commission.estimatedPrice = 3000;

    const priced = applyAutomaticPricing(settings, commission);
    expect(priced.basePriceMin).toBe(3000);
    expect(priced.depositAmount).toBe(1500);
  });

  it("only exposes configured standard combinations and independently priced Q 版規格", () => {
    const settings = defaultStudioSettings();
    settings.combinationPrices["大頭"]["一般"] = 800;
    settings.qVariantPrices["表情貼"] = 600;
    settings.qVariantPrices["2.5頭身"] = 1200;

    expect(getAvailableScopes(settings)).toEqual(["大頭", "Q版"]);
    expect(getAvailableFinishes(settings, "大頭")).toEqual(["一般"]);
    expect(getAvailableFinishes(settings, "Q版")).toEqual([]);
    expect(getAvailableQSizes(settings)).toEqual(["表情貼", "2.5頭身"]);
  });

  it("calculates Q 版 base price from its selected variant instead of a finish level", () => {
    const settings = defaultStudioSettings();
    settings.qVariantPrices["2.5頭身"] = 1200;
    const commission = createBlankCommission();
    commission.artworkItems = [createArtworkItem({ artScope: "Q版", qSize: "2.5頭身", finishLevel: "塗鴉", characterCount: 2 })];
    commission.estimatedPrice = 2400;

    const priced = applyAutomaticPricing(settings, commission);

    expect(priced.basePriceMin).toBe(2400);
    expect(priced.depositAmount).toBe(1200);
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

  it("archives a dormant case without affecting the ordinary queue and restores its original stage", () => {
    const queuedWeek = startOfWeek(Date.UTC(2026, 8, 7));
    const queued = { ...createBlankCommission(), id: "queued", status: "queued" as const, scheduleWeekStart: queuedWeek, queueMonth: "2026-09" };
    const archived = archiveCommission(queued, "委託人逾期未回覆", 1_700_000_000_000);

    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).toBe(1_700_000_000_000);
    expect(archived.archivedFromStatus).toBe("queued");
    expect(getLastQueuedWeek([archived])).toBeNull();
    expect(groupQueuedCommissionsByMonth([archived])).toEqual({});

    const restored = restoreArchivedCommission(archived, "委託人再次聯絡", 1_700_000_001_000);
    expect(restored.status).toBe("queued");
    expect(restored.archivedAt).toBeNull();
    expect(restored.archivedFromStatus).toBeNull();
    expect(restored.statusHistory.at(-1)).toMatchObject({ status: "queued", at: 1_700_000_001_000 });
  });

  it("searches, filters, and sorts archived records by the most recent archive date", () => {
    const inquiry = archiveCommission({ ...createBlankCommission(), id: "inquiry", clientName: "檸檬", orderCode: "A-001", status: "inquiry" }, "無回覆", 100);
    const queued = archiveCommission({ ...createBlankCommission(), id: "queued", clientName: "月白", orderCode: "B-002", status: "queued" }, "無回覆", 300);
    const completed = archiveCommission({ ...createBlankCommission(), id: "completed", clientName: "檸檬雙人圖", orderCode: "C-003", status: "completed" }, "無回覆", 200);

    expect(filterArchivedCommissions([inquiry, queued, completed]).map((item) => item.id)).toEqual(["queued", "completed", "inquiry"]);
    expect(filterArchivedCommissions([inquiry, queued, completed], "檸檬").map((item) => item.id)).toEqual(["completed", "inquiry"]);
    expect(filterArchivedCommissions([inquiry, queued, completed], "", "queued").map((item) => item.id)).toEqual(["queued"]);
  });

  it("separates active cases into queued, reservation, and completed collections", () => {
    const queued = { ...createBlankCommission(), id: "queued", status: "queued" as const, scheduleType: "queued" as const };
    const rush = { ...createBlankCommission(), id: "rush", status: "queued" as const, scheduleType: "queued" as const, isRush: true };
    const reservation = { ...createBlankCommission(), id: "reservation", status: "confirmed" as const, scheduleType: "reservation" as const };
    const completed = { ...createBlankCommission(), id: "completed", status: "completed" as const, scheduleType: "queued" as const };
    const archived = archiveCommission({ ...createBlankCommission(), id: "archived", status: "queued" as const }, "無回覆", 300);
    const groups = groupCommissionCollections([queued, rush, reservation, completed, archived]);

    expect(groups.queued.map((item) => item.id)).toEqual(["queued", "rush"]);
    expect(groups.reservations.map((item) => item.id)).toEqual(["reservation"]);
    expect(groups.completed.map((item) => item.id)).toEqual(["completed"]);
  });

  it("excludes rush cases from the ordinary schedule and last queued week", () => {
    const queued = { ...createBlankCommission(), id: "queued", status: "queued" as const, scheduleWeekStart: Date.UTC(2026, 7, 3), isRush: false };
    const rush = { ...createBlankCommission(), id: "rush", status: "queued" as const, scheduleWeekStart: Date.UTC(2026, 7, 10), isRush: true, dueDate: Date.UTC(2026, 6, 1) };
    expect(Object.values(groupQueuedCommissionsByMonth([queued, rush])).flat().map((item) => item.id)).toEqual(["queued"]);
    expect(getLastQueuedWeek([queued, rush])).toBe(Date.UTC(2026, 7, 3));
  });

  it("allows a near-case status to advance through the restored card action", () => {
    const sketching = { ...createBlankCommission(), id: "near", status: "sketching" as const };
    const advanced = withStatusTransition(sketching, "sketch_confirmed", "草稿確認", 1_700_000_000_000);
    expect(advanced.status).toBe("sketch_confirmed");
    expect(advanced.statusHistory.at(-1)).toMatchObject({ status: "sketch_confirmed", note: "草稿確認" });
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
    expect(autoDetectRushLevel(Date.UTC(2026, 6, 1), lastQueuedWeek, Date.UTC(2026, 7, 5))).toBe("極限加急");

    const requestedAt = now;
    const dueDate = now + 8 * 86_400_000;
    expect(autoDetectRushLevel(dueDate, lastQueuedWeek, requestedAt)).toBe("中度加急");
    expect(autoDetectRushLevel(dueDate, lastQueuedWeek, now + 4 * 86_400_000)).toBe("高度加急");
    expect(autoDetectRushLevel(dueDate, lastQueuedWeek, requestedAt)).toBe("中度加急");
  });

  it("only changes a saved rush level when the artist explicitly re-evaluates by the rush request date", () => {
    const requestedAt = Date.UTC(2026, 7, 1);
    const lastQueuedWeek = startOfWeek(Date.UTC(2026, 8, 14));
    const initial = applyRushDecision({ ...createBlankCommission(), dueDate: requestedAt + 8 * 86_400_000 }, lastQueuedWeek, requestedAt);
    const editedWithoutDecision = { ...initial, requirements: "補登設定網址" };
    const reEvaluated = applyRushDecision({ ...editedWithoutDecision, dueDate: requestedAt + 7 * 86_400_000 }, lastQueuedWeek, requestedAt);

    expect(initial.rushLevel).toBe("中度加急");
    expect(editedWithoutDecision.rushLevel).toBe("中度加急");
    expect(reEvaluated.rushLevel).toBe("高度加急");
    expect(reEvaluated.rushRequestedAt).toBe(requestedAt);
  });
});
