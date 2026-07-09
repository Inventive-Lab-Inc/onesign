import { afterEach, describe, expect, it, vi } from "vitest";
import { getClarityProjectIdForHost } from "./clarity";

describe("getClarityProjectIdForHost", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the marketing project on onesigntv.com", () => {
    vi.stubEnv("NEXT_PUBLIC_CLARITY_MARKETING_PROJECT_ID", "marketing-id");
    vi.stubEnv("NEXT_PUBLIC_CLARITY_APP_PROJECT_ID", "app-id");

    expect(getClarityProjectIdForHost("onesigntv.com")).toBe("marketing-id");
    expect(getClarityProjectIdForHost("www.onesigntv.com")).toBe("marketing-id");
  });

  it("uses the app project on app.onesigntv.com", () => {
    vi.stubEnv("NEXT_PUBLIC_CLARITY_MARKETING_PROJECT_ID", "marketing-id");
    vi.stubEnv("NEXT_PUBLIC_CLARITY_APP_PROJECT_ID", "app-id");

    expect(getClarityProjectIdForHost("app.onesigntv.com")).toBe("app-id");
  });

  it("falls back to legacy NEXT_PUBLIC_CLARITY_PROJECT_ID for marketing", () => {
    vi.stubEnv("NEXT_PUBLIC_CLARITY_MARKETING_PROJECT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", "legacy-marketing-id");

    expect(getClarityProjectIdForHost("onesigntv.com")).toBe("legacy-marketing-id");
  });

  it("skips localhost and unknown hosts", () => {
    vi.stubEnv("NEXT_PUBLIC_CLARITY_MARKETING_PROJECT_ID", "marketing-id");
    vi.stubEnv("NEXT_PUBLIC_CLARITY_APP_PROJECT_ID", "app-id");

    expect(getClarityProjectIdForHost("localhost")).toBeUndefined();
    expect(getClarityProjectIdForHost("preview.vercel.app")).toBeUndefined();
  });
});
