import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("待受理對契符節檢視", () => {
  it("以醒目的送達與待啟函狀態取代低對比函箋清單", () => {
    const panel = source("client/src/components/ClientProgressPanel.tsx");
    expect(panel).toContain("墨諾函箋已送達");
    expect(panel).toContain("正待繪師啟函");
    expect(panel).toContain("目前無須再次送件");
  });

  it("將已知待受理函箋回退為等待快照，不誤顯示找不到連結", () => {
    const page = source("client/src/pages/ClientPortalPage.tsx");
    expect(page).toContain("buildPendingProgressFromSubmission(matchingSubmission)");
    expect(page).toContain("if (showPendingSubmission()) return;");
    expect(page).not.toContain("找不到可用的進度連結");
  });
});
