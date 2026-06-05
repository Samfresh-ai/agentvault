import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();
const baseUrl = process.env.AGENTVAULT_BASE_URL ?? "http://127.0.0.1:3000";

async function json(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectRejection(result, reason, label) {
  assert(result.response.status === 403, `${label}: expected HTTP 403, got ${result.response.status}`);
  assert(result.body.reason === reason || result.body.code === reason, `${label}: expected ${reason}`);
}

function allowedExecutionReachedModelOrSucceeded(result, label) {
  if (result.response.status === 200) {
    assert(result.body.outcome === "SUCCESS", `${label}: expected SUCCESS`);
    return;
  }

  assert(
    result.response.status === 500 && result.body.code === "AI_INFERENCE_FAILED",
    `${label}: expected SUCCESS or AI_INFERENCE_FAILED when no live model key is configured`,
  );
}

const resetBefore = await json("/api/demo/reset", { method: "POST" });
assert(resetBefore.response.ok, "demo reset failed");

const stateResult = await json("/api/demo/state");
assert(stateResult.response.ok, "demo state failed");

const agents = stateResult.body.agents ?? [];
const delegations = stateResult.body.delegations ?? [];
const orchestrator = agents.find((agent) => agent.name === "OrchestratorAgent");
const budget = agents.find((agent) => agent.name === "BudgetAgent");
const vendor = agents.find((agent) => agent.name === "VendorAgent");
assert(orchestrator && budget && vendor, "expected seeded OrchestratorAgent, BudgetAgent, and VendorAgent");

const vendorDelegation = delegations.find((delegation) => delegation.delegateId === vendor.id);
assert(vendorDelegation, "expected VendorAgent delegation");

const budgetAllowed = await json("/api/tasks/execute", {
  method: "POST",
  body: JSON.stringify({
    agentId: budget.id,
    action: "CHECK_BUDGET",
    payload: { request: "Procure 50 laptops", totalValue: 45000 },
  }),
});
allowedExecutionReachedModelOrSucceeded(budgetAllowed, "BudgetAgent CHECK_BUDGET");

const wrongRole = await json("/api/tasks/execute", {
  method: "POST",
  body: JSON.stringify({
    agentId: budget.id,
    action: "GENERATE_PO",
    payload: { vendor: "Dell Technologies", totalValue: 45000 },
  }),
});
expectRejection(wrongRole, "ACTION_NOT_PERMITTED", "BudgetAgent GENERATE_PO");

const wrongRoleMalformed = await json("/api/tasks/execute", {
  method: "POST",
  body: JSON.stringify({
    agentId: budget.id,
    action: "GENERATE_PO",
    payload: { vendor: "Dell Technologies", totalValue: "60000 USD" },
  }),
});
expectRejection(wrongRoleMalformed, "ACTION_NOT_PERMITTED", "BudgetAgent malformed GENERATE_PO");

const overCap = await json("/api/tasks/execute", {
  method: "POST",
  body: JSON.stringify({
    agentId: vendor.id,
    action: "GENERATE_PO",
    payload: { vendor: "Dell Technologies", totalValue: 60000 },
  }),
});
expectRejection(overCap, "VALUE_EXCEEDS_SCOPE", "VendorAgent over-cap GENERATE_PO");

await prisma.delegation.update({
  where: { id: vendorDelegation.id },
  data: {
    status: "ACTIVE",
    revokedAt: null,
    revokedReason: null,
    expiresAt: new Date(Date.now() - 60_000),
  },
});

const expiredMalformed = await json("/api/tasks/execute", {
  method: "POST",
  body: JSON.stringify({
    agentId: vendor.id,
    action: "GENERATE_PO",
    payload: { vendor: "Dell Technologies", totalValue: "60000 USD" },
  }),
});
expectRejection(expiredMalformed, "CREDENTIAL_EXPIRED", "VendorAgent expired malformed GENERATE_PO");

const resetAfterExpiry = await json("/api/demo/reset", { method: "POST" });
assert(resetAfterExpiry.response.ok, "demo reset after expiry regression failed");

const malformedValue = await json("/api/tasks/execute", {
  method: "POST",
  body: JSON.stringify({
    agentId: vendor.id,
    action: "GENERATE_PO",
    payload: { vendor: "Dell Technologies", totalValue: "60000 USD" },
  }),
});
assert(malformedValue.response.status === 400, `malformed value: expected HTTP 400, got ${malformedValue.response.status}`);
assert(malformedValue.body.code === "INVALID_TASK_VALUE", "malformed value: expected INVALID_TASK_VALUE");

const vendorAllowed = await json("/api/tasks/execute", {
  method: "POST",
  body: JSON.stringify({
    agentId: vendor.id,
    action: "GENERATE_PO",
    payload: { vendor: "Dell Technologies", totalValue: 45000 },
  }),
});
allowedExecutionReachedModelOrSucceeded(vendorAllowed, "VendorAgent in-scope GENERATE_PO");

const revoke = await json("/api/agents/revoke", {
  method: "POST",
  body: JSON.stringify({
    orchestratorId: orchestrator.id,
    delegationId: vendorDelegation.id,
    reason: "security smoke test revocation",
  }),
});
assert(revoke.response.ok, "VendorAgent delegation revocation failed");

const afterRevoke = await json("/api/tasks/execute", {
  method: "POST",
  body: JSON.stringify({
    agentId: vendor.id,
    action: "GENERATE_PO",
    payload: { vendor: "Dell Technologies", totalValue: "60000 USD" },
  }),
});
expectRejection(afterRevoke, "CREDENTIAL_REVOKED", "VendorAgent post-revocation malformed GENERATE_PO");

const auditBeforeReset = await json("/api/audit/logs?limit=100");
assert(auditBeforeReset.response.ok, "audit fetch before reset failed");
const auditCountBeforeReset = auditBeforeReset.body.total;

const resetAfter = await json("/api/demo/reset", { method: "POST" });
assert(resetAfter.response.ok, "demo reset after smoke failed");

const auditAfterReset = await json("/api/audit/logs?limit=100");
assert(auditAfterReset.response.ok, "audit fetch after reset failed");
assert(
  auditAfterReset.body.total >= auditCountBeforeReset,
  "demo reset must not delete audit history",
);

const reasons = new Set((auditAfterReset.body.logs ?? []).map((log) => log.reason).filter(Boolean));
assert(reasons.has("ACTION_NOT_PERMITTED"), "audit logs missing ACTION_NOT_PERMITTED rejection");
assert(reasons.has("VALUE_EXCEEDS_SCOPE"), "audit logs missing VALUE_EXCEEDS_SCOPE rejection");
assert(reasons.has("CREDENTIAL_REVOKED"), "audit logs missing CREDENTIAL_REVOKED rejection");
assert(reasons.has("CREDENTIAL_EXPIRED"), "audit logs missing CREDENTIAL_EXPIRED rejection");
assert(reasons.has("INVALID_TASK_VALUE"), "audit logs missing INVALID_TASK_VALUE rejection");

await prisma.$disconnect();
console.log("security smoke passed");
