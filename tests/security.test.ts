import assert from "node:assert/strict";
import type { Delegation } from "@prisma/client";
import {
  ScopeViolationError,
  verifyDelegationAccess,
  verifyDelegationValue,
  verifyScope,
} from "../src/lib/scope-check";
import {
  parseTaskExecutionRequest,
  taskValueFromPayload,
  TaskInputError,
} from "../src/lib/task-validation";

function delegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: "delegation-1",
    delegatorId: "orchestrator-1",
    delegateId: "vendor-1",
    allowedActions: JSON.stringify(["GENERATE_PO", "CONTACT_APPROVED_VENDORS"]),
    maxValue: 50000,
    resources: JSON.stringify(["approved-vendor-network"]),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    status: "ACTIVE",
    revokedAt: null,
    revokedReason: null,
    credential: "{}",
    createdAt: new Date(),
    ...overrides,
  };
}

function expectScopeError(code: string, fn: () => void) {
  assert.throws(
    fn,
    (error) => error instanceof ScopeViolationError && error.violationType === code,
    `expected ScopeViolationError ${code}`,
  );
}

function expectTaskInputError(code: string, fn: () => void) {
  assert.throws(
    fn,
    (error) => error instanceof TaskInputError && error.code === code,
    `expected TaskInputError ${code}`,
  );
}

function verifyTaskExecution(
  testDelegation: Delegation,
  action: string,
  payload: Record<string, unknown>,
) {
  verifyDelegationAccess(testDelegation, action);
  const taskValue = taskValueFromPayload(action, payload);
  verifyDelegationValue(testDelegation, action, taskValue);
}

verifyScope(delegation(), "GENERATE_PO", 45000);

expectScopeError("CREDENTIAL_REVOKED", () =>
  verifyScope(
    delegation({
      status: "REVOKED",
      revokedAt: new Date("2026-06-05T00:00:00Z"),
      revokedReason: "test",
    }),
    "GENERATE_PO",
    45000,
  ),
);

expectScopeError("CREDENTIAL_EXPIRED", () =>
  verifyScope(delegation({ expiresAt: new Date(Date.now() - 1000) }), "GENERATE_PO", 45000),
);

expectScopeError("ACTION_NOT_PERMITTED", () => verifyScope(delegation(), "CHECK_BUDGET", 45000));
expectScopeError("VALUE_EXCEEDS_SCOPE", () => verifyScope(delegation(), "GENERATE_PO", 60000));
expectScopeError("INVALID_TASK_VALUE", () => verifyScope(delegation(), "GENERATE_PO"));
expectScopeError("INVALID_TASK_VALUE", () => verifyScope(delegation(), "GENERATE_PO", Number.NaN));
expectScopeError("INVALID_TASK_VALUE", () => verifyScope(delegation(), "GENERATE_PO", -1));

const parsed = parseTaskExecutionRequest({
  agentId: "agent-1",
  action: "GENERATE_PO",
  payload: { totalValue: 45000 },
});
assert.equal(parsed.agentId, "agent-1");
assert.equal(taskValueFromPayload(parsed.action, parsed.payload), 45000);

assert.equal(taskValueFromPayload("CONTACT_APPROVED_VENDORS", { message: "status" }), undefined);
expectTaskInputError("INVALID_TASK_VALUE", () => taskValueFromPayload("GENERATE_PO", {}));
expectTaskInputError("INVALID_TASK_VALUE", () =>
  taskValueFromPayload("GENERATE_PO", { totalValue: "60000 USD" }),
);
expectTaskInputError("INVALID_TASK_VALUE", () => taskValueFromPayload("GENERATE_PO", { totalValue: {} }));
expectTaskInputError("INVALID_TASK_VALUE", () => taskValueFromPayload("GENERATE_PO", { totalValue: null }));
expectTaskInputError("INVALID_TASK_INPUT", () => parseTaskExecutionRequest({ agentId: "agent-1" }));
expectTaskInputError("INVALID_TASK_INPUT", () =>
  parseTaskExecutionRequest({ agentId: "agent-1", action: "GENERATE_PO", payload: [] }),
);

expectScopeError("CREDENTIAL_REVOKED", () =>
  verifyTaskExecution(
    delegation({
      status: "REVOKED",
      revokedAt: new Date("2026-06-05T00:00:00Z"),
      revokedReason: "test",
    }),
    "GENERATE_PO",
    { totalValue: "60000 USD" },
  ),
);

expectScopeError("CREDENTIAL_EXPIRED", () =>
  verifyTaskExecution(
    delegation({ expiresAt: new Date(Date.now() - 1000) }),
    "GENERATE_PO",
    { totalValue: "60000 USD" },
  ),
);

expectScopeError("ACTION_NOT_PERMITTED", () =>
  verifyTaskExecution(delegation(), "CHECK_BUDGET", { totalValue: "60000 USD" }),
);

expectTaskInputError("INVALID_TASK_VALUE", () =>
  verifyTaskExecution(delegation(), "GENERATE_PO", { totalValue: "60000 USD" }),
);

expectScopeError("VALUE_EXCEEDS_SCOPE", () =>
  verifyTaskExecution(delegation(), "GENERATE_PO", { totalValue: 60000 }),
);

console.log("security unit tests passed");
