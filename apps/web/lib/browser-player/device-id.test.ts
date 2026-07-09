import { describe, expect, it } from "vitest";
import { buildBrowserFingerprintClientId, hashBrowserFingerprint } from "./device-id";

describe("hashBrowserFingerprint", () => {
  it("is stable for the same signal set", () => {
    const signals = ["ua", "en-GB", "Asia/Dhaka", "1920", "1080", "24", "1", "8", "0", "MacIntel"];
    expect(hashBrowserFingerprint(signals)).toBe(hashBrowserFingerprint(signals));
  });

  it("changes when signals change", () => {
    const base = ["ua", "en-GB", "Asia/Dhaka", "1920", "1080", "24", "1", "8", "0", "MacIntel"];
    const wider = [...base.slice(0, 3), "2560", ...base.slice(4)];
    expect(hashBrowserFingerprint(base)).not.toBe(hashBrowserFingerprint(wider));
  });
});

describe("buildBrowserFingerprintClientId", () => {
  it("uses browser:fp prefix", () => {
    expect(buildBrowserFingerprintClientId()).toMatch(/^browser:fp:[0-9a-f]+$/);
  });
});
