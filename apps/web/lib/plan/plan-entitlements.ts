/** Plan entitlement flags stored in plan_templates.features with a stable prefix. */

export type PlanEntitlements = {
  watermark: boolean;
  apiKeys: boolean;
  workspaces: boolean;
  /** Max workspaces when workspaces is enabled; null means unlimited. */
  workspaceLimit: number | null;
  userLimitEnabled: boolean;
  /** Max users when userLimitEnabled; null means unlimited. */
  userLimit: number | null;
};

export type PlanEntitlementRow = {
  id: "watermark" | "apiKeys" | "workspaces" | "userLimit";
  label: string;
  detail?: string;
  enabled: boolean;
};

const WATERMARK = "entitlement:watermark";
const API_KEYS = "entitlement:api_keys";
const WORKSPACES = "entitlement:workspaces";
const USER_LIMIT = "entitlement:user_limit";

export function emptyPlanEntitlements(): PlanEntitlements {
  return {
    watermark: false,
    apiKeys: false,
    workspaces: false,
    workspaceLimit: null,
    userLimitEnabled: false,
    userLimit: null,
  };
}

export function isEntitlementFeatureLine(line: string): boolean {
  const value = line.trim();
  return (
    value === WATERMARK ||
    value === API_KEYS ||
    value === WORKSPACES ||
    value.startsWith(`${WORKSPACES}:`) ||
    value === USER_LIMIT ||
    value.startsWith(`${USER_LIMIT}:`)
  );
}

export function parsePlanEntitlements(features: string[]): {
  entitlements: PlanEntitlements;
  marketingFeatures: string[];
} {
  const entitlements = emptyPlanEntitlements();
  const marketingFeatures: string[] = [];

  for (const raw of features) {
    const line = raw.trim();
    if (!line) continue;

    if (line === WATERMARK) {
      entitlements.watermark = true;
      continue;
    }
    if (line === API_KEYS) {
      entitlements.apiKeys = true;
      continue;
    }
    if (line === WORKSPACES || line.startsWith(`${WORKSPACES}:`)) {
      entitlements.workspaces = true;
      const limitPart = line.slice(WORKSPACES.length + 1);
      if (limitPart) {
        const parsed = Number.parseInt(limitPart, 10);
        entitlements.workspaceLimit = Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
      } else {
        entitlements.workspaceLimit = null;
      }
      continue;
    }
    if (line === USER_LIMIT || line.startsWith(`${USER_LIMIT}:`)) {
      entitlements.userLimitEnabled = true;
      const limitPart = line.slice(USER_LIMIT.length + 1);
      if (limitPart) {
        const parsed = Number.parseInt(limitPart, 10);
        entitlements.userLimit = Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
      } else {
        entitlements.userLimit = null;
      }
      continue;
    }

    marketingFeatures.push(line);
  }

  return { entitlements, marketingFeatures };
}

export function serializePlanFeatures(
  entitlements: PlanEntitlements,
  marketingFeatures: string[],
): string[] {
  const lines: string[] = [];

  if (entitlements.watermark) lines.push(WATERMARK);
  if (entitlements.apiKeys) lines.push(API_KEYS);
  if (entitlements.workspaces) {
    lines.push(
      entitlements.workspaceLimit != null && entitlements.workspaceLimit >= 1
        ? `${WORKSPACES}:${entitlements.workspaceLimit}`
        : WORKSPACES,
    );
  }
  if (entitlements.userLimitEnabled) {
    lines.push(
      entitlements.userLimit != null && entitlements.userLimit >= 1
        ? `${USER_LIMIT}:${entitlements.userLimit}`
        : USER_LIMIT,
    );
  }

  for (const feature of marketingFeatures) {
    const trimmed = feature.trim();
    if (trimmed && !isEntitlementFeatureLine(trimmed)) {
      lines.push(trimmed);
    }
  }

  return lines;
}

export function describePlanEntitlements(entitlements: PlanEntitlements): PlanEntitlementRow[] {
  return [
    {
      id: "watermark",
      label: "Watermark",
      detail: entitlements.watermark ? "Player shows OneSign watermark" : "No watermark",
      enabled: entitlements.watermark,
    },
    {
      id: "workspaces",
      label: "Workspaces",
      detail: !entitlements.workspaces
        ? "Not included"
        : entitlements.workspaceLimit != null
          ? `Up to ${entitlements.workspaceLimit} workspace${entitlements.workspaceLimit === 1 ? "" : "s"}`
          : "Included (no set limit)",
      enabled: entitlements.workspaces,
    },
    {
      id: "userLimit",
      label: "User limit",
      detail: !entitlements.userLimitEnabled
        ? "Not limited by plan"
        : entitlements.userLimit != null
          ? `Up to ${entitlements.userLimit} user${entitlements.userLimit === 1 ? "" : "s"}`
          : "Limited (no set number)",
      enabled: entitlements.userLimitEnabled,
    },
    {
      id: "apiKeys",
      label: "API keys",
      detail: entitlements.apiKeys ? "Included" : "Not included",
      enabled: entitlements.apiKeys,
    },
  ];
}
