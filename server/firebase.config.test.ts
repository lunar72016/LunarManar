import { describe, expect, it } from "vitest";

describe("Firebase Web App configuration", () => {
  it("accepts the configured API key at the Firebase Authentication endpoint", async () => {
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

    expect(apiKey).toBeTruthy();
    expect(projectId).toBe("muingmanager");

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey ?? "")}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      },
    );
    const payload = (await response.json()) as { error?: { message?: string } };

    expect(payload.error?.message).not.toBe("API_KEY_INVALID");
    expect(payload.error?.message).not.toBe("PROJECT_NOT_FOUND");
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  }, 15_000);
});
