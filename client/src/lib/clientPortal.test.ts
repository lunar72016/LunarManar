import { describe, expect, it } from "vitest";
import { buildClientProgress, buildPendingClientProgress, createPortalAccessCode, getClientProgressPath, getPendingClientSubmissions, hydrateClientSubmission, isPortalAccessCode, isVerifiedCodeProgress, normalizeReferenceUrls } from "./clientPortal";
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

  it("creates a safe code-only pending snapshot as soon as a public form is sent", () => {
    const code = "HY-0000000000000000-0000000000000000-0000000000000000";
    const progress = buildPendingClientProgress({ id: code, accessMode: "code", clientUid: "anonymous-user", accessCode: code, ownerUid: "artist" }, "月見");

    expect(progress).toMatchObject({ id: code, commissionId: "", status: "inquiry", statusLabel: "等待繪師確認", scheduleWeekLabel: "繪師確認後提供" });
    expect(progress).not.toHaveProperty("requirements");
  });

  it("accepts only an active server record that exactly matches a hand-created code", () => {
    const code = "HY-0000000000000000-0000000000000000-0000000000000000";
    const progress = buildPendingClientProgress({ id: code, accessMode: "code", clientUid: null, accessCode: code, ownerUid: "artist" }, "月見");
    expect(isVerifiedCodeProgress(progress, code)).toBe(true);
    expect(isVerifiedCodeProgress({ ...progress, accessCode: null }, code)).toBe(false);
    expect(isVerifiedCodeProgress({ ...progress, revokedAt: 1 }, code)).toBe(false);
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
