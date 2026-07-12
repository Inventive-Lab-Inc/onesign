import { describe, expect, it } from "vitest";
import {
  describePlanEntitlements,
  parsePlanEntitlements,
  serializePlanFeatures,
} from "./plan-entitlements";

describe("plan entitlements", () => {
  it("parses entitlement flags and keeps marketing bullets", () => {
    const { entitlements, marketingFeatures } = parsePlanEntitlements([
      "entitlement:watermark",
      "entitlement:workspaces:3",
      "entitlement:user_limit:10",
      "entitlement:api_keys",
      "Priority email support",
    ]);

    expect(entitlements).toEqual({
      watermark: true,
      apiKeys: true,
      workspaces: true,
      workspaceLimit: 3,
      userLimitEnabled: true,
      userLimit: 10,
    });
    expect(marketingFeatures).toEqual(["Priority email support"]);
  });

  it("serializes entitlements ahead of marketing bullets", () => {
    expect(
      serializePlanFeatures(
        {
          watermark: true,
          apiKeys: false,
          workspaces: true,
          workspaceLimit: 2,
          userLimitEnabled: true,
          userLimit: 5,
        },
        ["Screen groups", "entitlement:watermark"],
      ),
    ).toEqual([
      "entitlement:watermark",
      "entitlement:workspaces:2",
      "entitlement:user_limit:5",
      "Screen groups",
    ]);
  });

  it("describes enabled and disabled rows", () => {
    const rows = describePlanEntitlements({
      watermark: false,
      apiKeys: true,
      workspaces: true,
      workspaceLimit: 1,
      userLimitEnabled: false,
      userLimit: null,
    });
    expect(rows.find((row) => row.id === "apiKeys")?.enabled).toBe(true);
    expect(rows.find((row) => row.id === "workspaces")?.detail).toBe("Up to 1 workspace");
    expect(rows.find((row) => row.id === "watermark")?.enabled).toBe(false);
  });
});
