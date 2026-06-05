import type { Delegation } from "@prisma/client";

const VALUE_REQUIRED_ACTIONS = new Set(["CHECK_BUDGET", "VERIFY_FUNDS", "GENERATE_PO"]);

export class ScopeViolationError extends Error {
  public readonly violationType: string;
  public readonly detail: string;

  constructor(violationType: string, detail: string) {
    super(`Scope violation: ${violationType} - ${detail}`);
    this.violationType = violationType;
    this.detail = detail;
  }
}

export function requiresTaskValue(action: string) {
  return VALUE_REQUIRED_ACTIONS.has(action);
}

export function verifyScope(delegation: Delegation, action: string, value?: number): void {
  if (delegation.status !== "ACTIVE") {
    throw new ScopeViolationError(
      "CREDENTIAL_REVOKED",
      `Credential was ${delegation.status} at ${
        delegation.revokedAt?.toISOString() ?? "unknown"
      }. Reason: ${delegation.revokedReason ?? "none provided"}`,
    );
  }

  if (new Date() > delegation.expiresAt) {
    throw new ScopeViolationError("CREDENTIAL_EXPIRED", `Credential expired at ${delegation.expiresAt.toISOString()}`);
  }

  const allowedActions = JSON.parse(delegation.allowedActions) as string[];
  if (!allowedActions.includes(action)) {
    throw new ScopeViolationError(
      "ACTION_NOT_PERMITTED",
      `Action "${action}" is not in this agent's credential scope. Allowed: ${allowedActions.join(", ")}`,
    );
  }

  if (requiresTaskValue(action) && value === undefined) {
    throw new ScopeViolationError("INVALID_TASK_VALUE", `Action "${action}" requires a numeric totalValue`);
  }

  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new ScopeViolationError("INVALID_TASK_VALUE", "Task value must be a finite, non-negative number");
  }

  if (value !== undefined && value > delegation.maxValue) {
    throw new ScopeViolationError(
      "VALUE_EXCEEDS_SCOPE",
      `Requested value $${value.toLocaleString()} exceeds credential cap of $${delegation.maxValue.toLocaleString()}`,
    );
  }
}
