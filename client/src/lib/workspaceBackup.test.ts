import { describe, expect, it } from "vitest";
import { createWorkspaceBackup, workspaceBackupFilename } from "./workspaceBackup";

describe("本機 JSON 備份", () => {
  it("會建立帶有格式版本與匯出時間的完整備份外殼", () => {
    const backup = createWorkspaceBackup({ studioSettings: { studioName: "繪月錄" } as never, commissions: [], clientSubmissions: [], clientProgress: [] }, "2026-08-24T04:30:00.000Z");
    expect(backup).toMatchObject({ format: "hui-yue-ledger-backup", version: 1, exportedAt: "2026-08-24T04:30:00.000Z", commissions: [], clientSubmissions: [], clientProgress: [] });
  });

  it("以可辨識日期建立中文備份檔名", () => {
    expect(workspaceBackupFilename("2026-08-24T04:30:00.000Z")).toMatch(/^繪月錄-本機備份-20260824-\d{4}\.json$/);
  });
});
