import { describe, expect, it } from "vitest";
import { getTrashDaysRemaining, type TrashItem } from "./useTrash";

const item = (expiresAt: number): TrashItem => ({
  id: "trash-1",
  ownerUid: "artist-1",
  kind: "commission",
  label: "測試畫約",
  deletedAt: 0,
  expiresAt,
  records: [],
});

describe("getTrashDaysRemaining", () => {
  it("rounds a partial day up so a restorable item remains visible through its final day", () => {
    expect(getTrashDaysRemaining(item(86_400_000), 1)).toBe(1);
  });

  it("returns zero once the seven-day retention period has expired", () => {
    expect(getTrashDaysRemaining(item(0), 1)).toBe(0);
  });
});
