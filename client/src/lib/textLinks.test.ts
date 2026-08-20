import { describe, expect, it } from "vitest";
import { splitLinkedText } from "./textLinks";

describe("splitLinkedText", () => {
  it("splits an http or https URL from surrounding requirement text", () => {
    expect(splitLinkedText("設定請見 https://example.com/reference/very-long-file"))
      .toEqual([{ type: "text", value: "設定請見 " }, { type: "link", value: "https://example.com/reference/very-long-file" }]);
  });

  it("keeps sentence punctuation outside the clickable URL", () => {
    expect(splitLinkedText("請開啟 https://example.com/file.pdf。"))
      .toEqual([{ type: "text", value: "請開啟 " }, { type: "link", value: "https://example.com/file.pdf" }, { type: "text", value: "。" }]);
  });

  it("leaves ordinary text unchanged", () => {
    expect(splitLinkedText("沒有網址的備註")).toEqual([{ type: "text", value: "沒有網址的備註" }]);
  });
});
