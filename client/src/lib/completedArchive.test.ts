import { describe, expect, it } from "vitest";
import { groupCompletedCommissionsByYearMonth } from "./completedArchive";

describe("墨痕錦匣年月分組", () => {
  it("會依完稿日期由新至舊分成年度與月份", () => {
    const items = [
      { id: "old", updatedAt: 1704067200000, completedAt: 1704067200000, totalAmount: 1200 },
      { id: "summer", updatedAt: 1754006400000, completedAt: 1754006400000, totalAmount: 3400 },
      { id: "late", updatedAt: 1756684800000, completedAt: 1756684800000, totalAmount: 5600 },
    ] as never[];
    const groups = groupCompletedCommissionsByYearMonth(items);
    expect(groups.map((group) => group.year)).toEqual(["2025", "2024"]);
    expect(groups[0].months.map((month) => month.label)).toEqual(["9月", "8月"]);
    expect(groups[0].months[0].commissions[0].id).toBe("late");
    expect(groups[0].totalAmount).toBe(9000);
    expect(groups[0].months.map((month) => month.totalAmount)).toEqual([5600, 3400]);
    expect(groups[1].totalAmount).toBe(1200);
  });
});
