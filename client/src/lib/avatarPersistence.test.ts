import { describe, expect, it } from "vitest";
import { awaitRequiredPersistence } from "./avatarPersistence";

describe("avatar persistence safeguard", () => {
  it("only resolves after the required Firestore persistence operation resolves", async () => {
    await expect(awaitRequiredPersistence(Promise.resolve("avatar-url"), 100, "settings-write-timeout")).resolves.toBe("avatar-url");
  });

  it("propagates a Firestore write failure after a successful storage upload step", async () => {
    await expect(awaitRequiredPersistence(Promise.reject(new Error("permission-denied")), 100, "settings-write-timeout")).rejects.toThrow("permission-denied");
  });

  it("rejects a persistence operation that does not complete before its timeout", async () => {
    await expect(awaitRequiredPersistence(new Promise<string>(() => undefined), 5, "settings-write-timeout")).rejects.toThrow("settings-write-timeout");
  });
});
