import { describe, expect, it } from "vitest";
import { buildClientProgress, createPortalAccessCode, getClientProgressPath, isPortalAccessCode, normalizeReferenceUrls } from "./clientPortal";
import { createBlankCommission } from "./commission";

describe("委託人入口資料工具", () => {
  it("produces a high-entropy formatted access code", () => {
    const code = createPortalAccessCode();
    expect(isPortalAccessCode(code)).toBe(true);
    expect(code).toHaveLength(53);
  });

  it("keeps only valid and unique cloud reference URLs", () => {
    expect(normalizeReferenceUrls("https://drive.google.com/a\nnot-a-link https://drive.google.com/a https://example.com/b")).toEqual(["https://drive.google.com/a", "https://example.com/b"]);
  });

  it("builds a client-safe progress snapshot without pricing fields", () => {
    const commission = { ...createBlankCommission(), id: "commission-1", orderCode: "HY-001", clientName: "月見", status: "sketching" as const, depositAmount: 3000, scheduleWeekStart: Date.UTC(2026, 7, 3) };
    const progress = buildClientProgress(commission, { id: "portal-1", accessMode: "code", clientUid: null, accessCode: "HY-0000000000000000-0000000000000000-0000000000000000", ownerUid: "artist" });

    expect(progress).toMatchObject({ commissionId: "commission-1", statusLabel: "草稿製作", scheduleWeekLabel: "8月第一週" });
    expect(progress).not.toHaveProperty("depositAmount");
    expect(getClientProgressPath(progress.accessCode!)).toContain("/#/client/progress/HY-");
  });
});
