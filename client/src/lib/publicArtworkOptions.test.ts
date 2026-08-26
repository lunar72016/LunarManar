import { describe, expect, it } from "vitest";
import { normalizeStudioSettings } from "@/lib/studioSettings";
import { getPublicArtworkOptions, normalizePublicArtworkItem } from "./publicArtworkOptions";

const settings = normalizeStudioSettings({
  combinationPrices: {
    "大頭": { "一般": 1200, "精緻": 2400 },
    "半身": { "塗鴉": 800 },
  },
});

describe("public artwork options", () => {
  it("only exposes priced finishes for the selected art scope", () => {
    expect(getPublicArtworkOptions(settings, "大頭").finishes).toEqual(["一般", "精緻"]);
    expect(getPublicArtworkOptions(settings, "半身").finishes).toEqual(["塗鴉"]);
  });

  it("normalizes a public item away from an unpriced finish", () => {
    const item = normalizePublicArtworkItem(settings, { id: "item", characterCount: 1, artScope: "大頭", finishLevel: "塗鴉", qSize: null, note: "" });
    expect(item?.finishLevel).toBe("一般");
  });
});
