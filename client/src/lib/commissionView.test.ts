import { describe, expect, it, vi } from "vitest";
import { createArtworkItem, createBlankCommission } from "./commission";
import { getViewRequirementRows, switchFromViewToEditor } from "./commissionView";

describe("commission view mode", () => {
  it("prepares a readable row for every artwork item when the view opens", () => {
    const commission = createBlankCommission();
    commission.artworkItems = [
      createArtworkItem({ artScope: "全身", finishLevel: "精緻", characterCount: 2, note: "主畫面" }),
      createArtworkItem({ artScope: "Q版", qSize: "2頭身", finishLevel: "塗鴉", characterCount: 2, note: "右上角" }),
    ];

    expect(getViewRequirementRows(commission)).toEqual([
      expect.objectContaining({ ordinal: 1, summary: "2 人 · 全身 · 精緻", note: "主畫面" }),
      expect.objectContaining({ ordinal: 2, summary: "2 人 · Q版 · 2頭身", note: "右上角" }),
    ]);
  });

  it("closes the view before opening the selected commission in the editor", () => {
    const commission = createBlankCommission();
    const events: string[] = [];
    const closeView = vi.fn(() => events.push("close"));
    const openEditor = vi.fn(() => events.push("edit"));

    switchFromViewToEditor(commission, closeView, openEditor);

    expect(events).toEqual(["close", "edit"]);
    expect(openEditor).toHaveBeenCalledWith(commission);
  });
});
