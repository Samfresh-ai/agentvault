import type { Agent, Delegation } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { AIInferenceError, runAgentWithGemini } from "@/lib/agent-runner";
import { prisma } from "@/lib/prisma";
import { verifyScope, ScopeViolationError } from "@/lib/scope-check";
import { ensureDemoSeed, restoreDemoDelegations } from "@/lib/seed";
import { t3 } from "@/lib/t3-sdk";
import { taskValueFromPayload, TaskInputError } from "@/lib/task-validation";

export async function getDemoState(limit = 10) {
  await ensureDemoSeed();

  const [agents, delegations, totalAuditEvents, activeDelegations, recentLogs] = await Promise.all([
    prisma.agent.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.delegation.findMany({
      include: { delegator: true, delegate: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.count(),
    prisma.delegation.count({ where: { status: "ACTIVE" } }),
    prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { agent: true, delegation: true },
    }),
  ]);

  return {
    agents,
    delegations: delegations.map(toDelegationView),
    stats: {
      activeAgents: agents.filter((agent) => agent.status === "ACTIVE").length,
      activeDelegations,
      totalAuditEvents,
    },
    recentLogs: recentLogs.map(toAuditView),
  };
}

export async function resetDemo() {
  await restoreDemoDelegations();
  await prisma.task.deleteMany();
  return getDemoState();
}

export async function runDemoStep(step: number) {
  const { orchestrator, budget, vendor } = await ensureDemoSeed();

  if (step === 1) {
    return runOrchestrator(step, orchestrator);
  }

  if (step === 2) {
    return issueDelegations(step, orchestrator, budget, vendor);
  }

  if (step === 3) {
    return executeSubAgentTask(step, budget, "CHECK_BUDGET", {
      request: "Procure 50 laptops, max $50,000",
      totalValue: 45000,
      department: "Finance",
    });
  }

  if (step === 4) {
    return executeSubAgentTask(step, vendor, "GENERATE_PO", {
      vendor: "Dell Technologies",
      items: [{ name: "Laptop", qty: 50, unitPrice: 1200 }],
      totalValue: 60000,
    });
  }

  if (step === 5) {
    return revokeVendor(step, orchestrator, vendor);
  }

  if (step === 6) {
    return executeSubAgentTask(step, vendor, "CONTACT_APPROVED_VENDORS", {
      vendor: "Dell Technologies",
      message: "Confirm shipment window for approved laptop order.",
      totalValue: 0,
    });
  }

  throw new Error("Unknown demo step");
}

async function runOrchestrator(step: number, orchestrator: Agent) {
  const payload = {
    cfoTask: "Procure 50 laptops, max $50,000",
    targetAgents: ["BudgetAgent", "VendorAgent"],
  };
  const reasoning = await runAgentWithGemini("ORCHESTRATOR", "CREATE_DELEGATION_PLAN", payload);
  await writeAuditLog({
    agent: orchestrator,
    action: "CREATE_DELEGATION_PLAN",
    payload,
    outcome: "SUCCESS",
  });

  await prisma.task.create({
    data: {
      agentId: orchestrator.id,
      description: "Analyze CFO procurement task",
      status: "COMPLETED",
      result: JSON.stringify(reasoning),
    },
  });

  return {
    step,
    title: "Orchestrator analyzed the CFO task",
    outcome: "SUCCESS",
    reasoning,
  };
}

async function issueDelegations(step: number, orchestrator: Agent, budget: Agent, vendor: Agent) {
  await restoreDemoDelegations();
  const delegations = await prisma.delegation.findMany({
    where: { delegatorId: orchestrator.id, delegateId: { in: [budget.id, vendor.id] } },
    include: { delegate: true },
    orderBy: { createdAt: "asc" },
  });

  await writeAuditLog({
    agent: orchestrator,
    action: "ISSUE_DELEGATION_CREDENTIALS",
    payload: delegations.map((delegation) => ({
      delegate: delegation.delegate.name,
      allowedActions: JSON.parse(delegation.allowedActions) as string[],
      maxValue: delegation.maxValue,
      expiresAt: delegation.expiresAt,
      credential: JSON.parse(delegation.credential),
    })),
    outcome: "SUCCESS",
  });

  return {
    step,
    title: "Delegation credentials issued",
    outcome: "SUCCESS",
    delegations: delegations.map(toDelegationView),
  };
}

async function executeSubAgentTask(step: number, agent: Agent, action: string, payload: Record<string, unknown>) {
  const delegation = await latestDelegation(agent.id);

  if (!delegation) {
    const reason = "No active delegation. Agent must be credentialed before acting.";
    await writeAuditLog({
      agent,
      action,
      payload,
      outcome: "REJECTED",
      reason,
    });
    return rejection(step, agent, null, action, "NO_ACTIVE_DELEGATION", reason, payload);
  }

  try {
    verifyScope(delegation, action, taskValueFromPayload(action, payload));
    const role = agent.name === "BudgetAgent" ? "BUDGET_AGENT" : "VENDOR_AGENT";
    const reasoning = await runAgentWithGemini(role, action, payload);

    await writeAuditLog({
      agent,
      delegation,
      action,
      payload,
      outcome: "SUCCESS",
    });

    await prisma.task.create({
      data: {
        agentId: agent.id,
        description: action,
        status: "COMPLETED",
        result: JSON.stringify(reasoning),
      },
    });

    return {
      step,
      title: `${agent.name} executed ${action}`,
      outcome: "SUCCESS",
      agentId: agent.id,
      delegationId: delegation.id,
      reasoning,
    };
  } catch (error) {
    if (error instanceof ScopeViolationError || error instanceof TaskInputError) {
      const reason = error instanceof ScopeViolationError ? error.violationType : error.code;
      const detail = error instanceof ScopeViolationError ? error.detail : error.message;

      await writeAuditLog({
        agent,
        delegation,
        action,
        payload,
        outcome: "REJECTED",
        reason,
      });

      await prisma.task.create({
        data: {
          agentId: agent.id,
          description: action,
          status: "BLOCKED",
          result: JSON.stringify({ reason, detail }),
        },
      });

      return rejection(step, agent, delegation, action, reason, detail, payload);
    }

    if (error instanceof AIInferenceError) {
      throw error;
    }

    throw error;
  }
}

async function revokeVendor(step: number, orchestrator: Agent, vendor: Agent) {
  const delegation = await prisma.delegation.findFirst({
    where: { delegatorId: orchestrator.id, delegateId: vendor.id },
    orderBy: { createdAt: "desc" },
  });

  if (!delegation) {
    throw new Error("Vendor delegation not found");
  }

  const reason = "CFO revoked VendorAgent access mid-workflow";
  const credential = JSON.parse(delegation.credential) as { credentialId?: string };
  const proof = await t3.revokeCredential({
    credentialId: credential.credentialId ?? delegation.id,
    reason,
  });

  const updated = await prisma.delegation.update({
    where: { id: delegation.id },
    data: {
      status: "REVOKED",
      revokedAt: new Date(proof.revokedAt),
      revokedReason: reason,
    },
  });

  await writeAuditLog({
    agent: orchestrator,
    delegation: updated,
    action: "REVOKE_CREDENTIAL",
    payload: { vendorAgentId: vendor.id, reason, proof },
    outcome: "REVOKED",
    reason,
  });

  return {
    step,
    title: "VendorAgent credential revoked",
    outcome: "REVOKED",
    revocation: {
      delegationId: updated.id,
      revokedAt: updated.revokedAt,
      reason,
      proof,
    },
  };
}

async function latestDelegation(agentId: string) {
  return prisma.delegation.findFirst({
    where: { delegateId: agentId },
    orderBy: { createdAt: "desc" },
  });
}

function rejection(
  step: number,
  agent: Agent,
  delegation: Delegation | null,
  action: string,
  reason: string,
  detail: string,
  payload: Record<string, unknown>,
) {
  return {
    step,
    title: `${agent.name} rejected for ${reason}`,
    outcome: "REJECTED",
    reason,
    detail,
    agentId: agent.id,
    delegationId: delegation?.id,
    timestamp: new Date().toISOString(),
    action,
    attemptedValue: typeof payload.totalValue === "number" ? payload.totalValue : null,
    scope: delegation
      ? {
          credentialId: (JSON.parse(delegation.credential) as { credentialId?: string }).credentialId ?? delegation.id,
          allowedActions: JSON.parse(delegation.allowedActions) as string[],
          maxValue: delegation.maxValue,
          expiresAt: delegation.expiresAt,
          status: delegation.status,
          revokedAt: delegation.revokedAt,
          revokedReason: delegation.revokedReason,
        }
      : null,
  };
}

export function toDelegationView(delegation: Delegation & { delegate?: Agent; delegator?: Agent }) {
  return {
    id: delegation.id,
    delegatorId: delegation.delegatorId,
    delegateId: delegation.delegateId,
    delegateName: delegation.delegate?.name,
    delegatorName: delegation.delegator?.name,
    allowedActions: JSON.parse(delegation.allowedActions) as string[],
    maxValue: delegation.maxValue,
    resources: JSON.parse(delegation.resources) as string[],
    expiresAt: delegation.expiresAt,
    status: delegation.status,
    revokedAt: delegation.revokedAt,
    revokedReason: delegation.revokedReason,
    credential: JSON.parse(delegation.credential),
  };
}

export function toAuditView(log: {
  id: string;
  action: string;
  outcome: string;
  reason: string | null;
  signature: string;
  createdAt: Date;
  payload: string;
  agent: Agent;
  delegation?: Delegation | null;
}) {
  return {
    id: log.id,
    agentId: log.agent.id,
    agentName: log.agent.name,
    action: log.action,
    outcome: log.outcome,
    reason: log.reason,
    signature: log.signature,
    createdAt: log.createdAt,
    payload: log.payload,
    delegationId: log.delegation?.id ?? null,
  };
}
