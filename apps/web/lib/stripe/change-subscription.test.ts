import { describe, expect, it } from "vitest";
import {
  planPriceMatchesTemplate,
} from "@/lib/stripe/change-subscription";

describe("planPriceMatchesTemplate", () => {
  it("matches monthly or annual catalog price ids", () => {
    expect(
      planPriceMatchesTemplate("price_monthly", {
        stripe_price_monthly_id: "price_monthly",
        stripe_price_annual_id: "price_annual",
      }),
    ).toBe(true);
    expect(
      planPriceMatchesTemplate("price_annual", {
        stripe_price_monthly_id: "price_monthly",
        stripe_price_annual_id: "price_annual",
      }),
    ).toBe(true);
    expect(
      planPriceMatchesTemplate("price_other", {
        stripe_price_monthly_id: "price_monthly",
        stripe_price_annual_id: "price_annual",
      }),
    ).toBe(false);
  });
});
