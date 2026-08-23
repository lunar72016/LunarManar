import { describe, expect, it } from "vitest";
import { commissionFromClientSubmission } from "./useClientIntake";

describe("公開委託函受理", () => {
  it("copies public submission fields into a new artist-owned commission draft", () => {
    const commission = commissionFromClientSubmission({
      id: "submission-1", accessMode: "code", clientUid: "anonymous-uid", accessCode: "HY-0000000000000000-0000000000000000-0000000000000000", ownerUid: "artist", clientName: "月見", contactEmail: "moon@example.com", contactChannel: "電子郵件", contactHandle: "moon@example.com", characterSettingNote: "白髮角色", poseNote: "站姿", costumeDesignNote: "制服", accessoryNote: "月亮耳環", requirements: "半身像", referenceUrls: ["https://drive.google.com/example"], deliveryNote: "活動前", scheduleType: "reservation", artworkItems: [{ id: "item-1", characterCount: 2, artScope: "半身", finishLevel: "一般", qSize: null, note: "雙人" }], isRush: true, licenses: ["buyout"], deliveryPreference: "date", dueDate: 100, estimatedPrice: 4200, state: "submitted", createdAt: 1, updatedAt: 1,
    });

    expect(commission).toMatchObject({ id: "", clientName: "月見", contactChannel: "電子郵件", characterSettingNote: "白髮角色", scheduleType: "reservation", isRush: true, licenses: ["buyout"], dueDate: 100, estimatedPrice: 4200, status: "inquiry" });
    expect(commission.artworkItems).toHaveLength(1);
    expect(commission.requirements).toContain("設定稿／參考網址");
    expect(commission.requirements).toContain("https://drive.google.com/example");
    expect(commission.sourceNote).toContain("submission-1");
  });
});
