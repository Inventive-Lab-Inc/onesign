import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAppUrl,
  getGoogleAuthCallbackUrl,
  getOAuthConfirmRedirectUrl,
} from "./app-url";

describe("getAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("prefers the browser origin on the client", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://onesign.inventivelab.bd");
    vi.stubGlobal("window", { location: { origin: "https://onesign.inventivelab.co.uk" } });

    expect(getAppUrl()).toBe("https://onesign.inventivelab.co.uk");
  });

  it("uses NEXT_PUBLIC_APP_URL on the server", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://onesign.inventivelab.bd");

    expect(getAppUrl()).toBe("https://onesign.inventivelab.bd");
  });
});

describe("getGoogleAuthCallbackUrl", () => {
  it("returns a relative callback path for multi-domain Auth.js", () => {
    expect(getGoogleAuthCallbackUrl("/dashboard")).toBe("/auth/google/complete?next=%2Fdashboard");
  });
});

describe("getOAuthConfirmRedirectUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds confirm URLs from the active browser origin", () => {
    vi.stubGlobal("window", { location: { origin: "https://onesign.inventivelab.co.uk" } });

    expect(getOAuthConfirmRedirectUrl("/dashboard")).toBe(
      "https://onesign.inventivelab.co.uk/auth/confirm?next=%2Fdashboard",
    );
  });
});
