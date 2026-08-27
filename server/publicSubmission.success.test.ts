import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("懸榜昭繪送件完成確認", () => {
  it("以完成視窗集中顯示並複製對契符節", () => {
    const form = source("client/src/components/PublicSubmissionForm.tsx");
    expect(form).toContain("function SubmissionCompleteDialog");
    expect(form).toContain('<Dialog open={Boolean(code)}');
    expect(form).toContain("墨諾函箋已送達");
    expect(form).toContain("複製對契符節");
    expect(form).not.toContain("function ResultCodeCard");
  });

  it("關閉完成視窗後清除表單頁的完成代碼", () => {
    const portal = source("client/src/pages/ClientPortalPage.tsx");
    expect(portal).toContain("onCloseResult={() => setResultCode(null)}");
  });
});
