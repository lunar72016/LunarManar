import { describe, expect, it } from "vitest";
import { buildClientProgress, buildPendingClientProgress, createPortalAccessCode, formatPortalDateInput, getActiveCodeProgress, getClientProgressPath, getPendingClientSubmissions, getPublicScheduleDetails, hydrateClientSubmission, isPortalAccessCode, isVerifiedCodeProgress, normalizeReferenceUrls } from "./clientPortal";
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

  it("formats public date fields with a neutral yyyy/mm/dd placeholder", () => {
    expect(formatPortalDateInput("")).toBe("yyyy/mm/dd");
    expect(formatPortalDateInput("2026-08-24")).toBe("2026/08/24");
  });

  it("builds a client-safe progress snapshot with approved drawing and payment fields only", () => {
    const commission = { ...createBlankCommission(), id: "commission-1", orderCode: "HY-001", clientName: "月見", status: "sketching" as const, depositAmount: 3000, totalAmount: 6000, scheduleWeekStart: Date.UTC(2026, 7, 3), artworkItems: [{ id: "item-1", characterCount: 2, artScope: "半身" as const, finishLevel: "一般" as const, qSize: null, note: "內部備註不公開" }], requirements: "私密設定網址" };
    const progress = buildClientProgress(commission, { id: "portal-1", accessMode: "code", clientUid: null, accessCode: "HY-0000000000000000-0000000000000000-0000000000000000", ownerUid: "artist" });

    expect(progress).toMatchObject({ commissionId: "commission-1", statusLabel: "草稿製作", scheduleWeekLabel: "8月第一週", depositAmount: 3000, totalAmount: 6000, artworkItems: [{ id: "item-1", summary: "2 人 · 半身 · 一般" }] });
    expect(progress).not.toHaveProperty("requirements");
    expect(getClientProgressPath(progress.accessCode!)).toContain("/#/client/progress/HY-");
  });

  it("creates a safe code-only pending snapshot as soon as a public form is sent", () => {
    const code = "HY-0000000000000000-0000000000000000-0000000000000000";
    const progress = buildPendingClientProgress({ id: code, accessMode: "code", clientUid: "anonymous-user", accessCode: code, ownerUid: "artist" }, "月見");

    expect(progress).toMatchObject({ id: code, commissionId: "", status: "inquiry", statusLabel: "等待繪師確認", scheduleWeekLabel: "繪師確認後提供" });
    expect(progress).not.toHaveProperty("requirements");
  });

  it("shows only the due date for a rush commission in the public summary", () => {
    expect(getPublicScheduleDetails({ isRush: true, scheduleWeekLabel: "9月第二週", dueDateLabel: "2026年08月31日" }))
      .toEqual([{ label: "交稿期限", value: "2026年08月31日" }]);
    expect(getPublicScheduleDetails({ isRush: false, scheduleWeekLabel: "9月第二週", dueDateLabel: null }))
      .toEqual([{ label: "排程週次", value: "9月第二週" }]);
  });

  it("accepts only an active server record that exactly matches a hand-created code", () => {
    const code = "HY-0000000000000000-0000000000000000-0000000000000000";
    const progress = buildPendingClientProgress({ id: code, accessMode: "code", clientUid: null, accessCode: code, ownerUid: "artist" }, "月見");
    expect(isVerifiedCodeProgress(progress, code)).toBe(true);
    expect(isVerifiedCodeProgress({ ...progress, accessCode: null }, code)).toBe(false);
    expect(isVerifiedCodeProgress({ ...progress, revokedAt: 1 }, code)).toBe(false);
  });

  it("reuses a valid hand-created code but ignores a revoked one when backfilling access", () => {
    const code = "HY-0000000000000000-0000000000000000-0000000000000000";
    const active = buildPendingClientProgress({ id: code, accessMode: "code", clientUid: null, accessCode: code, ownerUid: "artist" }, "月見");
    expect(getActiveCodeProgress([{ ...active, commissionId: "commission-1" }], "commission-1")?.accessCode).toBe(code);
    expect(getActiveCodeProgress([{ ...active, commissionId: "commission-1", revokedAt: 1 }], "commission-1")).toBeNull();
  });

  it("uses the Firestore document ID when stored submission data has a blank id", () => {
    const submission = hydrateClientSubmission("submission-document-id", { id: "", clientName: "月見" } as ClientSubmission);
    expect(submission.id).toBe("submission-document-id");
  });

  it("keeps the accepted commission relationship for later portal cleanup", () => {
    const submission = hydrateClientSubmission("submission-document-id", { id: "", clientName: "月見", commissionId: "commission-1" } as ClientSubmission);
    expect(submission.commissionId).toBe("commission-1");
  });

  it("only exposes unreviewed submissions in the intake queue", () => {
    const pending = getPendingClientSubmissions([
      { id: "submitted", state: "submitted" },
      { id: "accepted", state: "accepted" },
      { id: "declined", state: "declined" },
    ] as ClientSubmission[]);
    expect(pending.map((item) => item.id)).toEqual(["submitted"]);
  });
});
