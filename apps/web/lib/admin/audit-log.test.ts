import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  auditSubjectKind,
  formatAuditMetadata,
} from "@/lib/admin/audit-log";

describe("auditActionLabel", () => {
  it("labels waitlist invite transitions", () => {
    expect(auditActionLabel("waitlist_status", { status_after: "invited" })).toBe("Waitlist invited");
    expect(auditActionLabel("waitlist_status", { status_after: "dismissed" })).toBe("Waitlist dismissed");
  });
});

describe("formatAuditMetadata", () => {
  it("formats waitlist status transitions with context", () => {
    expect(
      formatAuditMetadata("waitlist_status", {
        status_before: "pending",
        status_after: "invited",
        screen_count: 3,
        company_name: "Acme Retail",
      }),
    ).toBe("Pending → Invited · 3 screens requested · Acme Retail");
  });

  it("formats client invitations", () => {
    expect(
      formatAuditMetadata("client_invite", {
        email: "client@company.com",
        client_name: "Acme Retail",
      }),
    ).toBe("Invitation sent to client@company.com (Acme Retail)");
  });
});

describe("auditSubjectKind", () => {
  it("classifies waitlist rows without a target user", () => {
    expect(auditSubjectKind({ action: "waitlist_status", target_user_id: null })).toBe("waitlist");
    expect(auditSubjectKind({ action: "plan_update", target_user_id: "uuid" })).toBe("client");
  });
});
