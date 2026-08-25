import { describe, expect, it } from "vitest";

describe("Firebase Web App configuration", () => {
  it("accepts the configured API key at the Firebase Authentication endpoint", async () => {
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

    expect(apiKey).toBeTruthy();
    expect(projectId).toBe("muingmanager");

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey ?? "")}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: "invalid-test-token" }),
      },
    );
    const payload = (await response.json()) as { error?: { message?: string } };

    expect(payload.error?.message).not.toBe("API_KEY_INVALID");
    expect(payload.error?.message).not.toBe("PROJECT_NOT_FOUND");
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  }, 15_000);

  it("has a valid Web Push VAPID public key for Firebase Messaging subscriptions", () => {
    const vapidKey = process.env.VITE_FIREBASE_MESSAGING_VAPID_KEY;
    expect(vapidKey).toBeTruthy();
    const normalized = (vapidKey ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const raw = Buffer.from(padded, "base64");

    // VAPID public keys are uncompressed P-256 points: one 0x04 prefix plus 64 coordinate bytes.
    expect(raw).toHaveLength(65);
    expect(raw[0]).toBe(4);
  });
});
