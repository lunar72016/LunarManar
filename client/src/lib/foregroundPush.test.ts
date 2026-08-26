import { describe, expect, it } from "vitest";
import { getForegroundIntakeMessage } from "./foregroundPush";

describe("getForegroundIntakeMessage", () => {
  it("creates a generic, privacy-safe foreground notification for a new intake", () => {
    expect(getForegroundIntakeMessage({ data: { type: "new-intake", pendingIntakeCount: "3", clientName: "不應出現" } })).toEqual({
      type: "new-intake",
      pendingCount: 3,
      title: "繪月錄",
      body: "有新的待啟墨函。",
    });
  });

  it("keeps badge-only updates out of foreground intake notifications", () => {
    expect(getForegroundIntakeMessage({ data: { type: "badge-update", pendingIntakeCount: "2" } })).toMatchObject({
      type: "badge-update",
      pendingCount: 2,
    });
  });

  it("ignores unrelated FCM data messages", () => {
    expect(getForegroundIntakeMessage({ data: { type: "other" } })).toBeNull();
  });
});
