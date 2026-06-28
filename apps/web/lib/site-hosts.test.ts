import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appUrl,
  isAppOnlyPath,
  isMarketingHost,
} from "./site-hosts";

describe("isMarketingHost", () => {
  it("recognizes marketing hostnames", () => {
    expect(isMarketingHost("onesigntv.com")).toBe(true);
    expect(isMarketingHost("www.onesigntv.com")).toBe(true);
    expect(isMarketingHost("WWW.onesigntv.com:443")).toBe(true);
  });

  it("rejects app and local dev hosts", () => {
    expect(isMarketingHost("app.onesigntv.com")).toBe(false);
    expect(isMarketingHost("localhost")).toBe(false);
  });
});

describe("isAppOnlyPath", () => {
  it("matches product routes", () => {
    expect(isAppOnlyPath("/login")).toBe(true);
    expect(isAppOnlyPath("/dashboard")).toBe(true);
    expect(isAppOnlyPath("/display/website/abc")).toBe(true);
  });

  it("allows marketing root", () => {
    expect(isAppOnlyPath("/")).toBe(false);
  });
});

describe("appUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds absolute app URLs from env", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.onesigntv.com");
    expect(appUrl("/login")).toBe("https://app.onesigntv.com/login");
  });
});
