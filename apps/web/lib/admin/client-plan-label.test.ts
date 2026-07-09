import { describe, expect, it } from "vitest";
import { guessClientPlanSelection, resolveClientPlanBadge } from "@/lib/admin/client-plan-label";
import type { AdminUserDirectoryEntry, PlanTemplate } from "@signage/types";

const plans: PlanTemplate[] = [
  {
    id: "solo-id",
    name: "Solo",
    slug: "solo",
    device_limit: 1,
    storage_limit_bytes: 524_288_000,
    is_active: true,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const baseRow: Pick<
  AdminUserDirectoryEntry,
  "device_limit" | "storage_limit_bytes" | "trial_ends_at" | "trial_expired" | "plan_kind"
> = {
  device_limit: 1,
  storage_limit_bytes: 524_288_000,
  trial_ends_at: null,
  trial_expired: false,
  plan_kind: "standard",
};

describe("resolveClientPlanBadge", () => {
  it("labels active trials", () => {
    const badge = resolveClientPlanBadge(
      {
        ...baseRow,
        trial_ends_at: "2026-07-20T00:00:00.000Z",
        plan_kind: "trial",
      },
      plans,
    );
    expect(badge.label).toBe("Solo trial");
    expect(badge.tone).toBe("trial");
  });

  it("labels catalog plans by matching limits", () => {
    const badge = resolveClientPlanBadge(baseRow, plans);
    expect(badge.label).toBe("Solo");
    expect(badge.tone).toBe("catalog");
  });
});

describe("guessClientPlanSelection", () => {
  it("prefers trial selection for active trials", () => {
    const selection = guessClientPlanSelection(
      {
        ...baseRow,
        trial_ends_at: "2026-07-20T00:00:00.000Z",
        plan_kind: "trial",
      },
      plans,
      "__trial__",
      "__custom__",
    );
    expect(selection).toBe("__trial__");
  });
});
