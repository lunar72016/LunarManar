import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Firestore rules for trash restoration", () => {
  it("allows the artist to recreate a client submission from the private trash", () => {
    const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
    expect(rules).toContain("match /clientSubmissions/{submissionId}");
    expect(rules).toContain("allow create: if isArtist() || (request.auth != null");
  });
});
