import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appUrl,
  isAppOnlyPath,
  isMarketingHost,
  isPlayerHost,
  playerUrl,
  publicOriginFromRequest,
  publicUrl,
} from "./site-hosts";

describe("isMarketingHost", () => {
  it("recognizes marketing hostnames", () => {
    expect(isMarketingHost("onesigntv.com")).toBe(true);
    expect(isMarketingHost("www.onesigntv.com")).toBe(true);
    expect(isMarketingHost("WWW.onesigntv.com:443")).toBe(true);
  });

  it("rejects app and local dev hosts", () => {
    expect(isMarketingHost("app.onesigntv.com")).toBe(false);
    expect(isMarketingHost("player.onesigntv.com")).toBe(false);
    expect(isMarketingHost("localhost")).toBe(false);
  });
});

describe("isPlayerHost", () => {
  it("recognizes the browser player hostname", () => {
    expect(isPlayerHost("player.onesigntv.com")).toBe(true);
    expect(isPlayerHost("app.onesigntv.com")).toBe(false);
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

describe("playerUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds absolute player URLs from env", () => {
    vi.stubEnv("NEXT_PUBLIC_PLAYER_URL", "https://player.onesigntv.com");
    expect(playerUrl()).toBe("https://player.onesigntv.com/");
  });
});

describe("publicOriginFromRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers forwarded host over loopback request.url", () => {
    const request = {
      headers: new Headers({
        host: "127.0.0.1:3005",
        "x-forwarded-host": "app.onesigntv.com",
        "x-forwarded-proto": "https",
      }),
      url: "https://localhost:3005/dashboard",
    };
    expect(publicOriginFromRequest(request)).toBe("https://app.onesigntv.com");
    expect(publicUrl(request, "/login").toString()).toBe(
      "https://app.onesigntv.com/login",
    );
  });

  it("falls back to AUTH_URL when host is loopback", () => {
    vi.stubEnv("AUTH_URL", "https://app.onesigntv.com");
    const request = {
      headers: new Headers({ host: "localhost:3005" }),
      url: "https://localhost:3005/login",
    };
    expect(publicOriginFromRequest(request)).toBe("https://app.onesigntv.com");
  });
});
