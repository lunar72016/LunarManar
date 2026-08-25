import { describe, expect, it, vi } from "vitest";
import { syncPwaBadge } from "./pwaBadge";

describe("PWA 未確認函件紅點", () => {
  it("writes the pending intake count to a supported app badge", async () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    await syncPwaBadge({ setAppBadge }, 3);
    expect(setAppBadge).toHaveBeenCalledWith(3);
  });

  it("clears the badge when no intake is awaiting review", async () => {
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    await syncPwaBadge({ clearAppBadge }, 0);
    expect(clearAppBadge).toHaveBeenCalledOnce();
  });

  it("does nothing on browsers without app badge support", async () => {
    await expect(syncPwaBadge({}, 2)).resolves.toBeUndefined();
  });
});
