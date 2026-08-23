import { describe, expect, it } from "vitest";
import { describeAnonymousAuthError, describeEmailPasswordAuthError, describeFirebaseAuthError, isSafariBrowser } from "./firebase";

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

  it("separates email password diagnostics from Google sign-in diagnostics", () => {
    expect(describeEmailPasswordAuthError({ code: "auth/operation-not-allowed" })).toContain("Email/Password");
    expect(describeEmailPasswordAuthError({ code: "auth/invalid-credential" })).toContain("Google 建立的帳號");
    expect(describeEmailPasswordAuthError({ code: "auth/invalid-credential" })).not.toContain("Google Provider");
  });

  it("identifies browser storage restrictions and explains unknown browser rejections", () => {
    expect(describeFirebaseAuthError({ code: "auth/web-storage-unsupported" })).toContain("Cookie");
    expect(describeFirebaseAuthError({ code: "auth/example-browser-error" })).toContain("跨網站登入環境");
  });

  it("extracts Firebase codes from an error message and identifies blocked browser environments", () => {
    expect(describeFirebaseAuthError(new Error("Firebase: Error (auth/unauthorized-domain)."))).toContain("lunar72016.github.io");
    expect(describeFirebaseAuthError(new Error("Third-party cookie blocked by browser"))).toContain("跨網站資料");
  });

  it("detects Safari while excluding Chrome variants that include the Safari token", () => {
    expect(isSafariBrowser("Mozilla/5.0 Version/17.0 Safari/605.1.15")).toBe(true);
    expect(isSafariBrowser("Mozilla/5.0 Chrome/120.0 Safari/537.36")).toBe(false);
    expect(isSafariBrowser("Mozilla/5.0 CriOS/120.0 Mobile/15E148 Safari/604.1")).toBe(false);
  });
});
