import { describe, expect, it } from "vitest";
import { isResizeObserverLoopWarning } from "./browserError";

describe("isResizeObserverLoopWarning", () => {
  it("only matches the known browser ResizeObserver delivery warnings", () => {
    expect(isResizeObserverLoopWarning("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isResizeObserverLoopWarning("ResizeObserver loop limit exceeded")).toBe(true);
    expect(isResizeObserverLoopWarning("Failed to fetch commissions")).toBe(false);
    expect(isResizeObserverLoopWarning(undefined)).toBe(false);
  });
});
