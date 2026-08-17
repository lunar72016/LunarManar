import { describe, expect, it } from "vitest";
import { createBlankCommission, displayPrice, initialCommissions, statusMeta, withStatusTransition } from "./commission";

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
});
