import { describe, expect, it } from "vitest";
import { describeAnonymousAuthError, describeFirebaseAuthError } from "./firebase";

describe("Firebase Authentication 錯誤提示", () => {
  it("explains missing Google provider and unauthorized domains", () => {
    expect(describeFirebaseAuthError({ code: "auth/operation-not-allowed" })).toContain("Google Provider");
    expect(describeFirebaseAuthError({ code: "auth/unauthorized-domain" })).toContain("lunar72016.github.io");
  });

  it("gives Anonymous Provider guidance without calling it a Google login error", () => {
    const message = describeAnonymousAuthError({ code: "auth/operation-not-allowed" });
    expect(message).toContain("Anonymous Provider");
    expect(message).not.toContain("Google 登入");
  });
});
