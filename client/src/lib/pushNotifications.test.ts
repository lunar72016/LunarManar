import { describe, expect, it } from "vitest";
import { getWorkspaceIntakeUrl, shouldNotifyForSubmission } from "./pushNotifications";

describe("推播範圍規則", () => {
  it("sends every submitted intake while the one-month trial uses all notifications", () => {
    expect(shouldNotifyForSubmission("all", false)).toBe(true);
    expect(shouldNotifyForSubmission("all", true)).toBe(true);
  });

  it("limits later rush-only mode to urgent submissions", () => {
    expect(shouldNotifyForSubmission("rush", false)).toBe(false);
    expect(shouldNotifyForSubmission("rush", true)).toBe(true);
  });

  it("creates a GitHub Pages-safe intake link", () => {
    expect(getWorkspaceIntakeUrl("https://lunar72016.github.io", "/LunarManar/")).toBe("https://lunar72016.github.io/LunarManar/?view=intake");
  });
});
