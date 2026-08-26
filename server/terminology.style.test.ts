import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("繪月錄書畫語彙", () => {
  it("以丹青筆閣與落紙餘灰標示工作台導覽", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('label: "落紙餘灰"');
    expect(layout).toContain("丹青筆閣");
    expect(layout).not.toContain('label: "垃圾桶"');
    expect(layout).not.toContain(">工作空間<");
  });

  it("以枯木逢春與灰飛煙滅說明落紙餘灰操作", () => {
    const home = source("client/src/pages/Home.tsx");
    expect(home).toContain("枯木逢春");
    expect(home).toContain("灰飛煙滅");
    expect(home).toContain("落紙餘灰");
    expect(home).not.toContain("七日垃圾桶");
  });

  it("以寄墨主取代可見的委託人入口文案", () => {
    const portal = source("client/src/pages/ClientPortalPage.tsx");
    const dialog = source("client/src/components/CommissionDialog.tsx");
    expect(portal).toContain("寄墨主入口規則");
    expect(dialog).toContain("請填寫寄墨主姓名");
  });
});
